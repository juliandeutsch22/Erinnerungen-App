// dates.ts — reine Datums-Helfer auf LOKALEN Kalenderdaten ('YYYY-MM-DD').
// Bewusst ohne UTC/toISOString für Kalenderdaten (Fahrplan §8.2): alle
// Umrechnungen laufen über lokale Date-Bestandteile.
import type { Rrule } from '@/data/types';

/** Lokales Kalenderdatum als 'YYYY-MM-DD' (NICHT toISOString — das wäre UTC). */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' → lokales Date (Mitternacht). */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr(now: Date = new Date()): string {
  return toDateStr(now);
}

export function addDays(s: string, n: number): string {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/**
 * Ein Wiederholungsschritt ab `dueDate`. Monat/Jahr klemmen den Tag auf das
 * Monatsende (31.01. → 28./29.02.); der Anker-Tag wird nicht gespeichert —
 * bewusste Vereinfachung (Fahrplan §5: einfaches Enum statt RRULE).
 */
export function nextOccurrence(dueDate: string, rrule: Rrule): string {
  const d = parseDateStr(dueDate);
  switch (rrule) {
    case 'daily':
      return addDays(dueDate, 1);
    case 'weekdays': {
      do {
        d.setDate(d.getDate() + 1);
      } while (d.getDay() === 0 || d.getDay() === 6);
      return toDateStr(d);
    }
    case 'weekly':
      return addDays(dueDate, 7);
    case 'monthly': {
      const day = d.getDate();
      const target = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      target.setDate(Math.min(day, daysInMonth(target.getFullYear(), target.getMonth())));
      return toDateStr(target);
    }
    case 'yearly': {
      const day = d.getDate();
      const target = new Date(d.getFullYear() + 1, d.getMonth(), 1);
      target.setDate(Math.min(day, daysInMonth(target.getFullYear(), target.getMonth())));
      return toDateStr(target);
    }
  }
}

/**
 * Nächstes Vorkommen NACH `today` — überfällige Wiederholungen springen beim
 * Abhaken nicht in die Vergangenheit (5 Tage überfällige Tages-Aufgabe →
 * morgen, nicht vor 4 Tagen).
 */
export function nextOccurrenceAfter(dueDate: string, rrule: Rrule, today: string): string {
  let next = nextOccurrence(dueDate, rrule);
  while (next <= today) next = nextOccurrence(next, rrule);
  return next;
}

/** Nächster Samstag (heute, falls Samstag) — für den „Wochenende"-Chip. */
export function nextWeekend(today: string): string {
  const dow = parseDateStr(today).getDay();
  return addDays(today, (6 - dow + 7) % 7);
}

/** 'HH:MM'-Vergleichbarkeit ist lexikografisch gegeben; hier nur Validierung/Format. */
export function formatTime(t: string): string {
  return `${t} Uhr`;
}

const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** Tages-Überschrift der Wochenvorschau: „Morgen · 4.7." bzw. „Montag · 6.7.". */
export function formatDayHeading(date: string, today: string): string {
  const d = parseDateStr(date);
  const dayLabel = date === addDays(today, 1) ? 'Morgen' : WEEKDAYS_LONG[d.getDay()];
  return `${dayLabel} · ${d.getDate()}.${d.getMonth() + 1}.`;
}

/** Kompakte deutsche Datumsanzeige relativ zu heute: „Heute", „Morgen", „Mi 15.10.". */
export function formatDueDate(dueDate: string, today: string): string {
  if (dueDate === today) return 'Heute';
  if (dueDate === addDays(today, 1)) return 'Morgen';
  if (dueDate === addDays(today, -1)) return 'Gestern';
  const d = parseDateStr(dueDate);
  const sameYear = d.getFullYear() === parseDateStr(today).getFullYear();
  const base = `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
  return sameYear ? base : `${base}${d.getFullYear()}`;
}
