// PhotoRepository.ts — Zuordnung Foto ↔ Kalendertermin (EventKit-Event-ID).
// Termine leben im Gerätekalender; die Foto-Verknüpfung (+ Container-Kopie)
// gehört uns. Interface + In-Memory-Variante (Web/Tests).
import { newId } from './types';

export type EventPhoto = {
  id: string;
  eventId: string;
  uri: string;
  addedAt: string; // ISO
};

export interface PhotoRepository {
  getForEvent(eventId: string): Promise<EventPhoto[]>;
  /** Alle Fotos, neueste zuerst — für den Rückblick. */
  getAll(): Promise<EventPhoto[]>;
  add(eventId: string, uris: string[]): Promise<EventPhoto[]>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
  /** Fügt fertige Verknüpfungen ein (Backup-Wiederherstellung, id/addedAt bleiben erhalten). */
  restore(photos: EventPhoto[]): Promise<void>;
}

export function makePhotos(eventId: string, uris: string[], now = new Date()): EventPhoto[] {
  return uris.map((uri, i) => ({
    id: newId(),
    eventId,
    uri,
    // +i ms, damit die Sortierung nach addedAt stabil bleibt.
    addedAt: new Date(now.getTime() + i).toISOString(),
  }));
}

export class InMemoryPhotoRepository implements PhotoRepository {
  private photos: EventPhoto[] = [];

  async getForEvent(eventId: string): Promise<EventPhoto[]> {
    return this.photos.filter((p) => p.eventId === eventId).sort((a, b) => (a.addedAt < b.addedAt ? -1 : 1));
  }

  async getAll(): Promise<EventPhoto[]> {
    return [...this.photos].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  }

  async add(eventId: string, uris: string[]): Promise<EventPhoto[]> {
    const created = makePhotos(eventId, uris);
    this.photos.push(...created);
    return created;
  }

  async remove(id: string): Promise<void> {
    this.photos = this.photos.filter((p) => p.id !== id);
  }

  async clearAll(): Promise<void> {
    this.photos = [];
  }

  async restore(photos: EventPhoto[]): Promise<void> {
    this.photos.push(...photos);
  }
}
