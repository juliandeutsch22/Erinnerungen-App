// orphanDocuments.ts — stiller Aufräumer für Termin-Dokumente. Löscht der
// Nutzer einen Termin im Kalender, werden seine Dokumente unerreichbar (sie
// leben nur im Termin-Editor) und lägen für immer im Container. Der Sweep
// beim App-Start merkt sich, seit wann ein Termin fehlt, und entsorgt die
// Anhänge erst nach einer Schonfrist — EventKit-IDs können bei Sync-Wechseln
// kurzzeitig flackern, deshalb nie sofort löschen.
//
// Fotos werden bewusst NICHT angefasst: der Rückblick zeigt alle Fotos, auch
// die vergangener/gelöschter Termine — sie sind freischwebende Erinnerungen.
import { getDocumentRepository } from '@/data/index';
import { kvStorage } from '@/data/kvStorage';
import { hasCalendarPermission, listDeviceEvents } from '@/lib/deviceCalendar';
import { deleteStoredDocument } from '@/lib/documents';

export const ORPHAN_GRACE_DAYS = 60;
const MISSING_KEY = 'stoa.documents.missingSince';
const YEAR_MS = 365 * 86400000;

/** Entscheidet, was passiert: fehlende Termine bekommen einen Erst-Vermisst-
 *  Stempel, nach Ablauf der Schonfrist fallen ihre Dokumente. Taucht ein
 *  Termin wieder auf, wird der Stempel vergessen. Rein & testbar. */
export function sweepDecision(
  docEventIds: string[],
  presentIds: Set<string>,
  missingSince: Record<string, string>,
  now: Date,
): { nextMissingSince: Record<string, string>; deleteEventIds: string[] } {
  const nextMissingSince: Record<string, string> = {};
  const deleteEventIds: string[] = [];
  const cutoff = now.getTime() - ORPHAN_GRACE_DAYS * 86400000;
  for (const id of new Set(docEventIds)) {
    if (presentIds.has(id)) continue;
    const firstMissing = missingSince[id] ?? now.toISOString();
    if (Date.parse(firstMissing) <= cutoff) deleteEventIds.push(id);
    else nextMissingSince[id] = firstMissing;
  }
  return { nextMissingSince, deleteEventIds };
}

/** Sweep beim App-Start (nur nativ, nur mit Kalenderzugriff).
 *  Liefert die Zahl entsorgter Dokumente. Fehler werden geschluckt —
 *  Aufräumen ist Kür, nie Pflicht. */
export async function runOrphanDocumentSweep(now: Date = new Date()): Promise<number> {
  try {
    if (!(await hasCalendarPermission())) return 0;
    const repo = getDocumentRepository();
    const docs = await repo.getAll();
    if (docs.length === 0) {
      await kvStorage.removeItem(MISSING_KEY);
      return 0;
    }

    // EventKit beantwortet nur ~4-Jahres-Fenster je Abfrage → zwei Fenster
    // decken −2 bis +4 Jahre ab; weiter entfernte Tickets gibt es nicht.
    const windows: [Date, Date][] = [
      [new Date(now.getTime() - 2 * YEAR_MS), new Date(now.getTime() + YEAR_MS)],
      [new Date(now.getTime() + YEAR_MS), new Date(now.getTime() + 4 * YEAR_MS)],
    ];
    const present = new Set<string>();
    for (const [from, to] of windows) {
      for (const e of await listDeviceEvents(from, to)) present.add(e.id);
    }
    // Gar keine Termine sichtbar, aber Dokumente vorhanden? Riecht nach
    // Sync-/Berechtigungs-Panne — dann lieber gar nichts beurteilen.
    if (present.size === 0) return 0;

    const raw = await kvStorage.getItem(MISSING_KEY);
    const missingSince = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const { nextMissingSince, deleteEventIds } = sweepDecision(
      docs.map((d) => d.eventId),
      present,
      missingSince,
      now,
    );

    let removed = 0;
    if (deleteEventIds.length > 0) {
      const del = new Set(deleteEventIds);
      for (const d of docs) {
        if (!del.has(d.eventId)) continue;
        deleteStoredDocument(d.uri);
        await repo.remove(d.id);
        removed += 1;
      }
    }
    await kvStorage.setItem(MISSING_KEY, JSON.stringify(nextMissingSince));
    return removed;
  } catch {
    return 0;
  }
}
