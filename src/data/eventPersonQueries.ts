// eventPersonQueries.ts — Hooks für „wer ist bei diesem Termin dabei".
// EINE Quelle (['event-people']) mit allen Verknüpfungen; die Ableitungen
// (pro Termin, pro Person) sind reine Filter — wie bei Notizen und Fotos.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EventPerson } from './EventPersonRepository';
import { getEventPersonRepository } from './index';

export const eventPeopleKey = ['event-people'] as const;

export function useEventPeople() {
  return useQuery<EventPerson[]>({ queryKey: eventPeopleKey, queryFn: () => getEventPersonRepository().getAll() });
}

/** Hängt eine Person an einen Termin oder löst sie wieder — ein Aufruf. */
export function useToggleEventPerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, personId, dran }: { eventId: string; personId: string; dran: boolean }) => {
      if (dran) await getEventPersonRepository().unlink(eventId, personId);
      else await getEventPersonRepository().link(eventId, personId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: eventPeopleKey }),
  });
}
