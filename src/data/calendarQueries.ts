// calendarQueries.ts — TanStack-Query-Hooks über den Gerätekalender (EventKit).
// Events werden pro sichtbarem Zeitfenster geladen; Mutationen invalidieren alles.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
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

export function useCreateEvent() {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: ({ calendarId, draft }: { calendarId: string; draft: EventDraft }) =>
      createDeviceEvent(calendarId, draft),
    onSuccess: invalidate,
  });
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
