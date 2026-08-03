// EventPersonRepository.ts — Zuordnung Mensch ↔ Kalendertermin (EventKit-ID).
//
// Warum eine EIGENE Tabelle und nicht die Teilnehmer des Termins: EventKit
// gibt Teilnehmer nur LESEND heraus — `EKEvent` hat kein Feld, das die App
// setzen dürfte, ohne die Einladungs-Verwaltung des Systems anzufassen (und
// die verschickt Mails). Stoa macht es deshalb wie bei Fotos und Dokumenten:
// der Termin gehört dem Gerätekalender, die Verknüpfung gehört uns.
//
// Anders als bei Aufgabe/Notiz/Chat sind es MEHRERE Menschen pro Termin — ein
// Abendessen hat selten genau einen Teilnehmer.
import { newId } from './types';

export type EventPerson = {
  id: string;
  eventId: string;
  personId: string;
  addedAt: string; // ISO
};

export interface EventPersonRepository {
  /** Alle Verknüpfungen — die Ableitungen (pro Termin, pro Mensch) sind Filter. */
  getAll(): Promise<EventPerson[]>;
  /** Hängt einen Menschen an einen Termin. Doppelt anhängen tut nichts. */
  link(eventId: string, personId: string): Promise<EventPerson | null>;
  unlink(eventId: string, personId: string): Promise<void>;
  /** Löst ALLE Verknüpfungen eines Menschen (beim Löschen der Person). */
  removeForPerson(personId: string): Promise<void>;
  clearAll(): Promise<void>;
  /** Fügt fertige Verknüpfungen ein (Backup — id/addedAt bleiben erhalten). */
  restore(links: EventPerson[]): Promise<void>;
}

export class InMemoryEventPersonRepository implements EventPersonRepository {
  private links: EventPerson[] = [];

  async getAll(): Promise<EventPerson[]> {
    return [...this.links].sort((a, b) => (a.addedAt < b.addedAt ? -1 : 1));
  }

  async link(eventId: string, personId: string): Promise<EventPerson | null> {
    if (this.links.some((l) => l.eventId === eventId && l.personId === personId)) return null;
    const neu: EventPerson = { id: newId(), eventId, personId, addedAt: new Date().toISOString() };
    this.links.push(neu);
    return neu;
  }

  async unlink(eventId: string, personId: string): Promise<void> {
    this.links = this.links.filter((l) => !(l.eventId === eventId && l.personId === personId));
  }

  async removeForPerson(personId: string): Promise<void> {
    this.links = this.links.filter((l) => l.personId !== personId);
  }

  async clearAll(): Promise<void> {
    this.links = [];
  }

  async restore(links: EventPerson[]): Promise<void> {
    this.links.push(...links);
  }
}
