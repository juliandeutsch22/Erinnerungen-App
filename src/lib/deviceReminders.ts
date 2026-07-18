// deviceReminders.ts — Anbindung an Apple Erinnerungen über EventKit
// (expo-calendar, EntityTypes.REMINDER). Nur iOS; nur LESEND für den
// einmaligen Import — die Apple-Daten bleiben unangetastet.
import { Platform } from 'react-native';

export const deviceRemindersAvailable = Platform.OS === 'ios';

export type ReminderList = {
  id: string;
  title: string;
  color: string;
};

/** Rohdaten einer offenen Apple-Erinnerung (bereits JS-serialisiert). */
export type RawReminder = {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  /** Fälligkeit als Date (EventKit liefert Date/ISO-String gemischt). */
  dueDate: Date | null;
  /** true = ganztägig (keine Uhrzeit übernehmen). */
  allDay: boolean;
  recurrence: { frequency: string; interval: number } | null;
};

// Lazy require, damit der Web-Bundle expo-calendar nicht zieht (Muster deviceCalendar.ts).
function mod(): typeof import('expo-calendar') {
  return require('expo-calendar') as typeof import('expo-calendar');
}

export async function ensureRemindersPermission(): Promise<boolean> {
  if (!deviceRemindersAvailable) return false;
  const Calendar = mod();
  const current = await Calendar.getRemindersPermissions();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Calendar.requestRemindersPermissions();
  return req.granted;
}

/** Alle Erinnerungs-Listen samt ihrer OFFENEN Erinnerungen. */
export async function getOpenRemindersByList(): Promise<{ list: ReminderList; reminders: RawReminder[] }[]> {
  if (!deviceRemindersAvailable) return [];
  const Calendar = mod();
  const cals = await Calendar.getCalendars(Calendar.EntityTypes.REMINDER);
  const out: { list: ReminderList; reminders: RawReminder[] }[] = [];
  for (const cal of cals) {
    let raw: Awaited<ReturnType<typeof cal.listReminders>> = [];
    try {
      raw = await cal.listReminders(null, null, Calendar.ReminderStatus.INCOMPLETE);
    } catch {
      // Einzelne Listen (z. B. delegierte) können Fehler werfen — überspringen.
    }
    const reminders: RawReminder[] = [];
    for (const r of raw) {
      if (!r.id || r.completed) continue;
      reminders.push({
        id: r.id,
        listId: cal.id,
        title: (r.title ?? '').trim() || 'Ohne Titel',
        notes: r.notes?.trim() ? r.notes.trim() : null,
        dueDate: r.dueDate ? new Date(r.dueDate) : null,
        allDay: r.allDay === true,
        recurrence: r.recurrenceRule
          ? { frequency: String(r.recurrenceRule.frequency), interval: r.recurrenceRule.interval ?? 1 }
          : null,
      });
    }
    out.push({ list: { id: cal.id, title: cal.title, color: cal.color ?? '#2B5FA6' }, reminders });
  }
  return out;
}
