// dates.test.ts — Wiederholungs-Berechnung + lokale Kalenderdaten (Fahrplan M1).
import { addDays, formatDueDate, nextOccurrence, nextOccurrenceAfter, parseDateStr, toDateStr } from './dates';

describe('toDateStr/parseDateStr', () => {
  it('läuft lokal rund (kein UTC-Versatz)', () => {
    expect(toDateStr(parseDateStr('2026-07-03'))).toBe('2026-07-03');
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('nextOccurrence', () => {
  it('daily: +1 Tag', () => {
    expect(nextOccurrence('2026-07-03', 'daily')).toBe('2026-07-04');
  });

  it('weekdays: Freitag → Montag', () => {
    // 2026-07-03 ist ein Freitag
    expect(parseDateStr('2026-07-03').getDay()).toBe(5);
    expect(nextOccurrence('2026-07-03', 'weekdays')).toBe('2026-07-06');
    expect(nextOccurrence('2026-07-01', 'weekdays')).toBe('2026-07-02');
  });

  it('weekly: +7 Tage', () => {
    expect(nextOccurrence('2026-07-03', 'weekly')).toBe('2026-07-10');
  });

  it('monthly: klemmt auf Monatsende', () => {
    expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextOccurrence('2028-01-31', 'monthly')).toBe('2028-02-29'); // Schaltjahr
    expect(nextOccurrence('2026-08-01', 'monthly')).toBe('2026-09-01'); // „Miete am 1."
  });

  it('yearly: 29.02. → 28.02. im Nicht-Schaltjahr', () => {
    expect(nextOccurrence('2028-02-29', 'yearly')).toBe('2029-02-28');
    expect(nextOccurrence('2026-07-03', 'yearly')).toBe('2027-07-03');
  });
});

describe('nextOccurrenceAfter', () => {
  it('überfällige tägliche Aufgabe springt auf morgen, nicht in die Vergangenheit', () => {
    expect(nextOccurrenceAfter('2026-06-28', 'daily', '2026-07-03')).toBe('2026-07-04');
  });

  it('monatlicher Anker bleibt erhalten (1. des Folgemonats)', () => {
    expect(nextOccurrenceAfter('2026-07-01', 'monthly', '2026-07-03')).toBe('2026-08-01');
  });

  it('nicht überfällig: einfach nächster Schritt', () => {
    expect(nextOccurrenceAfter('2026-07-03', 'weekly', '2026-07-03')).toBe('2026-07-10');
  });
});

describe('formatDueDate', () => {
  it('relativ zu heute', () => {
    expect(formatDueDate('2026-07-03', '2026-07-03')).toBe('Heute');
    expect(formatDueDate('2026-07-04', '2026-07-03')).toBe('Morgen');
    expect(formatDueDate('2026-07-02', '2026-07-03')).toBe('Gestern');
    expect(formatDueDate('2026-07-15', '2026-07-03')).toBe('Mi 15.7.');
    expect(formatDueDate('2027-01-04', '2026-07-03')).toBe('Mo 4.1.2027');
  });
});
