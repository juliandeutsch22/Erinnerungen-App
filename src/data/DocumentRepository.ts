// DocumentRepository.ts — Dokumente (Tickets, PDFs, …) ↔ Kalendertermin
// (EventKit-Event-ID), exakt das Foto-Muster: Container-Kopie gehört uns,
// der Termin lebt im Gerätekalender. Interface + In-Memory (Web/Tests).
import { newId } from './types';

export type EventDocument = {
  id: string;
  eventId: string;
  /** Ursprünglicher Dateiname (Anzeige). */
  name: string;
  /** URI der Container-Kopie. */
  uri: string;
  addedAt: string; // ISO
};

export interface DocumentRepository {
  getAll(): Promise<EventDocument[]>;
  add(doc: EventDocument): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
  /** Backup-Wiederherstellung (id/addedAt bleiben erhalten). */
  restore(docs: EventDocument[]): Promise<void>;
}

export function makeDocument(eventId: string, name: string, uri: string, now = new Date()): EventDocument {
  return { id: newId(), eventId, name, uri, addedAt: now.toISOString() };
}

export class InMemoryDocumentRepository implements DocumentRepository {
  private docs = new Map<string, EventDocument>();

  async getAll(): Promise<EventDocument[]> {
    return [...this.docs.values()].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  }
  async add(doc: EventDocument): Promise<void> {
    this.docs.set(doc.id, { ...doc });
  }
  async remove(id: string): Promise<void> {
    this.docs.delete(id);
  }
  async clearAll(): Promise<void> {
    this.docs.clear();
  }
  async restore(docs: EventDocument[]): Promise<void> {
    this.docs.clear();
    for (const d of docs) this.docs.set(d.id, { ...d });
  }
}
