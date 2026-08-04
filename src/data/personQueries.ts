// personQueries.ts — TanStack-Query-Hooks für Personen. Eine Quelle
// (['people']); alles Weitere (was hängt an wem) ist ein reiner Filter über
// Aufgaben, Notizen und Chats.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { findePerson, personNachtrag } from '@/lib/personMerge';

import { eventPeopleKey } from './eventPersonQueries';
import { getChatRepository, getEventPersonRepository, getNoteRepository, getPersonRepository, getTaskRepository } from './index';
import { queryKeys } from './queries';
import type { NewPerson, Person } from './types';
import { newId } from './types';

export const peopleKey = ['people'] as const;

export function usePeople() {
  return useQuery<Person[]>({ queryKey: peopleKey, queryFn: () => getPersonRepository().getAll() });
}

function useInvalidatePeople() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: peopleKey });
}

/**
 * Legt eine Person an — oder gibt die vorhandene zurück, wenn es sie schon
 * gibt. „Anna", „anna" und „Anna " sind dieselbe Person; zwei Einträge mit
 * demselben Namen wären für den Nutzer nicht unterscheidbar und würden seine
 * offenen Punkte auf zwei Ansichten verteilen.
 *
 * Seit v1.75.0 zählt zusätzlich die Adressbuch-Herkunft: derselbe Kontakt
 * zweimal importiert bleibt EINE Person, auch wenn sie im Adressbuch inzwischen
 * anders heißt. Der vorhandene Eintrag bekommt dabei nachgereicht, was ihm
 * fehlt (Nummer, E-Mail, Herkunft) — aber nichts wird überschrieben, was schon
 * dasteht: was von Hand getippt wurde, gehört dem Nutzer.
 */
export function useCreatePerson() {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: async (input: NewPerson) => {
      const name = input.name.trim();
      const alle = await getPersonRepository().getAll();
      const vorhanden = findePerson(alle, { ...input, name });
      if (vorhanden) {
        const nachtrag = personNachtrag(vorhanden, { ...input, name });
        if (Object.keys(nachtrag).length > 0) {
          await getPersonRepository().update(vorhanden.id, nachtrag);
          return { ...vorhanden, ...nachtrag };
        }
        return vorhanden;
      }
      const person: Person = {
        id: newId(),
        name,
        note: input.note ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        contactId: input.contactId ?? null,
        sort: Date.now(),
        createdAt: new Date().toISOString(),
      };
      await getPersonRepository().create(person);
      return person;
    },
    onSuccess: invalidate,
  });
}

export function useUpdatePerson() {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<Person, 'id'>> }) =>
      getPersonRepository().update(id, patch),
    onSuccess: invalidate,
  });
}

/**
 * Löscht die Person und löst ALLE Zuordnungen.
 *
 * Das Lösen steht hier und nicht im InMemory-Repository, weil dieses die
 * anderen Repositories nicht kennt — stünde es nur im SQLite-Pfad, verhielte
 * sich das Gerät anders als der Prüfstand. Reihenfolge wie dort: erst lösen,
 * dann löschen. Was bleibt, ist die Aufgabe; verloren geht nur die Zuordnung.
 */
export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const [tasks, notes, chats] = await Promise.all([
        getTaskRepository().getAll(),
        getNoteRepository().getAll(),
        getChatRepository().getAll(),
      ]);
      for (const t of tasks) if (t.personId === id) await getTaskRepository().update(t.id, { personId: null });
      for (const n of notes) if (n.personId === id) await getNoteRepository().update(n.id, { personId: null });
      for (const c of chats) if (c.personId === id) await getChatRepository().update(c.id, { personId: null });
      // Termin-Verknüpfungen liegen in einer eigenen Tabelle — sie müssen
      // ausdrücklich mit weg, sonst bliebe ein Termin an einer Person
      // hängen, den es nicht mehr gibt.
      await getEventPersonRepository().removeForPerson(id);
      await getPersonRepository().remove(id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: peopleKey });
      void qc.invalidateQueries({ queryKey: queryKeys.tasks });
      void qc.invalidateQueries({ queryKey: ['notes'] });
      void qc.invalidateQueries({ queryKey: ['chats'] });
      void qc.invalidateQueries({ queryKey: eventPeopleKey });
    },
  });
}
