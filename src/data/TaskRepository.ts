// TaskRepository.ts — Interface + In-Memory-Variante (Web/Tests).
// getAll() liefert bewusst ALLE Aufgaben (inkl. erledigter): bei persönlicher
// Nutzung (hunderte, nicht Millionen) sind Smart-Ansichten/Suche als reine
// In-Memory-Ableitungen einfacher und immer konsistent.
import type { Task } from './types';

export interface TaskRepository {
  getAll(): Promise<Task[]>;
  create(task: Task): Promise<void>;
  update(id: string, patch: Partial<Omit<Task, 'id'>>): Promise<void>;
  remove(id: string): Promise<void>;
  removeByList(listId: string): Promise<void>;
  clearAll(): Promise<void>;
}

export class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, Task>();

  async getAll(): Promise<Task[]> {
    return [...this.tasks.values()].sort((a, b) => a.sort - b.sort);
  }

  async create(task: Task): Promise<void> {
    this.tasks.set(task.id, { ...task });
  }

  async update(id: string, patch: Partial<Omit<Task, 'id'>>): Promise<void> {
    const existing = this.tasks.get(id);
    if (existing) this.tasks.set(id, { ...existing, ...patch });
  }

  async remove(id: string): Promise<void> {
    this.tasks.delete(id);
  }

  async removeByList(listId: string): Promise<void> {
    for (const [id, t] of this.tasks) {
      if (t.listId === listId) this.tasks.delete(id);
    }
  }

  async clearAll(): Promise<void> {
    this.tasks.clear();
  }
}
