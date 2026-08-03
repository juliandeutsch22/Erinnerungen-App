// scheduling.ts — reine Auswahl-Logik der Erinnerungs-Engine (testbar ohne
// expo-notifications): welche Aufgaben kommen ins 64er-Planungsfenster?
import type { Task } from '@/data/types';
import { isExpired, isWaiting } from '@/lib/taskLogic';
import { parseDateStr } from '@/lib/dates';

/** Planungsfenster: bewusst unter dem 64er-Limit von iOS (Fahrplan §8.1). */
export const NOTIFICATION_WINDOW = 50;

/** Lokaler Zeitpunkt einer Aufgabe (dueDate + dueTime, lokale Zeitzone). */
export function taskFireDate(t: Pick<Task, 'dueDate' | 'dueTime'>): Date | null {
  if (!t.dueDate || !t.dueTime) return null;
  const d = parseDateStr(t.dueDate);
  const [h, m] = t.dueTime.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Die nächsten `limit` offenen Aufgaben mit Uhrzeit in der Zukunft,
 * chronologisch — alles andere wird verworfen und beim nächsten Öffnen
 * nachgeplant (Fahrplan §5).
 */
export function selectNotificationWindow(
  tasks: Task[],
  now: Date,
  limit: number = NOTIFICATION_WINDOW,
): { task: Task; fire: Date }[] {
  // Verfallenes klingelt nicht: der Anlass ist vorbei, nicht verpasst.
  // Wartendes klingelt auch nicht: es liegt bei jemand anderem, und eine
  // Mitteilung über etwas, das man gar nicht tun kann, ist reine Unruhe.
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return tasks
    .filter((t) => t.completedAt === null && !isExpired(t, today) && !isWaiting(t))
    .map((task) => ({ task, fire: taskFireDate(task) }))
    .filter((x): x is { task: Task; fire: Date } => x.fire !== null && x.fire.getTime() > now.getTime())
    .sort((a, b) => a.fire.getTime() - b.fire.getTime())
    .slice(0, limit);
}

/** Anzahl der am Zieltag ohne Uhrzeit fälligen offenen Aufgaben (überfällige zählen mit). */
export function countUntimedDue(tasks: Task[], targetDay: string): number {
  return tasks.filter(
    (t) =>
      t.completedAt === null &&
      !isWaiting(t) &&
      t.dueTime === null &&
      t.dueDate !== null &&
      t.dueDate <= targetDay,
  ).length;
}
