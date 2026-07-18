// duplicateList.test.ts — Vorlagen: Kopie startet frisch, Struktur bleibt.
import type { List, Task } from '@/data/types';

import { duplicateListWithTasks } from './duplicateList';

const list: List = {
  id: 'l1', name: 'Packliste', icon: 'briefcase', color: '#2B5FA6',
  goal: 'Nichts vergessen', deadline: '2026-07-01', sort: 1, createdAt: '2026-06-01T08:00:00.000Z',
};
const task = (over: Partial<Task>): Task => ({
  id: 't1', listId: 'l1', title: 'Pass', note: 'im Safe', dueDate: '2026-06-30', dueTime: '10:00',
  rrule: null, flagged: true, eventId: 'evt-1', completedAt: '2026-06-30T09:00:00.000Z',
  notificationId: 'n-1', tags: ['reise'], subtasks: [{ id: 's1', title: 'Kopie machen', done: true }],
  createdAt: '2026-06-01T08:00:00.000Z', sort: 1, ...over,
});

describe('duplicateListWithTasks', () => {
  const { list: copy, tasks } = duplicateListWithTasks(list, [task({}), task({ id: 't2', listId: 'anders' })]);

  it('Kopie: neuer Name, neue ID, ohne Deadline; Ziel und Optik bleiben', () => {
    expect(copy.name).toBe('Packliste (Kopie)');
    expect(copy.id).not.toBe('l1');
    expect(copy.deadline).toBeNull();
    expect(copy.goal).toBe('Nichts vergessen');
    expect(copy.color).toBe('#2B5FA6');
  });

  it('nur Aufgaben der Liste; frisch: offen, ohne Termine, Unteraufgaben zurückgesetzt', () => {
    expect(tasks).toHaveLength(1);
    const t = tasks[0];
    expect(t.listId).toBe(copy.id);
    expect(t.completedAt).toBeNull();
    expect(t.dueDate).toBeNull();
    expect(t.eventId).toBeNull();
    expect(t.notificationId).toBeNull();
    expect(t.subtasks[0].done).toBe(false);
    expect(t.subtasks[0].id).not.toBe('s1');
    // Struktur bleibt.
    expect(t.title).toBe('Pass');
    expect(t.note).toBe('im Safe');
    expect(t.tags).toEqual(['reise']);
    expect(t.flagged).toBe(true);
  });
});
