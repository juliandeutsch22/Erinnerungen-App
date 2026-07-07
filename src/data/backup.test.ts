// backup.test.ts — Export/Import-Roundtrip (Fahrplan §3.8) über die InMemory-Repos.
import { exportToJsonString, importBackup } from './backup';
import { __setListRepositoryForTests, __setTaskRepositoryForTests } from './index';
import { InMemoryListRepository } from './ListRepository';
import { InMemoryTaskRepository } from './TaskRepository';
import { getListRepository, getTaskRepository } from './index';
import type { Task } from './types';

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
    sort: 1,
    ...overrides,
  };
}

describe('Backup', () => {
  beforeEach(() => {
    __setListRepositoryForTests(new InMemoryListRepository());
    __setTaskRepositoryForTests(new InMemoryTaskRepository());
  });

  afterEach(() => {
    __setListRepositoryForTests(null);
    __setTaskRepositoryForTests(null);
  });

  it('Roundtrip: Export → Import stellt Listen + Aufgaben wieder her', async () => {
    await getListRepository().create({ id: 'l1', name: 'Einkauf', icon: 'shopping-cart', color: '#5B6CFF', sort: 1, createdAt: '2026-07-01T08:00:00.000Z' });
    await getTaskRepository().create(task({ id: 't1', listId: 'l1', title: 'Milch', dueDate: '2026-07-04', dueTime: '09:00', rrule: 'weekly', notificationId: 'notif-alt' }));
    await getTaskRepository().create(task({ id: 't2', title: 'Steuer', completedAt: '2026-07-02T10:00:00.000Z' }));

    const json = await exportToJsonString(new Date('2026-07-03T12:00:00.000Z'));

    // Frische Repos = neues Gerät.
    __setListRepositoryForTests(new InMemoryListRepository());
    __setTaskRepositoryForTests(new InMemoryTaskRepository());

    const result = await importBackup(json);
    expect(result).toEqual({ lists: 2, tasks: 2 }); // Standardliste + Einkauf

    const tasks = await getTaskRepository().getAll();
    const milch = tasks.find((t) => t.id === 't1')!;
    expect(milch.title).toBe('Milch');
    expect(milch.listId).toBe('l1');
    expect(milch.dueDate).toBe('2026-07-04');
    expect(milch.rrule).toBe('weekly');
    // Notification-IDs gehören zum alten Install → zurückgesetzt.
    expect(milch.notificationId).toBeNull();
    expect(tasks.find((t) => t.id === 't2')!.completedAt).toBe('2026-07-02T10:00:00.000Z');

    const lists = await getListRepository().getAll();
    expect(lists.map((l) => l.name).sort()).toEqual(['Einkauf', 'Erinnerungen']);
  });

  it('Aufgaben mit unbekannter Liste fallen in die Standardliste', async () => {
    const json = JSON.stringify({
      app: 'stille',
      schemaVersion: 1,
      exportedAt: '2026-07-03T12:00:00.000Z',
      lists: [],
      tasks: [{ id: 'x', listId: 'weg', title: 'Verwaist' }],
    });
    await importBackup(json);
    const tasks = await getTaskRepository().getAll();
    expect(tasks[0].listId).toBe('default');
  });

  it('lehnt fremdes/ungültiges JSON ab', async () => {
    await expect(importBackup('kein json')).rejects.toThrow('Kein gültiges JSON.');
    await expect(importBackup('{"app":"cairn","schemaVersion":1}')).rejects.toThrow('Kein Erinnerungen-Backup');
  });
});
