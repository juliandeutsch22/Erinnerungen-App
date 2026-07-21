// SqliteListRepository.ts — expo-sqlite-Persistenz der Listen (nativ).
import { getDb } from './db';
import { DEFAULT_LIST_ID, defaultList, ListRepository } from './ListRepository';
import type { List } from './types';

type ListRow = {
  id: string;
  name: string;
  icon: string;
  color: string;
  goal: string | null;
  deadline: string | null;
  deleted_at: string | null;
  sort: number;
  created_at: string;
};

function toList(r: ListRow): List {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    goal: r.goal ?? null,
    deadline: r.deadline ?? null,
    deletedAt: r.deleted_at ?? null,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

export class SqliteListRepository implements ListRepository {
  async getAll(): Promise<List[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<ListRow>('SELECT * FROM lists ORDER BY sort ASC, created_at ASC');
    return rows.map(toList);
  }

  async create(list: List): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO lists (id, name, icon, color, goal, deadline, deleted_at, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [list.id, list.name, list.icon, list.color, list.goal, list.deadline, list.deletedAt ?? null, list.sort, list.createdAt],
    );
  }

  async update(id: string, patch: Partial<Omit<List, 'id'>>): Promise<void> {
    const db = await getDb();
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    if (patch.name !== undefined) { sets.push('name = ?'); args.push(patch.name); }
    if (patch.icon !== undefined) { sets.push('icon = ?'); args.push(patch.icon); }
    if (patch.color !== undefined) { sets.push('color = ?'); args.push(patch.color); }
    if (patch.goal !== undefined) { sets.push('goal = ?'); args.push(patch.goal); }
    if (patch.deadline !== undefined) { sets.push('deadline = ?'); args.push(patch.deadline); }
    if (patch.deletedAt !== undefined) { sets.push('deleted_at = ?'); args.push(patch.deletedAt); }
    if (patch.sort !== undefined) { sets.push('sort = ?'); args.push(patch.sort); }
    if (sets.length === 0) return;
    args.push(id);
    await db.runAsync(`UPDATE lists SET ${sets.join(', ')} WHERE id = ?`, args);
  }

  async remove(id: string): Promise<void> {
    if (id === DEFAULT_LIST_ID) return;
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM tasks WHERE list_id = ?', [id]);
      await db.runAsync('DELETE FROM lists WHERE id = ?', [id]);
    });
  }

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM lists;');
    const seed = defaultList();
    await db.runAsync(
      'INSERT OR IGNORE INTO lists (id, name, icon, color, sort, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [seed.id, seed.name, seed.icon, seed.color, seed.sort, seed.createdAt],
    );
  }
}
