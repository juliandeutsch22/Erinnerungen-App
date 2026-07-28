// dates.ts — reine Datums-Helfer auf LOKALEN Kalenderdaten ('YYYY-MM-DD').
// Bewusst ohne UTC/toISOString für Kalenderdaten (Fahrplan §8.2): alle
// Umrechnungen laufen über lokale Date-Bestandteile.
import type { Rrule, RruleUnit } from '@/data/types';

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
export function parseRrule(rrule: Rrule): { kind: 'every' | 'after'; n: number; unit: RruleUnit } | null {
  const m = /^(every|after):(\d+)([dwmy])$/.exec(rrule);
  if (!m) return null;
  return { kind: m[1] as 'every' | 'after', n: Number(m[2]), unit: m[3] as RruleUnit };
}

/**
 * Baut eine Wiederholung aus den Bausteinen des Editors. Bei n = 1 und festem
 * Rhythmus entsteht bewusst das PRESET ('daily' …) — so bleiben gespeicherte
 * Werte kanonisch und alte Aufgaben unverändert lesbar.
 */
export function buildRrule(n: number, unit: RruleUnit, afterCompletion: boolean): Rrule {
  const k = Math.max(1, Math.min(999, Math.round(n) || 1));
  if (afterCompletion) return `after:${k}${unit}`;
  if (k === 1) return unit === 'd' ? 'daily' : unit === 'w' ? 'weekly' : unit === 'm' ? 'monthly' : 'yearly';
  return `every:${k}${unit}`;
}

/**
 * Umkehrung für den Editor: welche Bausteine stecken in der Regel?
 * null = lässt sich nicht als „alle n X" darstellen (nur 'weekdays').
 */
export function rruleParts(rrule: Rrule | null): { n: number; unit: RruleUnit; after: boolean } | null {
  if (!rrule) return null;
  const p = parseRrule(rrule);
  if (p) return { n: p.n, unit: p.unit, after: p.kind === 'after' };
  switch (rrule) {
    case 'daily':
      return { n: 1, unit: 'd', after: false };
    case 'weekly':
      return { n: 1, unit: 'w', after: false };
    case 'monthly':
      return { n: 1, unit: 'm', after: false };
    case 'yearly':
      return { n: 1, unit: 'y', after: false };
    default:
      return null; // 'weekdays'
  }
}

/** Gilt die Wiederholung ab dem ERLEDIGEN (statt ab dem Fälligkeitsdatum)? */
export function isAfterCompletionRule(rrule: Rrule): boolean {
  return parseRrule(rrule)?.kind === 'after';
}

/** Ist die Zeichenkette eine gültige Wiederholung? (Backup-/Import-Prüfung) */
export function isRrule(v: unknown): v is Rrule {
  if (typeof v !== 'string') return false;
  if (['daily', 'weekdays', 'weekly', 'monthly', 'yearly'].includes(v)) return true;
  if (parseWeekdays(v as Rrule) !== null) return true;
  const p = parseRrule(v as Rrule);
  return p !== null && p.n >= 1 && p.n <= 999;
}

/** Kürzel der Wochentage in JS-Reihenfolge (0 = Sonntag). */
export const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;
/** Anzeige-Reihenfolge: die deutsche Woche beginnt am Montag. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Feste Wochentage aus 'wd:1,4' lesen — aufsteigend, ohne Dubletten.
 * null, wenn es keine solche Regel ist ODER sie unbrauchbar wäre (leer,
 * Zahl außerhalb 0–6): eine kaputte Wiederholung soll wie „keine" wirken,
 * nicht wie eine, die nie wieder fällig wird.
 */
export function parseWeekdays(rrule: Rrule | string): number[] | null {
  if (typeof rrule !== 'string' || !rrule.startsWith('wd:')) return null;
  const teile = rrule.slice(3).split(',').filter((t) => t.length > 0);
  if (teile.length === 0) return null;
  const tage: number[] = [];
  for (const t of teile) {
    if (!/^[0-6]$/.test(t)) return null;
    const n = Number(t);
    if (!tage.includes(n)) tage.push(n);
  }
  return tage.sort((a, b) => a - b);
}

