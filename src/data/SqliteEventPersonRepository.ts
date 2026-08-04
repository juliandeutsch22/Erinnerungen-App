// SqliteEventPersonRepository.ts — expo-sqlite-Persistenz der Termin-Personen.
import { getDb } from './db';
import { type EventPerson, EventPersonRepository } from './EventPersonRepository';
import { newId } from './types';

type Row = { id: string; event_id: string; person_id: string; added_at: string };

function toLink(r: Row): EventPerson {
  return { id: r.id, eventId: r.event_id, personId: r.person_id, addedAt: r.added_at };
}

export class SqliteEventPersonRepository implements EventPersonRepository {
  async getAll(): Promise<EventPerson[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>('SELECT * FROM event_people ORDER BY added_at ASC');
    return rows.map(toLink);
  }

  async link(eventId: string, personId: string): Promise<EventPerson | null> {
    const db = await getDb();
    const vorhanden = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM event_people WHERE event_id = ? AND person_id = ?',
      [eventId, personId],
    );
    if (vorhanden && vorhanden.c > 0) return null;
    const neu: EventPerson = { id: newId(), eventId, personId, addedAt: new Date().toISOString() };
    await db.runAsync(
      'INSERT OR REPLACE INTO event_people (id, event_id, person_id, added_at) VALUES (?, ?, ?, ?)',
      [neu.id, neu.eventId, neu.personId, neu.addedAt],
    );
    return neu;
  }

  async unlink(eventId: string, personId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM event_people WHERE event_id = ? AND person_id = ?', [eventId, personId]);
  }

  async removeForPerson(personId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM event_people WHERE person_id = ?', [personId]);
  }

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM event_people;');
  }

  async restore(links: EventPerson[]): Promise<void> {
    const db = await getDb();
    for (const l of links) {
      await db.runAsync(
        'INSERT OR REPLACE INTO event_people (id, event_id, person_id, added_at) VALUES (?, ?, ?, ?)',
        [l.id, l.eventId, l.personId, l.addedAt],
      );
    }
  }
}
