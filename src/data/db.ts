// db.ts — gemeinsame expo-sqlite-Verbindung (nur nativ) inkl. Schema-Migration
// und Seed der Standardliste. kvStorage nutzt dieselbe stille.db über eine
// eigene Verbindung (wie in Cairn) — beide legen nur ihre eigenen Tabellen an.
import type { SQLiteDatabase } from 'expo-sqlite';
import { openDatabaseAsync } from 'expo-sqlite';

import { COLOR_REBRAND } from './colorRebrand';
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
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY NOT NULL,
          body TEXT NOT NULL,
          task_id TEXT,
          event_id TEXT,
          pinned INTEGER NOT NULL DEFAULT 0,
          deleted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notes_task ON notes (task_id);
        CREATE INDEX IF NOT EXISTS idx_notes_event ON notes (event_id);
        CREATE TABLE IF NOT EXISTS event_photos (
          id TEXT PRIMARY KEY NOT NULL,
          event_id TEXT NOT NULL,
          uri TEXT NOT NULL,
          added_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_event_photos_event ON event_photos (event_id);
      `);
      // Migration: neue Spalten nachrüsten (bestehende Installs).
      // ALTER wirft, wenn die Spalte schon existiert → still schlucken.
      for (const col of ['tags TEXT', 'subtasks TEXT', 'event_id TEXT']) {
        try {
          await db.execAsync(`ALTER TABLE tasks ADD COLUMN ${col};`);
        } catch {
          /* Spalte existiert bereits */
        }
      }
      for (const col of ['goal TEXT', 'deadline TEXT']) {
        try {
          await db.execAsync(`ALTER TABLE lists ADD COLUMN ${col};`);
        } catch {
          /* Spalte existiert bereits */
        }
      }
      for (const col of ['pinned INTEGER NOT NULL DEFAULT 0', 'deleted_at TEXT']) {
        try {
          await db.execAsync(`ALTER TABLE notes ADD COLUMN ${col};`);
        } catch {
          /* Spalte existiert bereits */
        }
      }
      // Mediterran-Rebrand (v1.2): gespeicherte Listenfarben der alten
      // Teal/Indigo-Palette einmalig auf die Erdton-Palette umziehen.
      // Idempotent — nach dem ersten Lauf matcht keine alte Farbe mehr.
      for (const [oldColor, newColor] of COLOR_REBRAND) {
        await db.runAsync('UPDATE lists SET color = ? WHERE color = ?', [newColor, oldColor]);
      }
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