/**
 * Wochentage → Regel. Mo–Fr ergibt bewusst das PRESET 'weekdays' (wie
 * buildRrule bei n = 1): gespeicherte Werte bleiben kanonisch, und alte
 * Aufgaben lesen sich unverändert. Leere Auswahl = keine Wiederholung.
 */
export function buildWeekdayRrule(tage: number[]): Rrule | null {
  const rein = [...new Set(tage.filter((t) => t >= 0 && t <= 6))].sort((a, b) => a - b);
  if (rein.length === 0) return null;
  if (rein.join(',') === '1,2,3,4,5') return 'weekdays';
  return `wd:${rein.join(',')}`;
}

/** Trifft die Regel feste Wochentage? ('weekdays' ist die Mo–Fr-Fassung davon.) */
export function isWeekdayRule(rrule: Rrule | null): boolean {
  return rrule === 'weekdays' || parseWeekdays(rrule ?? '') !== null;
}

/** Die Wochentage einer Regel — auch für 'weekdays'. Sonst leer. */
export function weekdaysOf(rrule: Rrule | null): number[] {
  if (rrule === 'weekdays') return [1, 2, 3, 4, 5];
  return parseWeekdays(rrule ?? '') ?? [];
}

const UNIT_WORDS: Record<RruleUnit, [string, string]> = {
  d: ['Tag', 'Tage'],
  w: ['Woche', 'Wochen'],
  m: ['Monat', 'Monate'],
  y: ['Jahr', 'Jahre'],
};

/** „Alle 2 Wochen", „Täglich", „3 Tage nach Erledigen" — eine Quelle für alles. */
export function rruleLabel(rrule: Rrule): string {
  if (rrule === 'weekdays') return 'Werktags';
  const feste = parseWeekdays(rrule);
  // „Mo + Do" bei zweien, sonst „Mo, Mi, Fr" — in der Reihenfolge der Woche,
  // nicht in der von JS (die fängt sonntags an).
  if (feste) {
    const namen = WEEKDAY_ORDER.filter((t) => feste.includes(t)).map((t) => WEEKDAY_SHORT[t]);
    if (namen.length === 1) return `Jeden ${namen[0]}`;
    if (namen.length === 2) return `${namen[0]} + ${namen[1]}`;
    return namen.join(', ');
  }
  const p = rruleParts(rrule);
  if (!p) return 'Werktags';
  const [one, many] = UNIT_WORDS[p.unit];
  // Bei „nach Erledigen" steht die Zahl immer mit — „1 Woche nach Erledigen"
  // liest sich rund, „Woche nach Erledigen" nicht.
  if (p.after) return `${p.n} ${p.n === 1 ? one : many} nach Erledigen`;
  const spanne = p.n === 1 ? one : `${p.n} ${many}`;
  if (p.n === 1) {
    return p.unit === 'd' ? 'Täglich' : p.unit === 'w' ? 'Wöchentlich' : p.unit === 'm' ? 'Monatlich' : 'Jährlich';
  }
  return `Alle ${spanne}`;
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
    if (p.unit === 'd') return addDays(dueDate, p.n);
    if (p.unit === 'w') return addDays(dueDate, p.n * 7);
    if (p.unit === 'm') return addMonths(dueDate, p.n);
    return addMonths(dueDate, p.n * 12);
  }
  const d = parseDateStr(dueDate);
  const feste = parseWeekdays(rrule);
  if (feste) {
    // Tagweise vorrücken bis zum nächsten gewählten Wochentag. Höchstens
    // sieben Schritte — mehr kann es nicht sein, und so gibt es keine
    // Endlosschleife, falls je eine leere Menge durchrutscht.
    for (let i = 0; i < 7; i += 1) {
      d.setDate(d.getDate() + 1);
      if (feste.includes(d.getDay())) return toDateStr(d);
    }
    return addDays(dueDate, 7);
  }
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
