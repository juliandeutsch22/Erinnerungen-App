// calendarLogic.ts — reine Ableitungen für die Kalenderansicht (testbar ohne
// EventKit): welche lokalen Tage deckt ein Termin ab, Buckets pro Tag, Labels.
import type { List } from '@/data/types';
import { addDays, toDateStr } from '@/lib/dates';

export type SpanLike = { start: Date; end: Date; allDay: boolean };

/**
 * Lokale Kalendertage ('YYYY-MM-DD'), die ein Termin berührt. Ganztägige
 * Termine liefern ihr Ende exklusiv bzw. auf Mitternacht — eine Endzeit von
 * exakt 00:00 zählt deshalb nicht als weiterer Tag. Kappung nach 62 Tagen.
 */
export function eventDays(span: SpanLike): string[] {
  const first = toDateStr(span.start);
  let last = toDateStr(span.end);
  const endsAtMidnight =
    span.end.getHours() === 0 && span.end.getMinutes() === 0 && span.end.getSeconds() === 0;
  if (endsAtMidnight && last > first) last = toDateStr(new Date(span.end.getTime() - 1));
  if (last < first) last = first;

  const days: string[] = [];
  let cursor = first;
  while (cursor <= last && days.length < 62) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Buckets pro Tag im Fenster [from..to] — mehrtägige Termine erscheinen an jedem Tag. */
export function bucketEventsByDay<T extends SpanLike>(events: T[], from: string, to: string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const ev of events) {
    for (const day of eventDays(ev)) {
      if (day < from || day > to) continue;
      const arr = map.get(day) ?? [];
      arr.push(ev);
      map.set(day, arr);
    }
  }
  // Innerhalb eines Tages: ganztägig zuerst, dann chronologisch.
  for (const arr of map.values()) {
    arr.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.start.getTime() - b.start.getTime();
    });
  }
  return map;
}

function hm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Zeit-Label eines Termins für den angezeigten Tag: „Ganztägig", „09:00 – 10:30", „bis 14:00". */
export function eventTimeLabel(span: SpanLike, day: string): string {
  if (span.allDay) return 'Ganztägig';
  const startDay = toDateStr(span.start);
  const endDay = toDateStr(span.end);
  if (startDay === endDay) return `${hm(span.start)} – ${hm(span.end)}`;
  if (day === startDay) return `ab ${hm(span.start)}`;
  if (day === endDay) return `bis ${hm(span.end)}`;
  return 'Ganztägig';
}

/**
 * Projekt-Deadlines im Zeitfenster, nach Tag gebündelt. Listen mit Deadline
 * sind Projekte — bisher wusste der Kalender nichts davon. Papierkorb-Listen
 * zählen nicht mit.
 */
export function deadlinesByDay(lists: List[], from: string, to: string): Map<string, List[]> {
  const map = new Map<string, List[]>();
  for (const l of lists) {
    if (l.deletedAt || !l.deadline) continue;
    if (l.deadline < from || l.deadline > to) continue;
    const arr = map.get(l.deadline) ?? [];
    arr.push(l);
    map.set(l.deadline, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return map;
}
