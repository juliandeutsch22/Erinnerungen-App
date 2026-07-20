// journalLogic.test.ts — die stille Kette der Abendbetrachtung.
import type { JournalEntry } from '@/data/JournalRepository';

import { journalStreak } from './journalLogic';

const e = (date: string, text = 'Guter Tag.'): JournalEntry => ({
  id: date, date, text, createdAt: `${date}T21:00:00.000Z`, updatedAt: `${date}T21:00:00.000Z`,
});

describe('journalStreak', () => {
  const today = '2026-07-20';
  it('zählt bis heute — oder bis gestern, wenn heute noch offen ist', () => {
    expect(journalStreak([e('2026-07-18'), e('2026-07-19'), e('2026-07-20')], today)).toBe(3);
    expect(journalStreak([e('2026-07-18'), e('2026-07-19')], today)).toBe(2);
  });
  it('Lücke bricht die Kette; leere Texte zählen nicht', () => {
    expect(journalStreak([e('2026-07-17'), e('2026-07-19')], today)).toBe(1);
    expect(journalStreak([e('2026-07-20', '  ')], today)).toBe(0);
    expect(journalStreak([], today)).toBe(0);
  });
});
