// journalQueries.ts — TanStack-Query-Hooks für die Abendbetrachtung.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getJournalRepository } from './index';
import type { JournalEntry } from './JournalRepository';
import { newId } from './types';

const journalKey = ['journal'] as const;

export function useJournal() {
  return useQuery<JournalEntry[]>({ queryKey: journalKey, queryFn: () => getJournalRepository().getAll() });
}

export function useRemoveJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getJournalRepository().remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: journalKey }),
  });
}

/** Upsert des Tages-Eintrags (Autosave aus der Karte). */
export function useSaveJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, text }: { date: string; text: string }) => {
      const now = new Date().toISOString();
      await getJournalRepository().upsert({ id: newId(), date, text, createdAt: now, updatedAt: now });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: journalKey }),
  });
}
