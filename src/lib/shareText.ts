// shareText.ts — reine Logik: Notiz oder Liste in schlichten Text gießen, den
// das iOS-Share-Sheet in Nachricht, Mail o. Ä. weitergibt. Kein Markdown-
// Zauber, keine App-internen Verknüpfungen — nur der lesbare Inhalt.
import { deadlineLabel } from '@/lib/dates';
import { noteTitle } from '@/lib/noteLogic';
import type { List, Task } from '@/data/types';

/** Eine Notiz als Text: der Body ist schon der Text — nur sauber getrimmt. */
export function noteToShareText(body: string): string {
  return body.replace(/\s+$/g, '').replace(/^\s+/g, '');
}

/** Titel für das Share-Sheet (iOS zeigt ihn z. B. als Mail-Betreff). */
export function noteShareTitle(body: string): string {
  return noteTitle(body);
}

/**
 * Eine Liste als Text: Überschrift, optional Ziel/Deadline, dann die offenen
 * Aufgaben als Häkchen-Liste (mit fälligem Datum), erledigte am Ende abgehakt.
 * Papierkorb-Aufgaben und die einer gelöschten Liste bleiben außen vor —
 * der Aufrufer reicht nur die relevanten Aufgaben herein.
 */
export function listToShareText(list: List, tasks: Task[], today: string): string {
  const lines: string[] = [list.name];
  if (list.goal) lines.push(`Ziel: ${list.goal}`);
  if (list.deadline) lines.push(`Deadline: ${list.deadline} (${deadlineLabel(list.deadline, today)})`);
  lines.push('');

  const open = tasks.filter((t) => t.completedAt === null);
  const done = tasks.filter((t) => t.completedAt !== null);

  for (const t of open) {
    let line = `☐ ${t.title}`;
    if (t.dueDate) line += ` — ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ''}`;
    lines.push(line);
    // Unteraufgaben eingerückt darunter.
    for (const s of t.subtasks) lines.push(`   ${s.done ? '☑' : '☐'} ${s.title}`);
  }

  if (done.length > 0) {
    if (open.length > 0) lines.push('');
    for (const t of done) lines.push(`☑ ${t.title}`);
  }

  // „Geteilt mit Stoa" bewusst NICHT anhängen — kein Werbe-Duktus.
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
