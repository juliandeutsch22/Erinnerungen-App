// noteLogic.ts — reine Ableitungen für Notizen (iOS-Notizen-Verhalten):
// Der Titel IST die erste Zeile des Textes, die Vorschau der Rest.
import type { Note } from '@/data/types';

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

/** Notizen zu einer Erinnerung. */
export function notesForTask(notes: Note[], taskId: string): Note[] {
  return notes.filter((n) => n.taskId === taskId);
}

/** Notizen zu einem Termin. */
export function notesForEvent(notes: Note[], eventId: string): Note[] {
  return notes.filter((n) => n.eventId === eventId);
}
