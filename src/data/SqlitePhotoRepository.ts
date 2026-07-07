// SqlitePhotoRepository.ts — expo-sqlite-Persistenz der Foto-Verknüpfungen (nativ).
import { getDb } from './db';
import { EventPhoto, makePhotos, PhotoRepository } from './PhotoRepository';

type Row = { id: string; event_id: string; uri: string; added_at: string };

function toPhoto(r: Row): EventPhoto {
  return { id: r.id, eventId: r.event_id, uri: r.uri, addedAt: r.added_at };
}

export class SqlitePhotoRepository implements PhotoRepository {
  async getForEvent(eventId: string): Promise<EventPhoto[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>('SELECT * FROM event_photos WHERE event_id = ? ORDER BY added_at ASC', [eventId]);
    return rows.map(toPhoto);
  }

  async getAll(): Promise<EventPhoto[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>('SELECT * FROM event_photos ORDER BY added_at DESC');
    return rows.map(toPhoto);
  }

  async add(eventId: string, uris: string[]): Promise<EventPhoto[]> {
    const db = await getDb();
    const created = makePhotos(eventId, uris);
    await db.withTransactionAsync(async () => {
      for (const p of created) {
        await db.runAsync('INSERT OR REPLACE INTO event_photos (id, event_id, uri, added_at) VALUES (?, ?, ?, ?)', [
          p.id,
          p.eventId,
          p.uri,
          p.addedAt,
        ]);
      }
    });
    return created;
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM event_photos WHERE id = ?', [id]);
  }

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM event_photos;');
  }
}
