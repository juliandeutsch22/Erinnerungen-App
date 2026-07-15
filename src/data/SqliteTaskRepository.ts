// SqliteTaskRepository.ts — expo-sqlite-Persistenz der Aufgaben (nativ).
import { getDb } from './db';
import { TaskRepository } from './TaskRepository';
import type { Rrule, Task } from './types';

type TaskRow = {
  id: string; list_id: string; title: string; note: string | null;
  due_date: string | null; due_time: string | null; rrule: string | null;
  flagged: number; completed_at: string | null; notification_id: string | null;
  created_at: string; sort: number; tags: string | null; subtasks: string | null;
  event_id: string | null;
};

function parseArray<T>(json: string | null): T[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function toTask(r: TaskRow): Task {
  return {
    id: r.id,
    listId: r.list_id,
    title: r.title,
    note: r.note,
    dueDate: r.due_date,
    dueTime: r.due_time,
    rrule: (r.rrule as Rrule | null) ?? null,
    flagged: r.flagged === 1,
    eventId: r.event_id,
    completedAt: r.completed_at,
    notificationId: r.notification_id,
    tags: parseArray<string>(r.tags),
    subtasks: parseArray<Task['subtasks'][number]>(r.subtasks),
    createdAt: r.created_at,
    sort: r.sort,
  };
}

export class SqliteTaskRepository implements TaskRepository {
  async getAll(): Promise<Task[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<TaskRow>('SELECT * FROM tasks ORDER BY sort ASC, created_at ASC');
    return rows.map(toTask);
  }

  async create(task: Task): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO tasks
         (id, list_id, title, note, due_date, due_time, rrule, flagged, completed_at, notification_id, created_at, sort, tags, subtasks, event_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id, task.listId, task.title, task.note, task.dueDate, task.dueTime,
        task.rrule, task.flagged ? 1 : 0, task.completedAt, task.notificationId,
        task.createdAt, task.sort, JSON.stringify(task.tags ?? []), JSON.stringify(task.subtasks ?? []),
        task.eventId,
      ],
    );
  }

  async update(id: string, patch: Partial<Omit<Task, 'id'>>): Promise<void> {
    const db = await getDb();
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    const map: Record<string, string> = {
      listId: 'list_id', title: 'title', note: 'note', dueDate: 'due_date', dueTime: 'due_time',
      rrule: 'rrule', flagged: 'flagged', completedAt: 'completed_at',
      notificationId: 'notification_id', sort: 'sort', tags: 'tags', subtasks: 'subtasks',
      eventId: 'event_id',
    };
    for (const [key, col] of Object.entries(map)) {
      if (key in patch) {
        const value = (patch as Record<string, unknown>)[key];
        sets.push(`${col} = ?`);
        if (key === 'flagged') args.push(value ? 1 : 0);
        else if (key === 'tags' || key === 'subtasks') args.push(JSON.stringify(value ?? []));
        else args.push(value as string | number | null);
      }
    }
    if (sets.length === 0) return;
    args.push(id);
    await db.runAsync(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, args);
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
  }

  async removeByList(listId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM tasks WHERE list_id = ?', [listId]);
  }

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM tasks;');
  }
}
