// SqliteDocumentRepository.ts — expo-sqlite-Persistenz der Termin-Dokumente.
import { getDb } from './db';
import { DocumentRepository, EventDocument } from './DocumentRepository';

type Row = { id: string; event_id: string; name: string; uri: string; added_at: string };
const toDoc = (r: Row): EventDocument => ({ id: r.id, eventId: r.event_id, name: r.name, uri: r.uri, addedAt: r.added_at });

export class SqliteDocumentRepository implements DocumentRepository {
  async getAll(): Promise<EventDocument[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>('SELECT * FROM event_documents ORDER BY added_at DESC');
    return rows.map(toDoc);
  }
  async add(doc: EventDocument): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO event_documents (id, event_id, name, uri, added_at) VALUES (?, ?, ?, ?, ?)',
      [doc.id, doc.eventId, doc.name, doc.uri, doc.addedAt],
    );
  }
  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM event_documents WHERE id = ?', [id]);
  }
  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM event_documents;');
  }
  async restore(docs: EventDocument[]): Promise<void> {
    await this.clearAll();
    for (const d of docs) await this.add(d);
  }
}
