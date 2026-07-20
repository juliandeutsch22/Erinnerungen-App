// data/index.ts — Repository-Factory. Wählt Persistenz nach Plattform:
// nativ → expo-sqlite (offline-first), Web → In-Memory (Web = reine Dev-Preview).
import { Platform } from 'react-native';

import { ChatRepository, InMemoryChatRepository } from './ChatRepository';
import { InMemoryListRepository, ListRepository } from './ListRepository';
import { InMemoryNoteRepository, NoteRepository } from './NoteRepository';
import { InMemoryPhotoRepository, PhotoRepository } from './PhotoRepository';
import { InMemoryTaskRepository, TaskRepository } from './TaskRepository';

let listSingleton: ListRepository | null = null;
let taskSingleton: TaskRepository | null = null;
let photoSingleton: PhotoRepository | null = null;
let noteSingleton: NoteRepository | null = null;
let chatSingleton: ChatRepository | null = null;

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

export function getPhotoRepository(): PhotoRepository {
  if (photoSingleton) return photoSingleton;
  if (Platform.OS === 'web') {
    photoSingleton = new InMemoryPhotoRepository();
  } else {
    const { SqlitePhotoRepository } = require('./SqlitePhotoRepository') as typeof import('./SqlitePhotoRepository');
    photoSingleton = new SqlitePhotoRepository();
  }
  return photoSingleton;
}

export function getNoteRepository(): NoteRepository {
  if (noteSingleton) return noteSingleton;
  if (Platform.OS === 'web') {
    noteSingleton = new InMemoryNoteRepository();
  } else {
    const { SqliteNoteRepository } = require('./SqliteNoteRepository') as typeof import('./SqliteNoteRepository');
    noteSingleton = new SqliteNoteRepository();
  }
  return noteSingleton;
}

export function getChatRepository(): ChatRepository {
  if (chatSingleton) return chatSingleton;
  if (Platform.OS === 'web') {
    chatSingleton = new InMemoryChatRepository();
  } else {
    const { SqliteChatRepository } = require('./SqliteChatRepository') as typeof import('./SqliteChatRepository');
    chatSingleton = new SqliteChatRepository();
  }
  return chatSingleton;
}

/** Nur für Tests: erlaubt das Einsetzen eigener Repository-Instanzen. */
export function __setListRepositoryForTests(repo: ListRepository | null) {
  listSingleton = repo;
}
export function __setTaskRepositoryForTests(repo: TaskRepository | null) {
  taskSingleton = repo;
}
export function __setPhotoRepositoryForTests(repo: PhotoRepository | null) {
  photoSingleton = repo;
}
export function __setNoteRepositoryForTests(repo: NoteRepository | null) {
  noteSingleton = repo;
}
export function __setChatRepositoryForTests(repo: ChatRepository | null) {
  chatSingleton = repo;
}

export type { ListRepository } from './ListRepository';
export type { TaskRepository } from './TaskRepository';
export type { PhotoRepository } from './PhotoRepository';
export type { NoteRepository } from './NoteRepository';
export type { ChatRepository } from './ChatRepository';
