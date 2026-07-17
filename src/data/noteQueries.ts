// noteQueries.ts — TanStack-Query-Hooks für Notizen. Eine Quelle (['notes']),
// alle Ableitungen (pro Aufgabe/Termin, Suche) sind reine In-Memory-Filter.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getNoteRepository } from './index';
import type { Note } from './types';
import { newId } from './types';

const notesKey = ['notes'] as const;

export function useNotes() {
  return useQuery<Note[]>({ queryKey: notesKey, queryFn: () => getNoteRepository().getAll() });
}

function useInvalidateNotes() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: notesKey });
}

/** Legt eine (meist leere) Notiz an und liefert sie zurück — der Editor
 *  übernimmt ab da (iOS-Verhalten: erst anlegen, dann schreiben). */
export function useCreateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: async (input: { body?: string; taskId?: string | null; eventId?: string | null }) => {
      const now = new Date().toISOString();
      const note: Note = {
        id: newId(),
        body: input.body ?? '',
        taskId: input.taskId ?? null,
        eventId: input.eventId ?? null,
        pinned: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await getNoteRepository().create(note);
      return note;
    },
    onSuccess: invalidate,
  });
}

/** Autosave aus dem Editor: aktualisiert body (und updatedAt). */
export function useUpdateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<Note, 'id' | 'createdAt'>> }) => {
      await getNoteRepository().update(id, { ...patch, updatedAt: new Date().toISOString() });
    },
    onSuccess: invalidate,
  });
}

export function useDeleteNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (id: string) => getNoteRepository().remove(id),
    onSuccess: invalidate,
  });
}
