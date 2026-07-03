// quickAddParser.test.ts — Fahrplan M3: „morgen", „mo/di/…", „15.8.",
// „jeden montag", „9 uhr", „9:30" und Kombinationen.
import { parseQuickAdd } from './quickAddParser';

// 2026-07-03 ist ein Freitag.
const TODAY = '2026-07-03';

describe('parseQuickAdd', () => {
  it('„Milch morgen" → Titel + morgiges Datum', () => {
    expect(parseQuickAdd('Milch morgen', TODAY)).toEqual({
      title: 'Milch',
      dueDate: '2026-07-04',
      dueTime: null,
      rrule: null,
    });
  });

  it('„Miete am 1. jeden monat" → monatlich am nächsten 1.', () => {
    expect(parseQuickAdd('Miete am 1. jeden monat', TODAY)).toEqual({
      title: 'Miete',
      dueDate: '2026-08-01',
      dueTime: null,
      rrule: 'monthly',
    });
  });

  it('„Anruf mo 9:00" → nächster Montag mit Uhrzeit', () => {
    expect(parseQuickAdd('Anruf mo 9:00', TODAY)).toEqual({
      title: 'Anruf',
      dueDate: '2026-07-06',
      dueTime: '09:00',
      rrule: null,
    });
  });

  it('„Zahnarzt 15.8." → nächstes Vorkommen des Datums', () => {
    expect(parseQuickAdd('Zahnarzt 15.8.', TODAY)).toEqual({
      title: 'Zahnarzt',
      dueDate: '2026-08-15',
      dueTime: null,
      rrule: null,
    });
  });

  it('vergangenes Datum rutscht ins nächste Jahr', () => {
    expect(parseQuickAdd('Geburtstag 1.3.', TODAY).dueDate).toBe('2027-03-01');
  });

  it('Datum mit Jahr bleibt exakt', () => {
    expect(parseQuickAdd('TÜV 15.08.2027', TODAY).dueDate).toBe('2027-08-15');
  });

  it('„jeden montag Sport" → wöchentlich, nächster Montag', () => {
    expect(parseQuickAdd('jeden montag Sport', TODAY)).toEqual({
      title: 'Sport',
      dueDate: '2026-07-06',
      dueTime: null,
      rrule: 'weekly',
    });
  });

  it('„Gießen jeden tag" → täglich ab heute', () => {
    expect(parseQuickAdd('Gießen jeden tag', TODAY)).toEqual({
      title: 'Gießen',
      dueDate: TODAY,
      dueTime: null,
      rrule: 'daily',
    });
  });

  it('„Standup werktags 9 uhr" → werktags mit Uhrzeit', () => {
    expect(parseQuickAdd('Standup werktags 9 uhr', TODAY)).toEqual({
      title: 'Standup',
      dueDate: TODAY,
      dueTime: '09:00',
      rrule: 'weekdays',
    });
  });

  it('„Meeting um 14:30" → Uhrzeit ohne Datum = heute', () => {
    expect(parseQuickAdd('Meeting um 14:30', TODAY)).toEqual({
      title: 'Meeting',
      dueDate: TODAY,
      dueTime: '14:30',
      rrule: null,
    });
  });

  it('„übermorgen Paket abholen"', () => {
    expect(parseQuickAdd('übermorgen Paket abholen', TODAY)).toEqual({
      title: 'Paket abholen',
      dueDate: '2026-07-05',
      dueTime: null,
      rrule: null,
    });
  });

  it('Wochentag heute (Freitag „fr") → nächste Woche, nicht heute', () => {
    expect(parseQuickAdd('Wochenbericht fr', TODAY).dueDate).toBe('2026-07-10');
  });

  it('„Morgenroutine" bleibt unangetastet (kein \\b-Fehltreffer in Wörtern)', () => {
    expect(parseQuickAdd('Morgenroutine planen', TODAY)).toEqual({
      title: 'Morgenroutine planen',
      dueDate: null,
      dueTime: null,
      rrule: null,
    });
  });

  it('ohne erkannte Teile: alles bleibt Titel', () => {
    expect(parseQuickAdd('Blumen kaufen', TODAY)).toEqual({
      title: 'Blumen kaufen',
      dueDate: null,
      dueTime: null,
      rrule: null,
    });
  });

  it('ungültige Uhrzeit (25:00) wird ignoriert', () => {
    const r = parseQuickAdd('Test 25:99', TODAY);
    expect(r.dueTime).toBeNull();
  });
});
