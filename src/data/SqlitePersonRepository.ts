// SqlitePersonRepository.ts — expo-sqlite-Persistenz die Personen (nativ).
import { getDb } from './db';
import { PersonRepository } from './PersonRepository';
import type { Person } from './types';

type PersonRow = {
  id: string; name: string; note: string | null;
  phone: string | null; email: string | null; contact_id: string | null;
  sort: number; created_at: string;
};

function toPerson(r: PersonRow): Person {
  return {
    id: r.id,
    name: r.name,
    note: r.note ?? null,
    // Nachgerüstete Spalten (v1.75.0) — alte Zeilen liefern `undefined`.
    phone: r.phone ?? null,
    email: r.email ?? null,
    contactId: r.contact_id ?? null,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

export class SqlitePersonRepository implements PersonRepository {
  async getAll(): Promise<Person[]> {
    const db = await getDb();
    // SQLite sortiert ohne Locale; die deutsche Ordnung stellt die
    // InMemory-Variante her — hier reicht eine stabile, grobe Reihenfolge,
    // die der Aufrufer ohnehin nicht auswertet.
    const rows = await db.getAllAsync<PersonRow>('SELECT * FROM people ORDER BY name COLLATE NOCASE ASC');
    return rows.map(toPerson);
  }

  async create(person: Person): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO people (id, name, note, phone, email, contact_id, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [person.id, person.name, person.note, person.phone ?? null, person.email ?? null, person.contactId ?? null, person.sort, person.createdAt],
    );
  }

  async update(id: string, patch: Partial<Omit<Person, 'id'>>): Promise<void> {
    const db = await getDb();
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    if (patch.name !== undefined) { sets.push('name = ?'); args.push(patch.name); }
    if (patch.note !== undefined) { sets.push('note = ?'); args.push(patch.note); }
    if (patch.phone !== undefined) { sets.push('phone = ?'); args.push(patch.phone ?? null); }
    if (patch.email !== undefined) { sets.push('email = ?'); args.push(patch.email ?? null); }
    if (patch.contactId !== undefined) { sets.push('contact_id = ?'); args.push(patch.contactId ?? null); }
    if (patch.sort !== undefined) { sets.push('sort = ?'); args.push(patch.sort); }
    if (sets.length === 0) return;
    args.push(id);
    await db.runAsync(`UPDATE people SET ${sets.join(', ')} WHERE id = ?`, args);
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    // In EINEM Zug: erst die Zuordnungen lösen, dann die Person. Andersherum
    // bliebe bei einem Abbruch mitten drin eine Aufgabe an einer Person hängen,
    // die es nicht mehr gibt — und sie wäre über keine Ansicht mehr erreichbar.
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE tasks SET person_id = NULL WHERE person_id = ?', [id]);
      await db.runAsync('UPDATE notes SET person_id = NULL WHERE person_id = ?', [id]);
      await db.runAsync('UPDATE chats SET person_id = NULL WHERE person_id = ?', [id]);
      await db.runAsync('DELETE FROM people WHERE id = ?', [id]);
    });
  }

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM people;');
  }
}
