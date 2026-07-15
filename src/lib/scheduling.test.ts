// scheduling.test.ts — Auswahl fürs Notification-Fenster (Fahrplan M4/§5).
import type { Task } from '@/data/types';
import { countUntimedDue, selectNotificationWindow, taskFireDate } from './scheduling';

const NOW = new Date(2026, 6, 3, 12, 0); // 3. Juli 2026, 12:00 lokal

function task(overrides: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    listId: 'default',
    title: 'Test',
    note: null,
    dueDate: null,
    dueTime: null,
    rrule: null,
    flagged: false,
    eventId: null,
    completedAt: null,
    notificationId: null,
    tags: [],
    subtasks: [],
    createdAt: '2026-07-01T08:00:00.000Z',
    sort: 0,
    ...overrides,
  };
}

describe('taskFireDate', () => {
  it('kombiniert Datum + Uhrzeit als LOKALE Zeit', () => {
    const d = taskFireDate({ dueDate: '2026-07-03', dueTime: '09:30' })!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(3);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
  });

  it('ohne Datum oder Uhrzeit: null', () => {
    expect(taskFireDate({ dueDate: '2026-07-03', dueTime: null })).toBeNull();
    expect(taskFireDate({ dueDate: null, dueTime: '09:00' })).toBeNull();
  });
});

describe('selectNotificationWindow', () => {
  it('nur offene, zukünftige Aufgaben mit Uhrzeit — chronologisch', () => {
    const past = task({ id: 'past', dueDate: '2026-07-03', dueTime: '08:00' });
    const later = task({ id: 'later', dueDate: '2026-07-04', dueTime: '09:00' });
    const soon = task({ id: 'soon', dueDate: '2026-07-03', dueTime: '18:00' });
    const untimed = task({ id: 'untimed', dueDate: '2026-07-03' });
    const done = task({ id: 'done', dueDate: '2026-07-04', dueTime: '10:00', completedAt: '2026-07-02T10:00:00.000Z' });
    const result = selectNotificationWindow([past, later, soon, untimed, done], NOW);
    expect(result.map((x) => x.task.id)).toEqual(['soon', 'later']);
  });

  it('kappt auf das Fenster (64er-Limit-Strategie)', () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      task({ id: `t${i}`, dueDate: '2026-07-10', dueTime: `${String(Math.floor(i / 60) + 8).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}` }),
    );
    expect(selectNotificationWindow(many, NOW)).toHaveLength(50);
    expect(selectNotificationWindow(many, NOW, 10)).toHaveLength(10);
  });
});

describe('countUntimedDue', () => {
  it('zählt heutige + überfällige ohne Uhrzeit, keine erledigten', () => {
    const a = task({ dueDate: '2026-07-03' });
    const overdue = task({ dueDate: '2026-06-30' });
    const timed = task({ dueDate: '2026-07-03', dueTime: '09:00' });
    const future = task({ dueDate: '2026-07-05' });
    const done = task({ dueDate: '2026-07-03', completedAt: '2026-07-03T08:00:00.000Z' });
    expect(countUntimedDue([a, overdue, timed, future, done], '2026-07-03')).toBe(2);
  });
});
