// data/index.ts — Repository-Factory. Wählt Persistenz nach Plattform:
// nativ → expo-sqlite (offline-first), Web → In-Memory (Web = reine Dev-Preview).
import { Platform } from 'react-native';

import { InMemoryListRepository, ListRepository } from './ListRepository';
import { InMemoryTaskRepository, TaskRepository } from './TaskRepository';

let listSingleton: ListRepository | null = null;
let taskSingleton: TaskRepository | null = null;

export function getListRepository(): ListRepository {
  if (listSingleton) return listSingleton;
  if (Platform.OS === 'web') {
    listSingleton = new InMemoryListRepository();
  } else {
    // Lazy require, damit der Web-Bundle expo-sqlite nicht zieht.
    const { SqliteListRepository } = require('./SqliteListRepository') as typeof import('./SqliteListRepository');
    listSingleton = new SqliteListRepository();
  }
  return listSingleton;
}

export function getTaskRepository(): TaskRepository {
  if (taskSingleton) return taskSingleton;
  if (Platform.OS === 'web') {
    taskSingleton = new InMemoryTaskRepository();
  } else {
    const { SqliteTaskRepository } = require('./SqliteTaskRepository') as typeof import('./SqliteTaskRepository');
    taskSingleton = new SqliteTaskRepository();
  }
  return taskSingleton;
}

/** Nur für Tests: erlaubt das Einsetzen eigener Repository-Instanzen. */
export function __setListRepositoryForTests(repo: ListRepository | null) {
  listSingleton = repo;
}
export function __setTaskRepositoryForTests(repo: TaskRepository | null) {
  taskSingleton = repo;
}

export type { ListRepository } from './ListRepository';
export type { TaskRepository } from './TaskRepository';
