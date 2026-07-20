// SqliteJournalRepository.ts — expo-sqlite-Persistenz der Abendbetrachtungen.
import { getDb } from './db';
import { JournalEntry, JournalRepository } from './JournalRepository';

type Row = { id: string; date: string; text: string; created_at: string; updated_at: string };
const toEntry = (r: Row): JournalEntry => ({ id: r.id, date: r.date, text: r.text, createdAt: r.created_at, updatedAt: r.updated_at });

export class SqliteJournalRepository implements JournalRepository {
  async getAll(): Promise<JournalEntry[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>('SELECT * FROM journal ORDER BY date DESC');
    return rows.map(toEntry);
  }
  async upsert(entry: JournalEntry): Promise<void> {
    const db = await getDb();
    // date ist UNIQUE — bestehender Eintrag des Tages behält id/createdAt.
    const existing = await db.getFirstAsync<Row>('SELECT * FROM journal WHERE date = ?', [entry.date]);
    if (existing) {
      await db.runAsync('UPDATE journal SET text = ?, updated_at = ? WHERE date = ?', [entry.text, entry.updatedAt, entry.date]);
    } else {
      await db.runAsync(
        'INSERT INTO journal (id, date, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [entry.id, entry.date, entry.text, entry.createdAt, entry.updatedAt],
      );
    }
  }
  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM journal WHERE id = ?', [id]);
  }
  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM journal;');
  }
}
