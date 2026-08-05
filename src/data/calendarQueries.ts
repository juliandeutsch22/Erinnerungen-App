// calendarQueries.ts — TanStack-Query-Hooks über den Gerätekalender (EventKit).
// Events werden pro sichtbarem Zeitfenster geladen; Mutationen invalidieren alles.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { eventPeopleKey } from '@/data/eventPersonQueries';
import { getEventPersonRepository } from '@/data/index';

import {
  type AssistantEventInput,
  createAssistantEvent,
  createDeviceEvent,
  deleteDeviceEvent,
  deviceCalendarAvailable,
  type DeviceEvent,
  type EventDraft,
  getEventCalendars,
  listDeviceEvents,
  updateDeviceEvent,
} from '@/lib/deviceCalendar';

export const calendarKeys = {
  calendars: ['deviceCalendars'] as const,
  events: (from: string, to: string) => ['deviceEvents', from, to] as const,
};

export function useDeviceCalendars(enabled: boolean) {
  return useQuery({
    queryKey: calendarKeys.calendars,
    queryFn: getEventCalendars,
    enabled: enabled && deviceCalendarAvailable,
    staleTime: 60_000,
  });
}

/** Termine im Fenster [fromDay..toDay] (lokale 'YYYY-MM-DD'-Grenzen, inklusiv). */
export function useDeviceEvents(fromDay: string, toDay: string, enabled: boolean) {
  return useQuery({
    queryKey: calendarKeys.events(fromDay, toDay),
    queryFn: () => {
      const [fy, fm, fd] = fromDay.split('-').map(Number);
      const [ty, tm, td] = toDay.split('-').map(Number);
      return listDeviceEvents(new Date(fy, fm - 1, fd, 0, 0, 0), new Date(ty, tm - 1, td, 23, 59, 59));
    },
    enabled: enabled && deviceCalendarAvailable,
    staleTime: 15_000,
  });
}

function useInvalidateEvents() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['deviceEvents'] });
    void qc.invalidateQueries({ queryKey: calendarKeys.calendars });
  };
}

/**
 * Legt einen Termin an — und hängt gleich die gewählten Personen daran.
 *
 * Warum das Verknüpfen HIER steckt und nicht beim Aufrufer: der Editor schließt
 * sich, sobald man „Sichern" tippt. Ein `onSuccess`, das man `mutate()`
 * mitgibt, läuft dann nicht mehr — TanStack Query ruft es nur, solange der
 * Beobachter noch Zuhörer hat (`mutationObserver`: `#mutateOptions &&
 * hasListeners()`), und die verliert er beim Ausbauen der Komponente. Die
 * Personen waren damit still verloren: ausgewählt, gespeichert, weg. In der
 * `mutationFn` läuft es unabhängig davon zu Ende.
 */
export function useCreateEvent() {
  const invalidate = useInvalidateEvents();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      calendarId,
      draft,
      personIds,
    }: {
      calendarId: string;
      draft: EventDraft;
      /** Wer ist dabei — nur beim ANLEGEN nötig, danach hat der Termin eine ID. */
      personIds?: string[];
    }) => {
      const eventId = await createDeviceEvent(calendarId, draft);
      // Ohne ID gibt es nichts zum Anhängen (Web, oder Kalender verweigert).
      if (eventId) for (const personId of personIds ?? []) await getEventPersonRepository().link(eventId, personId);
      return eventId;
    },
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: eventPeopleKey });
    },
  });
}

/** Legt mehrere Assistenten-Termine im Gerätekalender an; gibt zurück, wie viele
 *  wirklich angelegt wurden (0 im Web / ohne Kalender-Zugriff). */
export function useCreateAssistantEvents() {
  const invalidate = useInvalidateEvents();
  // Gibt je Termin die EventKit-ID zurück (null, wenn es nicht geklappt hat) —
  // in DERSELBEN Reihenfolge wie die Eingabe, damit der Aufrufer die Personen
  // dem richtigen Termin zuordnen kann.
  return async (termine: AssistantEventInput[]): Promise<(string | null)[]> => {
    const ids: (string | null)[] = [];
    for (const t of termine) ids.push(await createAssistantEvent(t));
    if (ids.some(Boolean)) invalidate();
    return ids;
  };
}

export function useUpdateEvent() {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: ({ event, draft }: { event: DeviceEvent; draft: EventDraft }) => updateDeviceEvent(event, draft),
    onSuccess: invalidate,
  });
}

export function useDeleteEvent() {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (event: DeviceEvent) => deleteDeviceEvent(event),
    onSuccess: invalidate,
  });
}
