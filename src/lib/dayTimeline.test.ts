// dayTimeline.test.ts — Termine + Aufgaben zu einem chronologischen Ablauf.
import type { Task } from '@/data/types';

import { buildDayTimeline, nowMarkerIndex } from './dayTimeline';
import type { DeviceEvent } from './deviceCalendar';

const DAY = '2026-07-15';

const ev = (h1: number, m1: number, h2: number, m2: number, title: string, allDay = false): DeviceEvent => ({
  key: title,
  id: title,
  calendarId: 'c',
  title,
  notes: null,
  allDay,
  start: new Date(2026, 6, 15, h1, m1),
  end: new Date(2026, 6, 15, h2, m2),
  recurring: false,
  native: {} as DeviceEvent['native'],
});

const task = (id: string, dueTime: string | null, dueDate: string | null = DAY): Task => ({
  id,
  listId: 'default',
  title: id,
  note: null,
  dueDate,
  dueTime,
  rrule: null,
  flagged: false,
  eventId: null,
  completedAt: null,
  notificationId: null,
  tags: [],
  subtasks: [],
  createdAt: '2026-07-15T08:00:00.000Z',
  sort: 0,
});

describe('buildDayTimeline', () => {
  it('verschmilzt Termine + Aufgaben chronologisch', () => {
    const events = [ev(9, 0, 10, 0, 'Meeting'), ev(14, 0, 14, 30, 'Anruf')];
    const tasks = [task('Bericht', '10:30'), task('Ohne', null), task('Morgen', '08:00', '2026-07-16')];
    const tl = buildDayTimeline(events, tasks, DAY);
    expect(tl.map((e) => e.time)).toEqual(['09:00', '10:30', '14:00']);
    expect(tl.map((e) => e.kind)).toEqual(['event', 'task', 'event']);
    expect(tl[0].end).toBe('10:00');
  });

  it('ganztägige Termine bleiben außen vor', () => {
    expect(buildDayTimeline([ev(0, 0, 23, 59, 'Urlaub', true)], [], DAY)).toEqual([]);
  });

  it('gleiche Zeit: Termin vor Aufgabe', () => {
    const tl = buildDayTimeline([ev(9, 0, 10, 0, 'E')], [task('T', '09:00')], DAY);
    expect(tl.map((e) => e.kind)).toEqual(['event', 'task']);
  });
});

describe('nowMarkerIndex', () => {
  const tl = buildDayTimeline([ev(9, 0, 10, 0, 'A'), ev(14, 0, 15, 0, 'B')], [task('T', '11:00')], DAY);
  it('sitzt vor dem ersten Eintrag ab jetzt', () => {
    expect(nowMarkerIndex(tl, 8 * 60)).toBe(0); // vor allem
    expect(nowMarkerIndex(tl, 10 * 60)).toBe(1); // 10:00 → vor 11:00
    expect(nowMarkerIndex(tl, 20 * 60)).toBe(3); // nach allem → ans Ende
  });
});
