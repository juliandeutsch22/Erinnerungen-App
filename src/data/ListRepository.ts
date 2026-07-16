// ListRepository.ts — Interface + In-Memory-Variante (Web/Tests).
import type { List } from './types';

export const DEFAULT_LIST_ID = 'default';

/** Standardliste, die immer existiert (Seed, nicht löschbar). */
export function defaultList(): List {
  return {
    id: DEFAULT_LIST_ID,
    name: 'Erinnerungen',
    icon: 'inbox',
    color: '#2B5FA6',
    goal: null,
    deadline: null,
    sort: 0,
    createdAt: new Date().toISOString(),
  };
}

export interface ListRepository {
  getAll(): Promise<List[]>;
  create(list: List): Promise<void>;
  update(id: string, patch: Partial<Omit<List, 'id'>>): Promise<void>;
  /** Entfernt die Liste UND ihre Aufgaben. Die Standardliste ist nicht löschbar. */
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

export class InMemoryListRepository implements ListRepository {
  private lists = new Map<string, List>();

  constructor() {
    const seed = defaultList();
    this.lists.set(seed.id, seed);
  }

  async getAll(): Promise<List[]> {
    return [...this.lists.values()].sort((a, b) => a.sort - b.sort);
  }

  async create(list: List): Promise<void> {
    this.lists.set(list.id, { ...list });
  }

  async update(id: string, patch: Partial<Omit<List, 'id'>>): Promise<void> {
    const existing = this.lists.get(id);
    if (existing) this.lists.set(id, { ...existing, ...patch });
  }

  async remove(id: string): Promise<void> {
    if (id === DEFAULT_LIST_ID) return;
    this.lists.delete(id);
  }

  async clearAll(): Promise<void> {
    this.lists.clear();
    const seed = defaultList();
    this.lists.set(seed.id, seed);
  }
}
