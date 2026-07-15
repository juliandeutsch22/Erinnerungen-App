// monthMatrix.ts — gemeinsame Monats-Logik + Konstanten für BEIDE Kalender
// (Kalender-Tab und Editor-MiniCalendar). Wochen beginnen bei Montag; das Gitter
// zeigt auch die Randtage der Nachbarmonate (wie iOS). Reine Funktionen.
import { toDateStr } from '@/lib/dates';

export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export type MonthAnchor = { year: number; month: number };

/** Sichtbares Gitter eines Monats: Montag vor dem 1. bis Ende der letzten Woche. */
export function monthGridRange(anchor: MonthAnchor): { from: string; to: string } {
  const first = new Date(anchor.year, anchor.month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(anchor.year, anchor.month, 1 - offset);
  const daysInMonth = new Date(anchor.year, anchor.month + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + cells - 1);
  return { from: toDateStr(start), to: toDateStr(end) };
}

/** Wochen des Monats als Date-Matrix (Wochen ab Montag, inkl. Nachbarmonats-Tage). */
export function monthWeeks(anchor: MonthAnchor): Date[][] {
  const first = new Date(anchor.year, anchor.month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(anchor.year, anchor.month, 1 - offset);
  const daysInMonth = new Date(anchor.year, anchor.month + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  return Array.from({ length: weeks }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + row * 7 + col)),
  );
}
