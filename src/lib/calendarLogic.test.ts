// calendarLogic.test.ts — Tages-Zuordnung von Terminen (lokale Kalendertage).
import { bucketEventsByDay, eventDays, eventTimeLabel } from './calendarLogic';

const ev = (start: string, end: string, allDay = false) => ({
  start: new Date(start),
  end: new Date(end),
  allDay,
});

describe('eventDays', () => {
  it('eintägiger Termin → ein Tag', () => {
    expect(eventDays(ev('2026-07-06T09:00:00', '2026-07-06T10:30:00'))).toEqual(['2026-07-06']);
  });

  it('mehrtägiger Termin → alle berührten Tage', () => {
    expect(eventDays(ev('2026-07-06T18:00:00', '2026-07-08T09:00:00'))).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
    ]);
  });

  it('Ende exakt Mitternacht zählt nicht als weiterer Tag (ganztägig exklusiv)', () => {
    expect(eventDays(ev('2026-07-06T00:00:00', '2026-07-07T00:00:00', true))).toEqual(['2026-07-06']);
  });
});

describe('bucketEventsByDay', () => {
  it('gruppiert pro Tag im Fenster, ganztägig zuerst, dann chronologisch', () => {
    const ganztags = { ...ev('2026-07-06T00:00:00', '2026-07-07T00:00:00', true), id: 'g' };
    const frueh = { ...ev('2026-07-06T08:00:00', '2026-07-06T09:00:00'), id: 'f' };
    const spaet = { ...ev('2026-07-06T15:00:00', '2026-07-06T16:00:00'), id: 's' };
    const ausserhalb = { ...ev('2026-08-01T08:00:00', '2026-08-01T09:00:00'), id: 'x' };
    const map = bucketEventsByDay([spaet, frueh, ganztags, ausserhalb], '2026-07-01', '2026-07-31');
    expect(map.get('2026-07-06')!.map((e) => (e as { id: string }).id)).toEqual(['g', 'f', 's']);
    expect(map.has('2026-08-01')).toBe(false);
  });
});

describe('eventTimeLabel', () => {
  it('eintägig / ganztägig / mehrtägig', () => {
    expect(eventTimeLabel(ev('2026-07-06T09:00:00', '2026-07-06T10:30:00'), '2026-07-06')).toBe('09:00 – 10:30');
    expect(eventTimeLabel(ev('2026-07-06T00:00:00', '2026-07-07T00:00:00', true), '2026-07-06')).toBe('Ganztägig');
    const multi = ev('2026-07-06T18:00:00', '2026-07-08T09:30:00');
    expect(eventTimeLabel(multi, '2026-07-06')).toBe('ab 18:00');
    expect(eventTimeLabel(multi, '2026-07-07')).toBe('Ganztägig');
    expect(eventTimeLabel(multi, '2026-07-08')).toBe('bis 09:30');
  });
});
