// timeboxing.ts — findet freie Lücken im Tag, um eine Aufgabe konkret
// „einzuplanen" (Horizont 1). Reine Logik über die Termine des Gerätekalenders:
// belegte Zeiten werden ausgeschnitten, aus dem Rest werden ein paar konkrete
// Slot-Vorschläge (z. B. „14:00–14:30") gebildet. Kein Schreibzugriff, kein UI.
//
// Der Kalender wird nur GELESEN — die Aufgabe bekommt einfach eine Uhrzeit in
// echter freier Zeit. So bleibt alles im lokalen Datenmodell (keine neuen
// Rechte, kein Sync), und die App fühlt sich trotzdem an wie ein Planer.
import { parseDateStr, toDateStr } from '@/lib/dates';

/** Nur die Zeitfelder eines Termins — testbar ohne den vollen DeviceEvent. */
export type BusyEvent = { start: Date; end: Date; allDay: boolean };

export type Slot = { start: string; end: string };

export type SlotOptions = {
  /** „Jetzt" — für heute werden vergangene Zeiten übersprungen. */
  now?: Date;
  /** Tagesfenster in Minuten ab Mitternacht (Standard 08:00–21:00). */
  dayStartMin?: number;
  dayEndMin?: number;
  /** Blockdauer in Minuten (Standard 30). */
  durationMin?: number;
  /** Raster, auf das Startzeiten fallen (Standard 15). */
  stepMin?: number;
  /** Maximale Anzahl Vorschläge. */
  maxSlots?: number;
};

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/** Belegte [start,end]-Intervalle (Minuten) eines Tages; allDay wird ignoriert. */
function busyIntervals(events: BusyEvent[], day: string, dayStartMin: number, dayEndMin: number): [number, number][] {
  const midnight = parseDateStr(day).getTime();
  const out: [number, number][] = [];
  for (const e of events) {
    if (e.allDay) continue;
    const s = Math.max(dayStartMin, Math.round((e.start.getTime() - midnight) / 60000));
    const en = Math.min(dayEndMin, Math.round((e.end.getTime() - midnight) / 60000));
    if (en > s) out.push([s, en]);
  }
  out.sort((a, b) => a[0] - b[0]);
  // Überlappende/angrenzende Intervalle verschmelzen.
  const merged: [number, number][] = [];
  for (const iv of out) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else merged.push([iv[0], iv[1]]);
  }
  return merged;
}

/**
 * Konkrete freie Slots für `day`. Berücksichtigt belegte Termine, das
 * Tagesfenster und (für heute) die aktuelle Uhrzeit. Reine Funktion.
 */
export function findFreeSlots(events: BusyEvent[], day: string, opts: SlotOptions = {}): Slot[] {
  const dayStartMin = opts.dayStartMin ?? 8 * 60;
  const dayEndMin = opts.dayEndMin ?? 21 * 60;
  const duration = opts.durationMin ?? 30;
  const step = opts.stepMin ?? 15;
  const maxSlots = opts.maxSlots ?? 4;

  const busy = busyIntervals(events, day, dayStartMin, dayEndMin);

  let earliest = dayStartMin;
  if (opts.now && toDateStr(opts.now) === day) {
    const nowMin = opts.now.getHours() * 60 + opts.now.getMinutes();
    earliest = Math.max(dayStartMin, ceilTo(nowMin, step));
  }

  const slots: Slot[] = [];
  let start = earliest;
  while (start + duration <= dayEndMin && slots.length < maxSlots) {
    const end = start + duration;
    const clash = busy.find((iv) => start < iv[1] && end > iv[0]);
    if (clash) {
      // In die nächste Rasterzeit nach dem Konflikt springen.
      start = ceilTo(clash[1], step);
    } else {
      slots.push({ start: minToHHMM(start), end: minToHHMM(end) });
      start = end; // nächster Vorschlag direkt im Anschluss → gut verteilt
    }
  }
  return slots;
}
