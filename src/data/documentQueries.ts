// documentQueries.ts — TanStack-Query-Hooks für Termin-Dokumente.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { EventDocument, makeDocument } from './DocumentRepository';
import { getDocumentRepository } from './index';

const docsKey = ['event-documents'] as const;

export function useDocuments() {
  return useQuery<EventDocument[]>({ queryKey: docsKey, queryFn: () => getDocumentRepository().getAll() });
}

/** Dokument-Anzahl je Termin (Glyph an der Termin-Zeile). */
export function useDocumentCounts(): Map<string, number> {
  const { data } = useDocuments();
  return useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data ?? []) map.set(d.eventId, (map.get(d.eventId) ?? 0) + 1);
    return map;
  }, [data]);
}

export function useAddDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, name, uri }: { eventId: string; name: string; uri: string }) => {
      await getDocumentRepository().add(makeDocument(eventId, name, uri));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: docsKey }),
  });
}

export function useRemoveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getDocumentRepository().remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: docsKey }),
  });
}
