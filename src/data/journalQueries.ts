// journalQueries.ts — TanStack-Query-Hooks für die Abendbetrachtung.
//
// Der Papierkorb (v1.62.0) wird HIER getrennt, nicht in den Bildschirmen:
// `useJournal()` liefert nur, was lebt. Damit bleiben Abendkarte, Kette,
// Gruppierung und der „Heute"-Bildschirm richtig, ohne dass jeder von ihnen
// an `deletedAt` denken muss — genau die Buchhaltung, die man beim dritten
// Aufrufer vergisst.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getJournalRepository } from './index';
import type { JournalEntry } from './JournalRepository';
import { newId } from './types';

const journalKey = ['journal'] as const;

/** Wie lange ein gelöschter Abend zurückholbar bleibt — wie bei Notizen und Chats. */
export const JOURNAL_TRASH_DAYS = 30;

function useAlleJournal() {
  return useQuery<JournalEntry[]>({ queryKey: journalKey, queryFn: () => getJournalRepository().getAll() });
}

/** Die lebenden Einträge — alles, was die App sonst „die Betrachtungen" nennt. */
export function useJournal() {
  const q = useAlleJournal();
  const data = useMemo(() => q.data?.filter((e) => e.deletedAt === null), [q.data]);
  return { ...q, data };
}

/** Nur der Papierkorb, neueste Löschung zuerst. */
export function useJournalTrash() {
  const q = useAlleJournal();
  const data = useMemo(
    () =>
      q.data
        ?.filter((e) => e.deletedAt !== null)
        .sort((a, b) => ((a.deletedAt ?? '') < (b.deletedAt ?? '') ? 1 : -1)),
    [q.data],
  );
  return { ...q, data };
}

/** In den Papierkorb legen — der normale Weg beim Löschen. */
export function useTrashJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getJournalRepository().setDeletedAt(id, new Date().toISOString()),
    onSuccess: () => void qc.invalidateQueries({ queryKey: journalKey }),
  });
}

/** Zurückholen. */
export function useRestoreJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getJournalRepository().setDeletedAt(id, null),
    onSuccess: () => void qc.invalidateQueries({ queryKey: journalKey }),
  });
}

/** Endgültig — nur aus dem Papierkorb heraus und beim Ablauf der 30 Tage. */
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
      await getJournalRepository().upsert({ id: newId(), date, text, deletedAt: null, createdAt: now, updatedAt: now });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: journalKey }),
  });
}
