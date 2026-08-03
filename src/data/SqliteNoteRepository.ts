// SqliteNoteRepository.ts — expo-sqlite-Persistenz der Notizen (nativ).
import { getDb } from './db';
import { NoteRepository } from './NoteRepository';
import type { Note } from './types';

type NoteRow = {
  id: string; body: string; task_id: string | null; event_id: string | null;
  list_id: string | null; person_id: string | null; pinned: number; deleted_at: string | null;
  created_at: string; updated_at: string;
};

function toNote(r: NoteRow): Note {
  return {
    id: r.id,
    body: r.body,
    taskId: r.task_id,
    eventId: r.event_id,
    // Nachgerüstete Spalte: bei sehr alten Zeilen ist sie `undefined`, nicht
    // `null` — beides bedeutet „keiner Liste zugeordnet".
    listId: r.list_id ?? null,
    personId: r.person_id ?? null,
    pinned: r.pinned === 1,
    deletedAt: r.deleted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SqliteNoteRepository implements NoteRepository {
  async getAll(): Promise<Note[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<NoteRow>('SELECT * FROM notes ORDER BY updated_at DESC');
    return rows.map(toNote);
  }

  async create(note: Note): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO notes (id, body, task_id, event_id, list_id, person_id, pinned, deleted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [note.id, note.body, note.taskId, note.eventId, note.listId ?? null, note.personId ?? null, note.pinned ? 1 : 0, note.deletedAt, note.createdAt, note.updatedAt],
    );
  }

  async update(id: string, patch: Partial<Omit<Note, 'id'>>): Promise<void> {
    const db = await getDb();
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    const map: Record<string, string> = {
      body: 'body', taskId: 'task_id', eventId: 'event_id', listId: 'list_id', personId: 'person_id',
      pinned: 'pinned', deletedAt: 'deleted_at',
      createdAt: 'created_at', updatedAt: 'updated_at',
    };
    for (const [key, col] of Object.entries(map)) {
      if (key in patch) {
        const value = (patch as Record<string, string | boolean | null | undefined>)[key];
        sets.push(`${col} = ?`);
        // `undefined` ist für SQLite kein Wert — bei optionalen Feldern
        // (listId) kann es aber im Patch stehen. Es bedeutet dasselbe wie null.
        args.push(typeof value === 'boolean' ? (value ? 1 : 0) : (value ?? null));
      }
    }
    if (sets.length === 0) return;
    args.push(id);
    await db.runAsync(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`, args);
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
  }

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM notes;');
  }
}
