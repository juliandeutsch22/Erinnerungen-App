// NoteRepository.ts — Interface + In-Memory-Variante (Web/Tests) für Notizen.
// Eine Notiz ist Inhalt ohne Handlung: nur Text (body), optional an EINE
// Erinnerung (taskId) und/oder EINEN Termin (eventId) gehängt.
import type { Note } from './types';

export interface NoteRepository {
  getAll(): Promise<Note[]>;
  create(note: Note): Promise<void>;
  update(id: string, patch: Partial<Omit<Note, 'id'>>): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

export class InMemoryNoteRepository implements NoteRepository {
  private notes = new Map<string, Note>();

  async getAll(): Promise<Note[]> {
    // Neueste Bearbeitung zuerst — die Reihenfolge der Notizen-Liste.
    return [...this.notes.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async create(note: Note): Promise<void> {
    this.notes.set(note.id, { ...note });
  }

  async update(id: string, patch: Partial<Omit<Note, 'id'>>): Promise<void> {
    const existing = this.notes.get(id);
    if (existing) this.notes.set(id, { ...existing, ...patch });
  }

  async remove(id: string): Promise<void> {
    this.notes.delete(id);
  }

  async clearAll(): Promise<void> {
    this.notes.clear();
  }
}
