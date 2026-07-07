// photoQueries.ts — TanStack-Query-Hooks über das PhotoRepository + das
// Kopieren/Löschen der Dateien im App-Container.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteStoredPhoto } from '@/lib/photos';
import { getPhotoRepository } from './index';
import type { EventPhoto } from './PhotoRepository';

export const photoKeys = {
  forEvent: (eventId: string) => ['photos', 'event', eventId] as const,
  all: ['photos', 'all'] as const,
};

export function useEventPhotos(eventId: string | null) {
  return useQuery<EventPhoto[]>({
    queryKey: photoKeys.forEvent(eventId ?? ''),
    queryFn: () => getPhotoRepository().getForEvent(eventId as string),
    enabled: !!eventId,
  });
}

export function useAllPhotos() {
  return useQuery<EventPhoto[]>({ queryKey: photoKeys.all, queryFn: () => getPhotoRepository().getAll() });
}

/** Foto-Anzahl je Termin-ID — für Indikatoren in der Agenda (eine Query). */
export function usePhotoCounts(): Map<string, number> {
  const { data } = useAllPhotos();
  const map = new Map<string, number>();
  for (const p of data ?? []) map.set(p.eventId, (map.get(p.eventId) ?? 0) + 1);
  return map;
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ['photos'] });
}

/** URIs sind bereits in den Container kopiert (lib/photos) — hier nur verknüpfen. */
export function useAddPhotos() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ eventId, uris }: { eventId: string; uris: string[] }) =>
      getPhotoRepository().add(eventId, uris),
    onSuccess: invalidate,
  });
}

export function useRemovePhoto() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (photo: EventPhoto) => {
      await getPhotoRepository().remove(photo.id);
      deleteStoredPhoto(photo.uri);
    },
    onSuccess: invalidate,
  });
}
