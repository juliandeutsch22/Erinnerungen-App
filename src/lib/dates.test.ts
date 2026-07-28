// dates.test.ts — Wiederholungs-Berechnung + lokale Kalenderdaten (Fahrplan M1).
import { anchorWeekdayRrule, addDays, addMonths, buildRrule, daysBetween, deadlineLabel, formatDueDate, isRrule, nextOccurrence, nextOccurrenceAfter, parseDateStr, parseRrule, rruleLabel, rruleParts, toDateStr, parseWeekdays, buildWeekdayRrule, isWeekdayRule, weekdaysOf} from './dates';

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

describe('daysBetween', () => {
  it('positiv vorwärts, negativ rückwärts, 0 gleich', () => {
    expect(daysBetween('2026-07-03', '2026-07-06')).toBe(3);
    expect(daysBetween('2026-07-06', '2026-07-03')).toBe(-3);
    expect(daysBetween('2026-07-03', '2026-07-03')).toBe(0);
  });

  it('rechnet über Monatsgrenzen korrekt', () => {
    expect(daysBetween('2026-07-30', '2026-08-02')).toBe(3);
  });
});

describe('deadlineLabel', () => {
  const today = '2026-07-03';
  it('heute / morgen / später / überfällig', () => {
    expect(deadlineLabel('2026-07-03', today)).toBe('heute fällig');
    expect(deadlineLabel('2026-07-04', today)).toBe('morgen fällig');
    expect(deadlineLabel('2026-07-06', today)).toBe('noch 3 Tage');
    expect(deadlineLabel('2026-07-02', today)).toBe('1 Tag überfällig');
    expect(deadlineLabel('2026-06-30', today)).toBe('3 Tage überfällig');
  });
});

describe('flexible Wiederholungen — Parsen & Beschriftung', () => {
  it('erkennt Intervall- und Nach-Erledigung-Formen', () => {
    expect(parseRrule('every:2w')).toEqual({ kind: 'every', n: 2, unit: 'w' });
    expect(parseRrule('after:3d')).toEqual({ kind: 'after', n: 3, unit: 'd' });
    expect(parseRrule('weekly')).toBeNull();
  });

  it('isRrule akzeptiert Presets und erweiterte Formen, verwirft Unsinn', () => {
    expect(isRrule('weekly')).toBe(true);
    expect(isRrule('every:2w')).toBe(true);
    expect(isRrule('after:30d')).toBe(true);
    expect(isRrule('every:2x')).toBe(false);
    expect(isRrule('every:0w')).toBe(false);
    expect(isRrule('every:2y')).toBe(true); // Jahre sind seit dem Baukasten gültig
    expect(isRrule('quatsch')).toBe(false);
    expect(isRrule(null)).toBe(false);
  });

  it('beschriftet lesbar auf Deutsch', () => {
    expect(rruleLabel('weekly')).toBe('Wöchentlich');
    expect(rruleLabel('every:2w')).toBe('Alle 2 Wochen');
    expect(rruleLabel('every:2m')).toBe('Alle 2 Monate');
    expect(rruleLabel('every:3d')).toBe('Alle 3 Tage');
    // n = 1 klingt weiterhin wie gewohnt, statt „Alle 1 Monat".
    expect(rruleLabel('every:1m')).toBe('Monatlich');
    expect(rruleLabel('every:3y')).toBe('Alle 3 Jahre');
    expect(rruleLabel('weekdays')).toBe('Werktags');
    expect(rruleLabel('after:7d')).toBe('7 Tage nach Erledigen');
    expect(rruleLabel('after:1w')).toBe('1 Woche nach Erledigen');
    expect(rruleLabel('after:3d')).toBe('3 Tage nach Erledigen');
  });

  it('rückt Intervalle korrekt weiter (auch über Monatsenden)', () => {
    expect(nextOccurrence('2026-07-01', 'every:2w')).toBe('2026-07-15');
    expect(nextOccurrence('2026-07-01', 'every:3d')).toBe('2026-07-04');
    expect(nextOccurrence('2026-01-31', 'every:1m')).toBe('2026-02-28');
    expect(nextOccurrence('2026-07-31', 'every:2m')).toBe('2026-09-30');
  });

  it('überspringt Vergangenes auch bei Intervallen', () => {
    // 6 Wochen überfällige 2-Wochen-Aufgabe → nächster Termin in der Zukunft.
    expect(nextOccurrenceAfter('2026-06-01', 'every:2w', '2026-07-10')).toBe('2026-07-13');
  });

  it('addMonths klemmt den Tag aufs Monatsende', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-07-27', 3)).toBe('2026-10-27');
  });
});

