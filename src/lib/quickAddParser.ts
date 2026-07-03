// quickAddParser.ts — deutscher Mini-Parser für die Quick-Add-Zeile (Fahrplan §3.4):
// „Milch morgen", „Miete am 1. jeden monat", „Anruf mo 9:00" → Datum/Uhrzeit/
// Wiederholung werden erkannt und aus dem Titel entfernt. Reine Funktion, testbar.
import type { Rrule } from '@/data/types';
import { addDays, parseDateStr, toDateStr } from '@/lib/dates';

export type QuickAddResult = {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  rrule: Rrule | null;
};

const WEEKDAYS: Record<string, number> = {
  mo: 1, montag: 1,
  di: 2, dienstag: 2,
  mi: 3, mittwoch: 3,
  do: 4, donnerstag: 4,
  fr: 5, freitag: 5,
  sa: 6, samstag: 6,
  so: 0, sonntag: 0,
};
const WEEKDAY_ALTS = 'montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|mo|di|mi|do|fr|sa|so';

/** Nächstes Vorkommen des Wochentags NACH heute (heute gemeint → „heute" tippen). */
function nextWeekday(today: string, targetDow: number): string {
  const dow = parseDateStr(today).getDay();
  const delta = ((targetDow - dow + 7) % 7) || 7;
  return addDays(today, delta);
}

/** Nächstes Vorkommen von Tag/Monat ab heute (dieses Jahr, sonst nächstes). */
function nextDayMonth(today: string, day: number, month: number, year?: number): string {
  const t = parseDateStr(today);
  if (year !== undefined) {
    const full = year < 100 ? 2000 + year : year;
    return toDateStr(new Date(full, month - 1, day));
  }
  const candidate = new Date(t.getFullYear(), month - 1, day);
  if (toDateStr(candidate) < today) candidate.setFullYear(candidate.getFullYear() + 1);
  return toDateStr(candidate);
}

/** Nächstes Vorkommen eines Monatstags („am 1.") ab heute. */
function nextDayOfMonth(today: string, day: number): string {
  const t = parseDateStr(today);
  const candidate = new Date(t.getFullYear(), t.getMonth(), Math.min(day, 31));
  candidate.setDate(day);
  if (candidate.getDate() !== day || toDateStr(candidate) < today) {
    const next = new Date(t.getFullYear(), t.getMonth() + 1, 1);
    next.setDate(day);
    return toDateStr(next);
  }
  return toDateStr(candidate);
}

export function parseQuickAdd(input: string, today: string): QuickAddResult {
  let text = ` ${input} `; // Ränder, damit \s-basierte Muster auch am Anfang/Ende greifen
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let rrule: Rrule | null = null;

  const strip = (re: RegExp, onMatch: (m: RegExpMatchArray) => void): void => {
    const m = text.match(re);
    if (m) {
      onMatch(m);
      text = text.replace(re, ' ');
    }
  };

  // 1. Wiederholung (vor Wochentag/Datum, weil „jeden montag" beides enthält).
  strip(/(?<=\s)(jeden tag|täglich)(?=[\s,.!]|$)/i, () => { rrule = 'daily'; });
  strip(/(?<=\s)(an werktagen|jeden werktag|werktags)(?=[\s,.!]|$)/i, () => { rrule = 'weekdays'; });
  strip(new RegExp(`(?<=\\s)jede[nm]?\\s+(${WEEKDAY_ALTS})(?=[\\s,.!]|$)`, 'i'), (m) => {
    rrule = 'weekly';
    dueDate = nextWeekday(today, WEEKDAYS[m[1].toLowerCase()]);
  });
  strip(/(?<=\s)(jede woche|wöchentlich)(?=[\s,.!]|$)/i, () => { rrule = 'weekly'; });
  strip(/(?<=\s)(jeden monat|monatlich)(?=[\s,.!]|$)/i, () => { rrule = 'monthly'; });
  strip(/(?<=\s)(jedes jahr|jährlich)(?=[\s,.!]|$)/i, () => { rrule = 'yearly'; });

  // 2. Explizites Datum „15.8." / „15.08.2026" / „am 15.8."
  strip(/(?<=\s)(?:am\s+)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?=[\s,!]|$)/i, (m) => {
    dueDate = nextDayMonth(today, Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined);
  });

  // 2b. Nur Monatstag „am 1." (typisch mit „jeden monat").
  strip(/(?<=\s)am\s+(\d{1,2})\.(?=[\s,!]|$)/i, (m) => {
    if (!dueDate) dueDate = nextDayOfMonth(today, Number(m[1]));
  });

  // 3. Relativ: heute / morgen / übermorgen.
  strip(/(?<=\s)übermorgen(?=[\s,.!]|$)/i, () => { dueDate = dueDate ?? addDays(today, 2); });
  strip(/(?<=\s)morgen(?=[\s,.!]|$)/i, () => { dueDate = dueDate ?? addDays(today, 1); });
  strip(/(?<=\s)heute(?=[\s,.!]|$)/i, () => { dueDate = dueDate ?? today; });

  // 4. Wochentag („mo", „montag") → nächstes Vorkommen.
  strip(new RegExp(`(?<=\\s)(${WEEKDAY_ALTS})(?=[\\s,.!]|$)`, 'i'), (m) => {
    if (!dueDate) dueDate = nextWeekday(today, WEEKDAYS[m[1].toLowerCase()]);
    else text = text; // Datum schon gesetzt → Treffer trotzdem entfernen
  });

  // 5. Uhrzeit „9:30", „9.30 uhr", „9 uhr", „um 9 uhr".
  strip(/(?<=\s)(?:um\s+)?(\d{1,2}):(\d{2})(?:\s*uhr)?(?=[\s,.!]|$)/i, (m) => {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 24 && min < 60) dueTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  });
  strip(/(?<=\s)(?:um\s+)?(\d{1,2})\s+uhr(?=[\s,.!]|$)/i, (m) => {
    const h = Number(m[1]);
    if (!dueTime && h < 24) dueTime = `${String(h).padStart(2, '0')}:00`;
  });

  // Uhrzeit oder Wiederholung ohne Datum → heute.
  if (!dueDate && (dueTime || rrule)) dueDate = today;

  const title = text.replace(/\s+/g, ' ').replace(/\s+([,.!])/g, '$1').trim().replace(/^[,\s]+|[,\s]+$/g, '');
  return { title, dueDate, dueTime, rrule };
}
