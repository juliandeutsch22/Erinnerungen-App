// db.ts — gemeinsame expo-sqlite-Verbindung (nur nativ) inkl. Schema-Migration
// und Seed der Standardliste. kvStorage nutzt dieselbe stille.db über eine
// eigene Verbindung (wie in Cairn) — beide legen nur ihre eigenen Tabellen an.
import type { SQLiteDatabase } from 'expo-sqlite';
import { openDatabaseAsync } from 'expo-sqlite';

import { DEFAULT_LIST_ID, defaultList } from './ListRepository';

const DB_NAME = 'stille.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS lists (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          icon TEXT NOT NULL,
          color TEXT NOT NULL,
          sort INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY NOT NULL,
          list_id TEXT NOT NULL REFERENCES lists(id),
          title TEXT NOT NULL,
          note TEXT,
          due_date TEXT,
          due_time TEXT,
          rrule TEXT,
          flagged INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          notification_id TEXT,
          created_at TEXT NOT NULL,
          sort INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks (list_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks (due_date);
      `);
      // Seed: Standardliste „Erinnerungen" existiert immer.
      const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM lists WHERE id = ?', [DEFAULT_LIST_ID]);
      if (!row || row.c === 0) {
        const seed = defaultList();
        await db.runAsync(
          'INSERT OR IGNORE INTO lists (id, name, icon, color, sort, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [seed.id, seed.name, seed.icon, seed.color, seed.sort, seed.createdAt],
        );
      }
      return db;
    })();
  }
  return dbPromise;
}
