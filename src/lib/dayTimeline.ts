// dayTimeline.ts — verschmilzt Termine (mit Uhrzeit) und Aufgaben (mit Uhrzeit)
// eines Tages zu EINEM chronologischen Ablauf: aus „zwei Stapeln" wird ein Plan.
// Reine Logik, testbar ohne UI. Ganztägige Termine gehören nicht in die Timeline
// (kein Zeit-Slot) und werden ausgelassen.
import type { Task } from '@/data/types';
import { parseDateStr } from '@/lib/dates';
import type { DeviceEvent } from '@/lib/deviceCalendar';

export type TimelineEntry = {
  key: string;
  /** Startminute des Tages (0–1439) — Sortier-/Positionsschlüssel. */
  sortMin: number;
  /** Anzeige-Startzeit 'HH:MM'. */
  time: string;
  /** Anzeige-Endzeit (nur Termine). */
  end?: string;
} & ({ kind: 'event'; event: DeviceEvent } | { kind: 'task'; task: Task });

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function minToHHMM(min: number): string {
  const m = Math.max(0, Math.min(1439, min));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
function hhmmToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesOnDay(d: Date, day: string): number {
  return Math.round((d.getTime() - parseDateStr(day).getTime()) / 60000);
}

/** Chronologischer Tagesablauf aus Terminen + Aufgaben mit Uhrzeit. */
export function buildDayTimeline(events: DeviceEvent[], tasks: Task[], day: string): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const ev of events) {
    if (ev.allDay) continue;
    const s = Math.max(0, Math.min(1439, minutesOnDay(ev.start, day)));
    const e = Math.max(0, Math.min(1440, minutesOnDay(ev.end, day)));
    out.push({ key: `e:${ev.key}`, sortMin: s, time: minToHHMM(s), end: minToHHMM(e), kind: 'event', event: ev });
  }
  for (const t of tasks) {
    if (t.dueDate !== day || !t.dueTime) continue;
    const s = hhmmToMin(t.dueTime);
    out.push({ key: `t:${t.id}`, sortMin: s, time: t.dueTime, kind: 'task', task: t });
  }
  // Nach Startzeit; bei Gleichstand Termine vor Aufgaben.
  out.sort((a, b) => a.sortMin - b.sortMin || (a.kind === b.kind ? 0 : a.kind === 'event' ? -1 : 1));
  return out;
}

/** Position des „Jetzt"-Markers: vor dem ersten Eintrag, der ab jetzt liegt. */
export function nowMarkerIndex(entries: TimelineEntry[], nowMin: number): number {
  const i = entries.findIndex((e) => e.sortMin >= nowMin);
  return i === -1 ? entries.length : i;
}
