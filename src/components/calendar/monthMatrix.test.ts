// monthMatrix.test.ts — Wochen-Matrix + Gitterbereich (Wochen ab Montag).
import { toDateStr } from '@/lib/dates';

import { monthGridRange, monthWeeks } from './monthMatrix';

describe('monthWeeks / monthGridRange', () => {
  it('Wochen beginnen montags und decken den ganzen Monat ab', () => {
    const weeks = monthWeeks({ year: 2026, month: 6 }); // Juli 2026
    expect(weeks[0][0].getDay()).toBe(1); // erste Zelle = Montag
    weeks.forEach((w) => expect(w.length).toBe(7));
    const daysInMonth = weeks.flat().filter((d) => d.getMonth() === 6).map((d) => d.getDate());
    expect(daysInMonth).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it('monthGridRange deckt sich mit der Wochen-Matrix', () => {
    const a = { year: 2026, month: 6 };
    const weeks = monthWeeks(a);
    const { from, to } = monthGridRange(a);
    expect(from).toBe(toDateStr(weeks[0][0]));
    expect(to).toBe(toDateStr(weeks[weeks.length - 1][6]));
  });

  it('Februar im Schaltjahr 2028 hat 29 Tage', () => {
    const days = monthWeeks({ year: 2028, month: 1 }).flat().filter((d) => d.getMonth() === 1);
    expect(days.length).toBe(29);
  });
});
