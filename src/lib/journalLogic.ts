// journalLogic.ts — reine Ableitungen der Abendbetrachtung.
import type { JournalEntry } from '@/data/JournalRepository';
import { addDays } from '@/lib/dates';

/** Stille Kette: aufeinanderfolgende Abende mit Eintrag, bis heute oder
 *  gestern (der heutige Abend darf ja noch kommen). Kein Schuld-Zähler —
 *  nur eine Zahl, wenn sie Freude macht. */
export function journalStreak(entries: JournalEntry[], today: string): number {
  const days = new Set(entries.filter((e) => e.text.trim().length > 0).map((e) => e.date));
  let start = today;
  if (!days.has(start)) start = addDays(today, -1);
  if (!days.has(start)) return 0;
  let streak = 0;
  let d = start;
  while (days.has(d)) {
    streak += 1;
    d = addDays(d, -1);
  }
  return streak;
}