describe('buildRrule / rruleParts — der Satzbaukasten', () => {
  it('n = 1 ergibt das kanonische Preset (alte Werte bleiben gültig)', () => {
    expect(buildRrule(1, 'd', false)).toBe('daily');
    expect(buildRrule(1, 'w', false)).toBe('weekly');
    expect(buildRrule(1, 'm', false)).toBe('monthly');
    expect(buildRrule(1, 'y', false)).toBe('yearly');
  });

  it('n > 1 ergibt die Intervall-Form, „nach Erledigen" bleibt immer explizit', () => {
    expect(buildRrule(5, 'w', false)).toBe('every:5w');
    expect(buildRrule(1, 'w', true)).toBe('after:1w');
    expect(buildRrule(10, 'd', true)).toBe('after:10d');
  });

  it('klemmt unsinnige Eingaben statt sie zu übernehmen', () => {
    expect(buildRrule(0, 'w', false)).toBe('weekly');
    expect(buildRrule(-3, 'd', false)).toBe('daily');
    expect(buildRrule(5000, 'd', false)).toBe('every:999d');
    expect(buildRrule(NaN, 'w', false)).toBe('weekly');
  });

  it('rruleParts ist die Umkehrung — der Editor findet seine Bausteine wieder', () => {
    for (const r of ['daily', 'weekly', 'monthly', 'yearly', 'every:5w', 'after:3d', 'after:2m'] as const) {
      const p = rruleParts(r)!;
      expect(buildRrule(p.n, p.unit, p.after)).toBe(r);
    }
    expect(rruleParts('weekdays')).toBeNull();
    expect(rruleParts(null)).toBeNull();
  });

  it('rückt Jahre korrekt weiter', () => {
    expect(nextOccurrence('2026-07-27', 'every:3y')).toBe('2029-07-27');
  });
});

// ——— Feste Wochentage (v1.50.0): „jeden Montag und Donnerstag" ———
describe('Wochentags-Wiederholungen', () => {
  it('liest, normalisiert und weist Unbrauchbares ab', () => {
    expect(parseWeekdays('wd:4,1')).toEqual([1, 4]);
    expect(parseWeekdays('wd:1,1,4')).toEqual([1, 4]);
    expect(parseWeekdays('weekly')).toBeNull();
    // Kaputt soll wie „keine Wiederholung" wirken, nicht wie eine, die nie
    // wieder fällig wird.
    expect(parseWeekdays('wd:')).toBeNull();
    expect(parseWeekdays('wd:7')).toBeNull();
    expect(parseWeekdays('wd:x')).toBeNull();
  });

  it('Mo–Fr wird zum bestehenden Preset, damit Werte kanonisch bleiben', () => {
    expect(buildWeekdayRrule([1, 2, 3, 4, 5])).toBe('weekdays');
    expect(buildWeekdayRrule([4, 1])).toBe('wd:1,4');
    expect(buildWeekdayRrule([])).toBeNull();
    expect(isWeekdayRule('weekdays')).toBe(true);
    expect(weekdaysOf('weekdays')).toEqual([1, 2, 3, 4, 5]);
  });

  it('springt auf den nächsten gewählten Tag', () => {
    // 2026-07-28 ist ein Dienstag. Mo(1) + Do(4):
    expect(nextOccurrence('2026-07-28', 'wd:1,4')).toBe('2026-07-30'); // Do
    expect(nextOccurrence('2026-07-30', 'wd:1,4')).toBe('2026-08-03'); // Mo
    // Ein einzelner Tag verhält sich wie „wöchentlich an diesem Tag".
    expect(nextOccurrence('2026-07-28', 'wd:2')).toBe('2026-08-04');
  });

  it('überspringt beim Abhaken alle vergangenen Termine', () => {
    // Lange nicht abgehakt: der nächste Termin liegt IN DER ZUKUNFT, nicht
    // wieder in der Vergangenheit.
    expect(nextOccurrenceAfter('2026-07-06', 'wd:1,4', '2026-07-28')).toBe('2026-07-30');
  });

  it('beschriftet in der Reihenfolge der Woche, nicht in der von JS', () => {
    expect(rruleLabel('wd:1,4')).toBe('Mo + Do');
    expect(rruleLabel('wd:0,1')).toBe('Mo + So'); // Sonntag steht hinten
    expect(rruleLabel('wd:1,3,5')).toBe('Mo, Mi, Fr');
    expect(rruleLabel('wd:2')).toBe('Jeden Di');
    expect(rruleLabel('weekdays')).toBe('Werktags');
  });

  it('gilt als gültige Regel und lässt sich im Editor nicht als „alle n" darstellen', () => {
    expect(isRrule('wd:1,4')).toBe(true);
    expect(isRrule('wd:9')).toBe(false);
    expect(rruleParts('wd:1,4')).toBeNull();
  });
});

describe('Verankerung fester Wochentage', () => {
  // 2026-07-28 ist ein Dienstag.
  it('rückt ein abgeleitetes Datum auf den nächsten gewählten Tag', () => {
    expect(anchorWeekdayRrule('2026-07-28', 'wd:1,4')).toBe('2026-07-30'); // Do
    expect(anchorWeekdayRrule('2026-07-28', 'wd:2')).toBe('2026-07-28');   // Di selbst
  });

  it('gilt auch für das ältere „Werktags"', () => {
    // Samstag angelegt → der erste Termin ist der Montag, nicht das Wochenende.
    expect(anchorWeekdayRrule('2026-08-01', 'weekdays')).toBe('2026-08-03');
  });

  it('lässt alles andere unangetastet', () => {
    expect(anchorWeekdayRrule('2026-07-28', 'weekly')).toBe('2026-07-28');
    expect(anchorWeekdayRrule('2026-07-28', 'every:2w')).toBe('2026-07-28');
    expect(anchorWeekdayRrule('2026-07-28', null)).toBe('2026-07-28');
  });
});
