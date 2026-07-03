// kvStorage.ts — plattformübergreifender Key-Value-Speicher für die zustand-
// Persistenz (Theme/Motion/Onboarding + Account/Entitlement). Bewusst OHNE neue
// Abhängigkeit: nativ über das bereits genutzte expo-sqlite (dieselbe stille.db),
// im Web über localStorage. Erfüllt das zustand `StateStorage`-Interface.
import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'stille.db';

function createWebStorage(): StateStorage {
  return {
    getItem: (name) => {
      try {
        return globalThis.localStorage?.getItem(name) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        globalThis.localStorage?.setItem(name, value);
      } catch {
        /* Speicher nicht verfügbar (z. B. Private Mode) → still ignorieren. */
      }
    },
    removeItem: (name) => {
      try {
        globalThis.localStorage?.removeItem(name);
      } catch {
        /* s. o. */
      }
    },
  };
}

function createNativeStorage(): StateStorage {
  // Lazy require, damit der Web-Bundle expo-sqlite nicht zieht (wie in data/index.ts).
  const { openDatabaseAsync } = require('expo-sqlite') as typeof import('expo-sqlite');
  type DB = import('expo-sqlite').SQLiteDatabase;

  let dbPromise: Promise<DB> | null = null;
  const db = (): Promise<DB> => {
    if (!dbPromise) {
      dbPromise = (async () => {
        const database = await openDatabaseAsync(DB_NAME);
        await database.execAsync('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);');
        return database;
      })();
    }
    return dbPromise;
  };

  return {
    getItem: async (name) => {
      const database = await db();
      const row = await database.getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', [name]);
      return row?.v ?? null;
    },
    setItem: async (name, value) => {
      const database = await db();
      await database.runAsync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', [name, value]);
    },
    removeItem: async (name) => {
      const database = await db();
      await database.runAsync('DELETE FROM kv WHERE k = ?', [name]);
    },
  };
}

export const kvStorage: StateStorage = Platform.OS === 'web' ? createWebStorage() : createNativeStorage();
