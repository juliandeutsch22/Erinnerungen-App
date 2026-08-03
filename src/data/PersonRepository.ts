// PersonRepository.ts — Interface + In-Memory-Variante (Web/Tests) für Menschen.
//
// Eine Person ist bewusst schlank: ein Name, eine freie Notiz, sonst nichts.
// Sie ist kein Adressbuch-Eintrag, sondern ein Anker, an dem Aufgaben, Notizen
// und Chats hängen können (siehe `Person` in types.ts).
//
// KEIN Papierkorb: eine Person trägt keinen Inhalt, den man verlieren könnte —
// beim Löschen bleiben Aufgaben und Notizen bestehen, sie sind danach nur
// niemandem mehr zugeordnet. Das übernimmt `remove` selbst (siehe dort).
import type { Person } from './types';

export interface PersonRepository {
  getAll(): Promise<Person[]>;
  create(person: Person): Promise<void>;
  update(id: string, patch: Partial<Omit<Person, 'id'>>): Promise<void>;
  /** Entfernt die Person UND löst alle Zuordnungen (Aufgaben/Notizen/Chats). */
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

export class InMemoryPersonRepository implements PersonRepository {
  private people = new Map<string, Person>();

  async getAll(): Promise<Person[]> {
    // Alphabetisch — ein Namensverzeichnis, keine Chronik.
    return [...this.people.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  async create(person: Person): Promise<void> {
    this.people.set(person.id, { ...person });
  }

  async update(id: string, patch: Partial<Omit<Person, 'id'>>): Promise<void> {
    const existing = this.people.get(id);
    if (existing) this.people.set(id, { ...existing, ...patch });
  }

  async remove(id: string): Promise<void> {
    // Die InMemory-Variante kennt die anderen Repositories nicht; das Lösen der
    // Zuordnungen übernimmt der aufrufende Hook (personQueries), damit Web und
    // Gerät exakt dieselbe Reihenfolge haben.
    this.people.delete(id);
  }

  async clearAll(): Promise<void> {
    this.people.clear();
  }
}
