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

/** Zerlegt die erweiterten Formen ('every:2w', 'after:3d'). null = festes Preset. */
export function parseRrule(rrule: Rrule): { kind: 'every' | 'after'; n: number; unit: 'd' | 'w' | 'm' } | null {
  const every = /^every:(\d+)([dwm])$/.exec(rrule);
  if (every) return { kind: 'every', n: Number(every[1]), unit: every[2] as 'd' | 'w' | 'm' };
  const after = /^after:(\d+)d$/.exec(rrule);
  if (after) return { kind: 'after', n: Number(after[1]), unit: 'd' };
  return null;
}

/** Gilt die Wiederholung ab dem ERLEDIGEN (statt ab dem Fälligkeitsdatum)? */
export function isAfterCompletionRule(rrule: Rrule): boolean {
  return parseRrule(rrule)?.kind === 'after';
}

/** Ist die Zeichenkette eine gültige Wiederholung? (Backup-/Import-Prüfung) */
export function isRrule(v: unknown): v is Rrule {
  if (typeof v !== 'string') return false;
  if (['daily', 'weekdays', 'weekly', 'monthly', 'yearly'].includes(v)) return true;
  const p = parseRrule(v as Rrule);
  return p !== null && p.n >= 1 && p.n <= 999;
}

/** Menschliche Beschriftung — eine Quelle für Editor und Zeile. */
export function rruleLabel(rrule: Rrule): string {
  const p = parseRrule(rrule);
  if (p?.kind === 'after') {
    if (p.n === 1) return '1 Tag nach Erledigen';
    if (p.n === 7) return '1 Woche nach Erledigen';
    if (p.n === 30) return '1 Monat nach Erledigen';
    return `${p.n} Tage nach Erledigen`;
  }
  if (p?.kind === 'every') {
    const unit = p.unit === 'd' ? ['Tag', 'Tage'] : p.unit === 'w' ? ['Woche', 'Wochen'] : ['Monat', 'Monate'];
    return p.n === 1 ? `Jede${p.unit === 'm' ? 'n' : ''} ${unit[0]}` : `Alle ${p.n} ${unit[1]}`;
  }
  switch (rrule) {
    case 'daily':
      return 'Täglich';
    case 'weekdays':
      return 'Werktags';
    case 'weekly':
      return 'Wöchentlich';
    case 'monthly':
      return 'Monatlich';
    default:
      return 'Jährlich';
  }
}

/** n Monate weiter, Tag aufs Monatsende geklemmt (31.01. + 1 Monat → 28./29.02.). */
export function addMonths(dueDate: string, n: number): string {
  const d = parseDateStr(dueDate);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  target.setDate(Math.min(day, daysInMonth(target.getFullYear(), target.getMonth())));
  return toDateStr(target);
}

/**
 * Ein Wiederholungsschritt ab `dueDate`. Monat/Jahr klemmen den Tag auf das
 * Monatsende (31.01. → 28./29.02.); der Anker-Tag wird nicht gespeichert.
 */
export function nextOccurrence(dueDate: string, rrule: Rrule): string {
  const p = parseRrule(rrule);
  if (p) {
    // „nach Erledigung" hat ab einem Datum keinen eigenen Rhythmus — die
    // Fälligkeit entsteht erst beim Abhaken (siehe resolveCompletion).
    if (p.kind === 'after') return addDays(dueDate, p.n);
    if (p.unit === 'd') return addDays(dueDate, p.n);
    if (p.unit === 'w') return addDays(dueDate, p.n * 7);
    return addMonths(dueDate, p.n);
  }
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
    case 'monthly':
      return addMonths(dueDate, 1);
    // 'yearly' als default: der Typ umfasst jetzt auch die erweiterten Formen
    // (oben bereits behandelt), darum kein erschöpfendes switch mehr möglich.
    default: {
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

/** Ganze Kalendertage von `from` bis `to` (positiv = to liegt später). */
export function daysBetween(from: string, to: string): number {
  const ms = parseDateStr(to).getTime() - parseDateStr(from).getTime();
  return Math.round(ms / 86400000);
}

/** Projekt-Deadline relativ zu heute: „heute fällig", „noch 3 Tage", „2 Tage überfällig". */
export function deadlineLabel(deadline: string, today: string): string {
  const d = daysBetween(today, deadline);
  if (d === 0) return 'heute fällig';
  if (d === 1) return 'morgen fällig';
  if (d > 1) return `noch ${d} Tage`;
  if (d === -1) return '1 Tag überfällig';
  return `${-d} Tage überfällig`;
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
