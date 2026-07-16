// deviceCalendar.ts — Anbindung an den Gerätekalender über EventKit
// (expo-calendar, neue Shared-Object-API in SDK 56). Alle in iOS
// eingerichteten Accounts (iCloud, Google, Outlook, …) erscheinen hier
// automatisch — kein eigener Sync, kein Backend. Web: nicht verfügbar.
import { Platform } from 'react-native';

export const deviceCalendarAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

export type DeviceCalendar = {
  id: string;
  title: string;
  color: string;
  allowsModifications: boolean;
  /** Account-Name (z. B. „iCloud", „Gmail") — zur Gruppierung/Anzeige. */
  sourceName: string;
};

export type DeviceEvent = {
  /** Instanz-eindeutig (Serientermine liefern mehrere Instanzen derselben id). */
  key: string;
  id: string;
  calendarId: string;
  title: string;
  notes: string | null;
  allDay: boolean;
  start: Date;
  end: Date;
  recurring: boolean;
  /** Natives Shared Object — für update()/delete(). Nie serialisieren. */
  native: import('expo-calendar').ExpoCalendarEvent;
};

// Lazy require, damit der Web-Bundle expo-calendar nicht zieht (Muster data/index.ts).
function mod(): typeof import('expo-calendar') {
  return require('expo-calendar') as typeof import('expo-calendar');
}

/** Nur prüfen, nie fragen — fürs Dashboard (der Prompt gehört in den Kalender-Tab). */
export async function hasCalendarPermission(): Promise<boolean> {
  if (!deviceCalendarAvailable) return false;
  const Calendar = mod();
  const current = await Calendar.getCalendarPermissions();
  return current.granted;
}

export async function ensureCalendarPermission(): Promise<boolean> {
  if (!deviceCalendarAvailable) return false;
  const Calendar = mod();
  const current = await Calendar.getCalendarPermissions();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Calendar.requestCalendarPermissions();
  return req.granted;
}

export async function getEventCalendars(): Promise<DeviceCalendar[]> {
  if (!deviceCalendarAvailable) return [];
  const Calendar = mod();
  const cals = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return cals.map((c) => ({
    id: c.id,
    title: c.title,
    color: c.color ?? '#7E8C5C',
    allowsModifications: c.allowsModifications,
    sourceName: c.source?.name ?? '',
  }));
}

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

/** Alle Termine aller Kalender im Zeitraum (Serien werden als Instanzen geliefert). */
export async function listDeviceEvents(from: Date, to: Date): Promise<DeviceEvent[]> {
  if (!deviceCalendarAvailable) return [];
  const Calendar = mod();
  const cals = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  if (cals.length === 0) return [];
  const events = await Calendar.listEvents(cals, from, to);
  return events.map((e) => {
    const start = toDate(e.startDate);
    return {
      key: `${e.id}:${start.getTime()}`,
      id: e.id,
      calendarId: e.calendarId,
      title: e.title || 'Ohne Titel',
      notes: e.notes ? e.notes : null,
      allDay: e.allDay,
      start,
      end: toDate(e.endDate),
      recurring: e.recurrenceRule !== null,
      native: e,
    };
  });
}

/** Standard-Kalender fürs Anlegen (iOS); sonst erster beschreibbarer. */
export async function defaultCalendarId(): Promise<string | null> {
  if (!deviceCalendarAvailable) return null;
  const Calendar = mod();
  if (Platform.OS === 'ios') {
    try {
      return Calendar.getDefaultCalendarSync().id;
    } catch {
      /* kein Default → Fallback unten */
    }
  }
  const cals = await getEventCalendars();
  return cals.find((c) => c.allowsModifications)?.id ?? null;
}

export type EventDraft = {
  title: string;
  notes: string | null;
  allDay: boolean;
  start: Date;
  end: Date;
};

export async function createDeviceEvent(calendarId: string, draft: EventDraft): Promise<void> {
  const Calendar = mod();
  const cal = await Calendar.ExpoCalendar.get(calendarId);
  await cal.createEvent({
    title: draft.title,
    notes: draft.notes ?? undefined,
    allDay: draft.allDay,
    startDate: draft.start,
    endDate: draft.end,
  });
}

export async function updateDeviceEvent(ev: DeviceEvent, draft: EventDraft): Promise<void> {
  await ev.native.update({
    title: draft.title,
    notes: draft.notes ?? '',
    allDay: draft.allDay,
    startDate: draft.start,
    endDate: draft.end,
  });
}

export async function deleteDeviceEvent(ev: DeviceEvent): Promise<void> {
  await ev.native.delete();
}
