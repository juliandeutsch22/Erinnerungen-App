// taskLogic.test.ts — Überfällig-Ableitung, Abhak-Semantik, Gruppierungen.
import type { Task } from '@/data/types';
import { groupPlanned, groupToday, groupUpcomingDays, isDueToday, isOverdue, recentlyCompleted, resolveCompletion } from './taskLogic';

const TODAY = '2026-07-03';

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    listId: 'default',
    title: 'Test',
    note: null,
    dueDate: null,
    dueTime: null,
    rrule: null,
    flagged: false,
    completedAt: null,
    notificationId: null,
    tags: [],
    subtasks: [],
    createdAt: '2026-07-01T08:00:00.000Z',
    sort: 0,
    ...overrides,
  };
}

describe('isOverdue / isDueToday', () => {
  it('vor heute = überfällig, heute = heute, ohne Datum = keins von beiden', () => {
    expect(isOverdue(task({ dueDate: '2026-07-01' }), TODAY)).toBe(true);
    expect(isOverdue(task({ dueDate: TODAY }), TODAY)).toBe(false);
    expect(isDueToday(task({ dueDate: TODAY }), TODAY)).toBe(true);
    expect(isOverdue(task({}), TODAY)).toBe(false);
    expect(isDueToday(task({}), TODAY)).toBe(false);
  });

  it('erledigte Aufgaben sind nie überfällig', () => {
    expect(isOverdue(task({ dueDate: '2026-07-01', completedAt: '2026-07-02T10:00:00.000Z' }), TODAY)).toBe(false);
  });
});

describe('resolveCompletion', () => {
  it('ohne Wiederholung: completedAt wird gesetzt', () => {
    const now = new Date('2026-07-03T09:30:00.000Z');
    expect(resolveCompletion(task({ dueDate: TODAY }), TODAY, now)).toEqual({
      completedAt: '2026-07-03T09:30:00.000Z',
    });
  });

  it('mit Wiederholung: dueDate wandert, Aufgabe bleibt offen', () => {
    const patch = resolveCompletion(task({ dueDate: TODAY, rrule: 'daily' }), TODAY);
    expect(patch).toEqual({ dueDate: '2026-07-04' });
    expect(patch.completedAt).toBeUndefined();
  });

  it('überfällige Wiederholung springt hinter heute', () => {
    const patch = resolveCompletion(task({ dueDate: '2026-06-20', rrule: 'weekly' }), TODAY);
    expect(patch).toEqual({ dueDate: '2026-07-04' });
  });
});

describe('groupToday', () => {
  it('überfällig → heute mit Uhrzeit (chronologisch) → heute ohne Uhrzeit', () => {
    const overdueOld = task({ id: 'a', dueDate: '2026-06-30' });
    const overdueNew = task({ id: 'b', dueDate: '2026-07-02' });
    const nine = task({ id: 'c', dueDate: TODAY, dueTime: '09:00' });
    const seven = task({ id: 'd', dueDate: TODAY, dueTime: '07:30' });
    const loose = task({ id: 'e', dueDate: TODAY });
    const done = task({ id: 'f', dueDate: TODAY, completedAt: '2026-07-03T08:00:00.000Z' });
    const groups = groupToday([overdueOld, overdueNew, nine, seven, loose, done], TODAY);
    expect(groups.overdue.map((t) => t.id)).toEqual(['a', 'b']);
    expect(groups.timed.map((t) => t.id)).toEqual(['d', 'c']);
    expect(groups.untimed.map((t) => t.id)).toEqual(['e']);
  });
});

describe('recentlyCompleted', () => {
  it('blendet Erledigte nach 30 Tagen aus, neueste zuerst', () => {
    const fresh = task({ id: 'a', completedAt: '2026-07-02T10:00:00.000Z' });
    const older = task({ id: 'b', completedAt: '2026-06-10T10:00:00.000Z' });
    const ancient = task({ id: 'c', completedAt: '2026-05-01T10:00:00.000Z' });
    expect(recentlyCompleted([older, ancient, fresh], TODAY).map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('groupUpcomingDays', () => {
  it('nur kommende Tage im Fenster, gruppiert + chronologisch, Uhrzeit zuerst', () => {
    const heute = task({ id: 'a', dueDate: TODAY });
    const morgenSpaet = task({ id: 'b', dueDate: '2026-07-04', dueTime: '18:00' });
    const morgenFrueh = task({ id: 'c', dueDate: '2026-07-04', dueTime: '09:00' });
    const inDreiTagen = task({ id: 'd', dueDate: '2026-07-06' });
    const zuWeit = task({ id: 'e', dueDate: '2026-07-15' });
    const erledigt = task({ id: 'f', dueDate: '2026-07-04', completedAt: '2026-07-01T10:00:00.000Z' });
    const groups = groupUpcomingDays([heute, morgenSpaet, morgenFrueh, inDreiTagen, zuWeit, erledigt], TODAY);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-04', '2026-07-06']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['c', 'b']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['d']);
  });

  it('leer ohne kommende Aufgaben', () => {
    expect(groupUpcomingDays([task({ dueDate: TODAY }), task({})], TODAY)).toEqual([]);
  });
});

describe('groupPlanned', () => {
  it('Heute (inkl. überfällig) / Morgen / Diese Woche / Später — leere Gruppen entfallen', () => {
    const overdue = task({ id: 'a', dueDate: '2026-07-01' });
    const today = task({ id: 'b', dueDate: TODAY });
    const tomorrow = task({ id: 'c', dueDate: '2026-07-04' });
    const nextWeek = task({ id: 'd', dueDate: '2026-07-09' });
    const later = task({ id: 'e', dueDate: '2026-08-01' });
    const groups = groupPlanned([later, nextWeek, tomorrow, today, overdue], TODAY);
    expect(groups.map((g) => g.key)).toEqual(['heute', 'morgen', 'woche', 'spaeter']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['a', 'b']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['c']);
    expect(groups[2].tasks.map((t) => t.id)).toEqual(['d']);
    expect(groups[3].tasks.map((t) => t.id)).toEqual(['e']);
  });

  it('Aufgaben ohne Datum tauchen nicht auf', () => {
    expect(groupPlanned([task({})], TODAY)).toEqual([]);
  });
});
