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
        CREATE TABLE IF NOT EXISTS chats (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          event_id TEXT,
          task_id TEXT,
          note_id TEXT,
          context TEXT,
          deleted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY NOT NULL,
          chat_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages (chat_id);
        CREATE TABLE IF NOT EXISTS event_documents (
          id TEXT PRIMARY KEY NOT NULL,
          event_id TEXT NOT NULL,
          name TEXT NOT NULL,
          uri TEXT NOT NULL,
          added_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_event_documents_event ON event_documents (event_id);
        CREATE TABLE IF NOT EXISTS journal (
          id TEXT PRIMARY KEY NOT NULL,
          date TEXT NOT NULL UNIQUE,
          text TEXT NOT NULL,
          deleted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS event_people (
          id TEXT PRIMARY KEY NOT NULL,
          event_id TEXT NOT NULL,
          person_id TEXT NOT NULL,
          added_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_event_people_event ON event_people (event_id);
        CREATE INDEX IF NOT EXISTS idx_event_people_person ON event_people (person_id);
        CREATE TABLE IF NOT EXISTS people (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          note TEXT,
          phone TEXT,
          email TEXT,
          contact_id TEXT,
          sort INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
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
      // `waiting`/`waiting_for`/`person_id` (v1.73.0) — wartende Aufgaben und
      // die Person, an der etwas hängt. `person_id` bewusst OHNE REFERENCES:
      // wird die Person gelöscht, bleibt die Aufgabe (das Lösen der Zuordnung
      // macht SqlitePersonRepository.remove selbst, in einer Transaktion).
      for (const col of ['tags TEXT', 'subtasks TEXT', 'event_id TEXT', 'deleted_at TEXT', 'rrule_until TEXT', 'start_date TEXT', 'expires_on TEXT', 'evening INTEGER NOT NULL DEFAULT 0', 'waiting INTEGER NOT NULL DEFAULT 0', 'waiting_for TEXT', 'person_id TEXT']) {
        try {
          await db.execAsync(`ALTER TABLE tasks ADD COLUMN ${col};`);
        } catch {
          /* Spalte existiert bereits */
        }
      }
      for (const col of ['goal TEXT', 'deadline TEXT', 'deleted_at TEXT', 'completed_at TEXT']) {
        try {
          await db.execAsync(`ALTER TABLE lists ADD COLUMN ${col};`);
        } catch {
          /* Spalte existiert bereits */
        }
      }
      // `list_id` (v1.72.0) bewusst OHNE `REFERENCES lists(id)`: die Zuordnung
      // ist eine lose Notiz-am-Projekt, keine Besitzverhältnis. Wird die Liste
      // gelöscht, soll die Notiz bleiben — sie ist Inhalt, nicht Zubehör.
      for (const col of ['pinned INTEGER NOT NULL DEFAULT 0', 'deleted_at TEXT', 'list_id TEXT', 'person_id TEXT']) {
        try {
          await db.execAsync(`ALTER TABLE notes ADD COLUMN ${col};`);
        } catch {
          /* Spalte existiert bereits */
        }
      }
      for (const col of ['note_id TEXT', 'deleted_at TEXT', 'list_id TEXT', 'person_id TEXT']) {
        try {
          await db.execAsync(`ALTER TABLE chats ADD COLUMN ${col};`);
        } catch {
          /* Spalte existiert bereits */
        }
      }
      // Telefon, E-Mail und Adressbuch-Herkunft (v1.75.0). Wer die Tabelle
      // schon aus v1.73 hat, bekommt die Spalten hier nachgereicht.
      for (const col of ['phone TEXT', 'email TEXT', 'contact_id TEXT']) {
        try {
          await db.execAsync(`ALTER TABLE people ADD COLUMN ${col};`);
        } catch {
          /* Spalte existiert bereits */
        }
      }
      // Papierkorb der Abendbetrachtung (v1.62.0) — bis dahin verschwand sie
      // als einziger Inhalt der App sofort und endgültig.
      for (const col of ['deleted_at TEXT']) {
        try {
          await db.execAsync(`ALTER TABLE journal ADD COLUMN ${col};`);
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
