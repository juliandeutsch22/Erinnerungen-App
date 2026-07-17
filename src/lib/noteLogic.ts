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

/** Vorschau: die erste nichtleere Zeile NACH der Titelzeile. */
export function notePreview(body: string): string {
  const lines = body.split('\n');
  const titleIdx = lines.findIndex((l) => l.trim().length > 0);
  if (titleIdx === -1) return '';
  const rest = lines.slice(titleIdx + 1).find((l) => l.trim().length > 0)?.trim() ?? '';
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
