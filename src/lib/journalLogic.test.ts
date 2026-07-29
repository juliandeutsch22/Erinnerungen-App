// journalLogic.test.ts — die stille Kette der Abendbetrachtung.
import type { JournalEntry } from '@/data/JournalRepository';

import { groupJournal, journalStreak } from './journalLogic';

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

describe('groupJournal', () => {
  it('gliedert in Jahre und Monate, überall neueste zuerst', () => {
    const g = groupJournal([
      e('2025-12-31'),
      e('2026-07-02'),
      e('2026-07-20'),
      e('2026-06-15'),
      e('2025-01-05'),
    ]);
    expect(g.map((j) => j.key)).toEqual(['2026', '2025']);
    expect(g[0].monate.map((m) => m.key)).toEqual(['2026-07', '2026-06']);
    // Innerhalb des Monats ebenfalls neueste zuerst.
    expect(g[0].monate[0].eintraege.map((x) => x.date)).toEqual(['2026-07-20', '2026-07-02']);
    expect(g[1].monate.map((m) => m.label)).toEqual(['Dezember', 'Januar']);
  });

  it('zählt je Jahr und benennt die Monate deutsch', () => {
    const g = groupJournal([e('2026-03-01'), e('2026-03-02'), e('2026-11-09')]);
    expect(g[0].anzahl).toBe(3);
    expect(g[0].monate.map((m) => m.label)).toEqual(['November', 'März']);
  });

  it('leere Einträge erzeugen keine Überschrift', () => {
    expect(groupJournal([e('2026-05-01', '   ')])).toEqual([]);
    const g = groupJournal([e('2026-05-01', '  '), e('2026-05-02', 'Da.')]);
    expect(g).toHaveLength(1);
    expect(g[0].monate[0].eintraege).toHaveLength(1);
  });

  it('kommt mit einem leeren Bestand klar', () => {
    expect(groupJournal([])).toEqual([]);
  });
});
