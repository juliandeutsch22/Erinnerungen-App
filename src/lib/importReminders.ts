// importReminders.ts — reine Mapping-Logik für den Apple-Erinnerungen-Import
// (testbar, kein EventKit-Zugriff). Eine Apple-Liste wird zu einer App-Liste,
// offene Erinnerungen werden zu Aufgaben. Exotische Wiederholungsregeln
// (Intervall > 1) fallen bewusst auf „keine Wiederholung" zurück — der
// Import meldet das als Hinweis.
import type { RawReminder } from '@/lib/deviceReminders';
import { LIST_COLORS } from '@/components/listMeta';
import type { NewTask, Rrule } from '@/data/types';
import { toDateStr } from '@/lib/dates';

/** EventKit-Frequenz → einfache App-Regel. Intervall > 1 wird nicht abgebildet. */
export function mapRecurrence(rec: { frequency: string; interval: number } | null): { rrule: Rrule | null; lossy: boolean } {
  if (!rec) return { rrule: null, lossy: false };
  if (rec.interval !== 1) return { rrule: null, lossy: true };
  const f = rec.frequency.toLowerCase();
  if (f === 'daily' || f === 'weekly' || f === 'monthly' || f === 'yearly') return { rrule: f, lossy: false };
  return { rrule: null, lossy: true };
}

/** Apple-Listenfarbe → nächstliegende Farbe unserer kuratierten Palette. */
export function nearestListColor(hex: string): string {
  const parse = (h: string) => {
    const m = /^#?([0-9a-f]{6})/i.exec(h.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255] as const;
  };
  const target = parse(hex);
  if (!target) return LIST_COLORS[0];
  let best: string = LIST_COLORS[0];
  let bestDist = Infinity;
  for (const c of LIST_COLORS) {
    const p = parse(c)!;
    const d = (p[0] - target[0]) ** 2 + (p[1] - target[1]) ** 2 + (p[2] - target[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export type MappedReminder = { reminderId: string; task: NewTask; lossyRecurrence: boolean };

/** Eine offene Apple-Erinnerung → NewTask für die Ziel-Liste. */
export function mapReminder(r: RawReminder, targetListId: string): MappedReminder {
  const { rrule, lossy } = mapRecurrence(r.recurrence);
  const dueDate = r.dueDate ? toDateStr(r.dueDate) : null;
  const dueTime =
    r.dueDate && !r.allDay
      ? `${String(r.dueDate.getHours()).padStart(2, '0')}:${String(r.dueDate.getMinutes()).padStart(2, '0')}`
      : null;
  return {
    reminderId: r.id,
    task: {
      listId: targetListId,
      title: r.title,
      note: r.notes,
      dueDate,
      dueTime,
      rrule,
    },
    lossyRecurrence: lossy,
  };
}
