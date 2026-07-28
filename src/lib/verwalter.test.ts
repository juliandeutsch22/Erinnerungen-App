import { buildWeekPlanContext, weekReviewDue, weekWindow } from './verwalter';

describe('weekWindow', () => {
  it('spannt heute plus sieben Tage auf', () => {
    expect(weekWindow('2026-07-27')).toMatchObject({ von: '2026-07-27', bis: '2026-08-03' });
    expect(weekWindow('2026-07-27').label).toContain('Montag');
  });
});

describe('weekReviewDue', () => {
  // Die Einladung erscheint sonntags — und montags früh als Nachzügler.
  // Jeden Tag sichtbar wäre sie eine Mahnung, und das verletzt „kein Druck".
  it('sonntags den ganzen Tag', () => {
    expect(weekReviewDue('2026-07-26', 8)).toBe(true); // Sonntag
    expect(weekReviewDue('2026-07-26', 22)).toBe(true);
  });

  it('montags nur bis mittags', () => {
    expect(weekReviewDue('2026-07-27', 9)).toBe(true); // Montag
    expect(weekReviewDue('2026-07-27', 15)).toBe(false);
  });

  it('an den übrigen Tagen nie', () => {
    for (const d of ['2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01']) {
      expect(weekReviewDue(d, 9)).toBe(false);
    }
  });
});

describe('buildWeekPlanContext', () => {
  const ctx = buildWeekPlanContext('2026-07-27');

  it('nennt das heutige Datum, damit „nächste Woche" verankert ist', () => {
    expect(ctx).toContain('2026-07-27');
    expect(ctx).toContain('Montag');
  });

  it('verbietet Zählen und Bewerten — das ist die Leitplanke „kein Druck"', () => {
    expect(ctx).toContain('Zähle nichts aus und bewerte nicht');
    expect(ctx).toContain('Keine Prozente');
    expect(ctx).toContain('kein Lob und kein Tadel');
    expect(ctx).toContain('NÄCHSTE Woche nicht aufgeht');
  });

  it('deckelt die Menge — fünf Zeilen, keine Wand', () => {
    expect(ctx).toContain('HÖCHSTENS fünf');
  });

  it('verlangt, dass jede vorgeschlagene Änderung begründet ist', () => {
    expect(ctx).toContain('muss zu einer');
    expect(ctx).toContain('schlage kein "erledigt" vor');
  });
});
