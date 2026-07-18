// noteLogic.ts — reine Ableitungen für Notizen (iOS-Notizen-Verhalten):
// Der Titel IST die erste Zeile des Textes, die Vorschau der Rest.
// Dazu: Papierkorb-Fenster (30 Tage) und Datumsgruppen für die Liste.
import type { Note } from '@/data/types';

import { addDays, toDateStr } from '@/lib/dates';

/** Erste nichtleere Zeile = Titel (gekürzt); leer → „Neue Notiz". */
export function noteTitle(body: string): string {
  const line = body.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
  if (!line) return 'Neue Notiz';
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
}

/** Vorschau: die erste nichtleere Zeile NACH der Titelzeile
 *  (Checklisten-Marker werden für die Anzeige entfernt). */
export function notePreview(body: string): string {
  const lines = body.split('\n');
  const titleIdx = lines.findIndex((l) => l.trim().length > 0);
  if (titleIdx === -1) return '';
  const raw = lines.slice(titleIdx + 1).find((l) => l.trim().length > 0)?.trim() ?? '';
  const rest = raw.replace(/^- (?:\[[ x]\] )?/, '');
  return rest.length > 120 ? `${rest.slice(0, 119)}…` : rest;
}

/** Notizen zu einer Erinnerung (ohne Papierkorb). */
export function notesForTask(notes: Note[], taskId: string): Note[] {
  return notes.filter((n) => n.taskId === taskId && n.deletedAt === null);
}

/** Notizen zu einem Termin (ohne Papierkorb). */
export function notesForEvent(notes: Note[], eventId: string): Note[] {
  return notes.filter((n) => n.eventId === eventId && n.deletedAt === null);
}

/** Suche: die Zeile, in der der Treffer steht (statt stur der Vorschau).
 *  Titelzeilen-Treffer → Vorschau (der Titel steht ohnehin darüber). */
export function noteMatchLine(body: string, query: string): string {
  const q = query.trim().toLowerCase();
  if (!q) return notePreview(body);
  const lines = body.split('\n');
  const titleIdx = lines.findIndex((l) => l.trim().length > 0);
  const hit = lines.find((l, i) => i !== titleIdx && l.toLowerCase().includes(q))?.trim() ?? '';
  if (!hit) return notePreview(body);
  return hit.length > 120 ? `${hit.slice(0, 119)}…` : hit;
}

/** Aktive Notizen — alles außer Papierkorb. */
export function activeNotes(notes: Note[]): Note[] {
  return notes.filter((n) => n.deletedAt === null);
}

const TRASH_DAYS = 30;

/** „Zuletzt gelöscht": im Papierkorb und jünger als 30 Tage. */
export function trashedNotes(notes: Note[], today: string): Note[] {
  const cutoff = addDays(today, -TRASH_DAYS);
  return notes.filter((n) => n.deletedAt !== null && toDateStr(new Date(n.deletedAt)) >= cutoff);
}

/** Abgelaufener Papierkorb (> 30 Tage) — wird beim Öffnen endgültig entfernt. */
export function expiredTrash(notes: Note[], today: string): Note[] {
  const cutoff = addDays(today, -TRASH_DAYS);
  return notes.filter((n) => n.deletedAt !== null && toDateStr(new Date(n.deletedAt)) < cutoff);
}

// ——— Checklisten (Plain-Text-Kern): „- [ ] Text" offen, „- [x] Text" erledigt;
// nacktes „- Text" zählt als offene Zeile und wird beim Abhaken normalisiert.
const CHECK_RE = /^(\s*)- (?:\[( |x)\] )?(.*)$/;

export type ChecklistItem = { lineIndex: number; text: string; done: boolean };

/** Alle Checklisten-Zeilen der Notiz (Zeilenindex bezogen auf body.split('\n')). */
export function checklistItems(body: string): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  body.split('\n').forEach((line, i) => {
    const m = CHECK_RE.exec(line);
    if (m && m[3].trim().length > 0) out.push({ lineIndex: i, text: m[3].trim(), done: m[2] === 'x' });
  });
  return out;
}

/** Haken einer Zeile umschalten — schreibt normalisiert „- [ ] / - [x]" zurück. */
export function toggleChecklistItem(body: string, lineIndex: number): string {
  const lines = body.split('\n');
  const m = lines[lineIndex] !== undefined ? CHECK_RE.exec(lines[lineIndex]) : null;
  if (!m) return body;
  const nextDone = m[2] !== 'x';
  lines[lineIndex] = `${m[1]}- [${nextDone ? 'x' : ' '}] ${m[3]}`;
  return lines.join('\n');
}

export function checklistProgress(body: string): { done: number; total: number } {
  const items = checklistItems(body);
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/** Enter in einer Checklisten-Zeile setzt die Liste fort (wie iOS Notes):
 *  neue Zeile bekommt „- [ ] "; Enter in einer LEEREN Checklisten-Zeile
 *  beendet die Liste (Marker wird entfernt). Erwartet prev → next mit genau
 *  einem eingefügten '\n'; sonst wird next unverändert zurückgegeben. */
export function continueChecklist(prev: string, next: string): string {
  if (next.length !== prev.length + 1) return next;
  // Position des eingefügten Zeichens finden (erster Unterschied).
  let p = 0;
  while (p < prev.length && prev[p] === next[p]) p += 1;
  if (next[p] !== '\n') return next;
  const before = next.slice(0, p);
  const lineStart = before.lastIndexOf('\n') + 1;
  const line = before.slice(lineStart);
  const m = CHECK_RE.exec(line);
  if (!m) return next;
  if (m[3].trim().length === 0) {
    // Leere Checklisten-Zeile + Enter → Liste beenden (Marker weg, kein neues \n).
    return next.slice(0, lineStart) + next.slice(p + 1);
  }
  return `${next.slice(0, p + 1)}${m[1]}- [ ] ${next.slice(p + 1)}`;
}

export type NoteGroup = { key: string; title: string; notes: Note[] };

/** Datumsgruppen wie in iOS Notes: Angeheftet · Heute · Gestern ·
 *  Letzte 7 Tage · Letzte 30 Tage · Älter. Leere Gruppen entfallen.
 *  Erwartet aktive Notizen, bereits nach updatedAt absteigend sortiert. */
export function groupNotes(notes: Note[], today: string): NoteGroup[] {
  const yesterday = addDays(today, -1);
  const week = addDays(today, -7);
  const month = addDays(today, -30);
  const groups: NoteGroup[] = [
    { key: 'pinned', title: 'Angeheftet', notes: [] },
    { key: 'today', title: 'Heute', notes: [] },
    { key: 'yesterday', title: 'Gestern', notes: [] },
    { key: 'week', title: 'Letzte 7 Tage', notes: [] },
    { key: 'month', title: 'Letzte 30 Tage', notes: [] },
    { key: 'older', title: 'Älter', notes: [] },
  ];
  for (const n of notes) {
    if (n.pinned) {
      groups[0].notes.push(n);
      continue;
    }
    const day = toDateStr(new Date(n.updatedAt));
    if (day >= today) groups[1].notes.push(n);
    else if (day >= yesterday) groups[2].notes.push(n);
    else if (day >= week) groups[3].notes.push(n);
    else if (day >= month) groups[4].notes.push(n);
    else groups[5].notes.push(n);
  }
  return groups.filter((g) => g.notes.length > 0);
}
