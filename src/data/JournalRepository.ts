// JournalRepository.ts — Abendbetrachtung: EIN Eintrag pro Tag (date eindeutig).
// Interface + In-Memory (Web/Tests).
export type JournalEntry = {
  id: string;
  /** 'YYYY-MM-DD' — genau ein Eintrag pro Tag. */
  date: string;
  text: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export interface JournalRepository {
  getAll(): Promise<JournalEntry[]>;
  upsert(entry: JournalEntry): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

export class InMemoryJournalRepository implements JournalRepository {
  private byDate = new Map<string, JournalEntry>();

  async getAll(): Promise<JournalEntry[]> {
    return [...this.byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  async upsert(entry: JournalEntry): Promise<void> {
    const existing = this.byDate.get(entry.date);
    this.byDate.set(entry.date, existing ? { ...entry, id: existing.id, createdAt: existing.createdAt } : { ...entry });
  }
  async remove(id: string): Promise<void> {
    for (const [d, e] of this.byDate) if (e.id === id) this.byDate.delete(d);
  }
  async clearAll(): Promise<void> {
    this.byDate.clear();
  }
}
