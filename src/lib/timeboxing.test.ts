// timeboxing.test.ts — freie Slots im Tag finden (Termine ausschneiden).
import { findFreeSlots, type BusyEvent } from './timeboxing';

const DAY = '2026-07-03';
const ev = (h1: number, m1: number, h2: number, m2: number, allDay = false): BusyEvent => ({
  start: new Date(2026, 6, 3, h1, m1),
  end: new Date(2026, 6, 3, h2, m2),
  allDay,
});

describe('findFreeSlots', () => {
  it('leerer Tag: Slots ab Tagesanfang im Anschluss aneinander', () => {
    expect(findFreeSlots([], DAY, { maxSlots: 3 })).toEqual([
      { start: '08:00', end: '08:30' },
      { start: '08:30', end: '09:00' },
      { start: '09:00', end: '09:30' },
    ]);
  });

  it('springt hinter belegte Termine', () => {
    expect(findFreeSlots([ev(9, 0, 10, 0)], DAY, { maxSlots: 3 })).toEqual([
      { start: '08:00', end: '08:30' },
      { start: '08:30', end: '09:00' },
      { start: '10:00', end: '10:30' },
    ]);
  });

  it('heute: vergangene Zeit wird übersprungen (auf Raster gerundet)', () => {
    const now = new Date(2026, 6, 3, 8, 7);
    expect(findFreeSlots([], DAY, { now, maxSlots: 1 })).toEqual([{ start: '08:15', end: '08:45' }]);
  });

  it('an einem anderen Tag ignoriert now und startet am Tagesanfang', () => {
    const now = new Date(2026, 6, 3, 15, 0);
    expect(findFreeSlots([], '2026-07-04', { now, maxSlots: 1 })).toEqual([{ start: '08:00', end: '08:30' }]);
  });

  it('ganztägige Termine blockieren keine Uhrzeiten', () => {
    expect(findFreeSlots([ev(0, 0, 23, 59, true)], DAY, { maxSlots: 1 })).toEqual([{ start: '08:00', end: '08:30' }]);
  });

  it('überlappende Termine werden verschmolzen', () => {
    const slots = findFreeSlots([ev(9, 0, 10, 30), ev(10, 0, 11, 0)], DAY, { maxSlots: 3 });
    expect(slots).toEqual([
      { start: '08:00', end: '08:30' },
      { start: '08:30', end: '09:00' },
      { start: '11:00', end: '11:30' },
    ]);
  });

  it('Termin, der vor dem Fenster beginnt, wird auf das Fenster geklemmt', () => {
    expect(findFreeSlots([ev(6, 0, 8, 30)], DAY, { maxSlots: 1 })).toEqual([{ start: '08:30', end: '09:00' }]);
  });

  it('kein Slot mehr, wenn der Rest des Tages voll ist', () => {
    const now = new Date(2026, 6, 3, 20, 45);
    expect(findFreeSlots([], DAY, { now })).toEqual([]);
  });
});
