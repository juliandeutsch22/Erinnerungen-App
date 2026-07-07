// taskFilters.test.ts — Smart-Filter (Tags/Flagge/Zeitraum) + Tag-Zählung.
import type { Task } from '@/data/types';
import { applyFilter, emptyFilter, subtaskProgress, tagCounts } from './taskFilters';

const TODAY = '2026-07-03';

function task(o: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    listId: 'default',
    title: 'T',
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
    ...o,
  };
}

describe('applyFilter', () => {
  it('Tags sind UND-verknüpft, nur offene per Default', () => {
    const a = task({ id: 'a', tags: ['arbeit', 'dringend'] });
    const b = task({ id: 'b', tags: ['arbeit'] });
    const done = task({ id: 'c', tags: ['arbeit', 'dringend'], completedAt: '2026-07-02T10:00:00.000Z' });
    const f = { ...emptyFilter(), tags: ['arbeit', 'dringend'] };
    expect(applyFilter([a, b, done], f, TODAY).map((t) => t.id)).toEqual(['a']);
  });

  it('Flagge + Zeitraum überfällig', () => {
    const a = task({ id: 'a', flagged: true, dueDate: '2026-07-01' });
    const b = task({ id: 'b', flagged: false, dueDate: '2026-07-01' });
    const c = task({ id: 'c', flagged: true, dueDate: TODAY });
    const f = { ...emptyFilter(), flagged: true, range: 'overdue' as const };
    expect(applyFilter([a, b, c], f, TODAY).map((t) => t.id)).toEqual(['a']);
  });

  it('range undated: nur ohne Datum; includeCompleted zeigt Erledigte', () => {
    const a = task({ id: 'a' });
    const b = task({ id: 'b', dueDate: TODAY });
    const done = task({ id: 'c', completedAt: '2026-07-02T10:00:00.000Z' });
    expect(applyFilter([a, b, done], { ...emptyFilter(), range: 'undated' }, TODAY).map((t) => t.id)).toEqual(['a']);
    expect(
      applyFilter([a, b, done], { ...emptyFilter(), range: 'undated', includeCompleted: true }, TODAY).map((t) => t.id),
    ).toEqual(['a', 'c']);
  });
});

describe('tagCounts', () => {
  it('zählt und sortiert nach Häufigkeit', () => {
    const tasks = [task({ tags: ['arbeit'] }), task({ tags: ['arbeit', 'privat'] }), task({ tags: ['privat'] })];
    expect(tagCounts(tasks)).toEqual([
      { tag: 'arbeit', count: 2 },
      { tag: 'privat', count: 2 },
    ]);
  });
});

describe('subtaskProgress', () => {
  it('zählt erledigte Schritte', () => {
    expect(subtaskProgress([{ id: '1', title: 'a', done: true }, { id: '2', title: 'b', done: false }])).toEqual({
      done: 1,
      total: 2,
    });
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0 });
  });
});
