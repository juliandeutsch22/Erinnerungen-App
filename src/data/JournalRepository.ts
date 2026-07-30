// JournalRepository.ts — Abendbetrachtung: EIN Eintrag pro Tag (date eindeutig).
// Interface + In-Memory (Web/Tests).
export type JournalEntry = {
  id: string;
  /** 'YYYY-MM-DD' — genau ein Eintrag pro Tag. */
  date: string;
  text: string;
  /**
   * Im Papierkorb seit (ISO) — `null` heißt: lebt.
   *
   * Seit v1.62.0. Die Abendbetrachtung war der EINZIGE Inhalt der App, der
   * sofort und endgültig verschwand: Aufgaben, Listen, Notizen und Chats
   * haben alle ihre 30 Tage. Ausgerechnet das Persönlichste hatte keine —
   * und ein Abend, den man aus einer Laune löscht, ist unwiederbringlich.
   */
  deletedAt: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export interface JournalRepository {
  /** ALLE Einträge, auch die im Papierkorb — das Filtern gehört den Hooks. */
  getAll(): Promise<JournalEntry[]>;
  upsert(entry: JournalEntry): Promise<void>;
  /** In den Papierkorb legen (ISO) oder zurückholen (`null`). */
  setDeletedAt(id: string, deletedAt: string | null): Promise<void>;
  /** Endgültig — nur aus dem Papierkorb heraus und nach Ablauf der 30 Tage. */
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
    // Schreibt man an einem Tag erneut, dessen Eintrag im Papierkorb liegt,
    // holt das Schreiben ihn zurück — alles andere wäre eine Falle: der Text
    // stünde da, der Eintrag bliebe aber gelöscht.
    this.byDate.set(
      entry.date,
      existing ? { ...entry, id: existing.id, createdAt: existing.createdAt, deletedAt: null } : { ...entry, deletedAt: null },
    );
  }
  async setDeletedAt(id: string, deletedAt: string | null): Promise<void> {
    // NEUES Objekt, nicht `e.deletedAt = …`. Eine Änderung an Ort und Stelle
    // wandert sonst rückwirkend auch in den bereits ausgelieferten Cache von
    // TanStack Query — dessen Struktur-Vergleich findet dann keinen
    // Unterschied und rendert nicht neu. Der Eintrag wäre gelöscht und stünde
    // trotzdem noch da, bis irgendetwas anderes den Bildschirm anfasst.
    for (const [d, e] of this.byDate) if (e.id === id) this.byDate.set(d, { ...e, deletedAt });
  }
  async remove(id: string): Promise<void> {
    for (const [d, e] of this.byDate) if (e.id === id) this.byDate.delete(d);
  }
  async clearAll(): Promise<void> {
    this.byDate.clear();
  }
}
