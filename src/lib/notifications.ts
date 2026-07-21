// notifications.ts — lokale, geplante Erinnerungen (kein Backend, kein Push).
// Nur nativ; im Web No-Op.
//
// Erinnerungs-Engine (Fahrplan §5): iOS erlaubt max. 64 geplante lokale
// Notifications. Strategie: nach jeder Änderung + bei jedem App-Start werden
// die nächsten ~50 fälligen Aufgaben MIT Uhrzeit geplant; Aufgaben ohne
// Uhrzeit bekommen EINE Sammel-Notification („3 Dinge für heute", 9:00).
// Verwaltung pro Aufgabe über die gespeicherte notification_id — nie cancelAll.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { getTaskRepository } from '@/data/index';
import { kvStorage } from '@/data/kvStorage';
import { queryKeys } from '@/data/queries';
import type { Task } from '@/data/types';
import { todayStr } from '@/lib/dates';
import { countUntimedDue, selectNotificationWindow } from '@/lib/scheduling';
import { resolveCompletion } from '@/lib/taskLogic';
import { useSettings } from '@/theme/settings.store';

const native = Platform.OS === 'ios' || Platform.OS === 'android';

export const CATEGORY_TASK = 'task';
export const ACTION_DONE = 'done';
export const ACTION_SNOOZE = 'snooze';

const SUMMARY_ID_KEY = 'stille.notif.summary';
const JOURNAL_ID_KEY = 'stille.notif.journal';

// Benachrichtigungen im Vordergrund anzeigen (nur nativ konfigurieren).
if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Kategorien mit Aktionen direkt auf der Mitteilung: „Erledigt" und „+1 Std". */
export async function registerNotificationCategories(): Promise<void> {
  if (!native) return;
  await Notifications.setNotificationCategoryAsync(CATEGORY_TASK, [
    { identifier: ACTION_DONE, buttonTitle: 'Erledigt' },
    { identifier: ACTION_SNOOZE, buttonTitle: '+1 Std' },
  ]);
}

/** Fragt die Notification-Permission an. Gibt zurück, ob gewährt. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!native) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function summaryBody(count: number): string {
  return count === 1 ? '1 Ding für heute.' : `${count} Dinge für heute.`;
}

// Serialisierung + Debounce: Mutationen feuern in Serie; wir planen einmal,
// kurz nachdem Ruhe eingekehrt ist, und nie zwei Läufe gleichzeitig.
let pending: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> = Promise.resolve();

export function requestReschedule(): void {
  if (!native) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    running = running.then(() => rescheduleAll().catch(() => {}));
  }, 250);
}

/**
 * Plant das komplette Fenster neu: bestehende pro-Aufgabe-Notifications werden
 * über ihre gespeicherte ID ersetzt (nie cancelAll), dann die nächsten ~50
 * fälligen Aufgaben mit Uhrzeit geplant + die Sammel-Notification.
 */
export async function rescheduleAll(): Promise<void> {
  if (!native) return;
  const granted = await Notifications.getPermissionsAsync().then((p) => p.granted).catch(() => false);
  if (!granted) return;

  const repo = getTaskRepository();
  // Papierkorb-Aufgaben bekommen keine Erinnerungen.
  const tasks = (await repo.getAll()).filter((t) => !t.deletedAt);

  // Kandidaten: offen, mit Datum + Uhrzeit, in der Zukunft — chronologisch, Fenster.
  const windowed = selectNotificationWindow(tasks, new Date());
  const windowIds = new Set(windowed.map((x) => x.task.id));

  // 1. Alte pro-Aufgabe-Notifications außerhalb des Fensters aufräumen.
  for (const t of tasks) {
    if (t.notificationId && !windowIds.has(t.id)) {
      try {
        await Notifications.cancelScheduledNotificationAsync(t.notificationId);
      } catch {
        /* bereits weg */
      }
      await repo.update(t.id, { notificationId: null });
    }
  }

  // 2. Fenster planen (ersetzt bestehende über die gespeicherte ID).
  for (const { task: t, fire } of windowed) {
    if (t.notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(t.notificationId);
      } catch {
        /* bereits weg */
      }
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: t.title,
        body: t.note ?? undefined,
        categoryIdentifier: CATEGORY_TASK,
        data: { taskId: t.id, url: `/aufgabe/${t.id}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
    });
    await repo.update(t.id, { notificationId: id });
  }

  // 3. Sammel-Notification für heutige Aufgaben ohne Uhrzeit (Fahrplan §5).
  await rescheduleSummary(tasks);
}

async function rescheduleSummary(tasks: Task[]): Promise<void> {
  const oldId = await kvStorage.getItem(SUMMARY_ID_KEY);
  if (oldId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(oldId);
    } catch {
      /* bereits weg */
    }
    await kvStorage.removeItem(SUMMARY_ID_KEY);
  }

  const { summaryEnabled, summaryTime } = useSettings.getState();
  if (!summaryEnabled) return;

  const [h, m] = (summaryTime || '09:00').split(':').map(Number);
  const next = new Date();
  next.setHours(h, m, 0, 0);
  const isTomorrow = next.getTime() <= Date.now();
  if (isTomorrow) next.setDate(next.getDate() + 1);
  const targetDay = todayStr(next);

  // Zählen, was am Zieltag ohne Uhrzeit fällig ist (überfällige zählen mit).
  const count = countUntimedDue(tasks, targetDay);
  if (count === 0) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Erinnerungen',
      body: summaryBody(count),
      data: { url: '/heute' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: next },
  });
  await kvStorage.setItem(SUMMARY_ID_KEY, id);
}

/** Tägliche Erinnerung an die Abendbetrachtung — eine wiederkehrende
 *  DAILY-Notification. Wird bei Einstellungs-Änderung UND bei jedem App-Start
 *  neu geplant: geplante Notifications überleben eine Neuinstallation
 *  (7-Tage-Sideload!) nicht, die Einstellung schon. Beim Start fragt sie
 *  NICHT nach der Berechtigung (requestPermission=false), nur im Settings-Tap. */
export async function rescheduleJournalReminder(enabled: boolean, time: string, requestPermission = true): Promise<void> {
  if (!native) return;
  const oldId = await kvStorage.getItem(JOURNAL_ID_KEY);
  if (oldId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(oldId);
    } catch {
      /* bereits weg */
    }
    await kvStorage.removeItem(JOURNAL_ID_KEY);
  }
  if (!enabled) return;
  const granted = requestPermission
    ? await ensureNotificationPermission()
    : await Notifications.getPermissionsAsync().then((p) => p.granted).catch(() => false);
  if (!granted) return;
  const [h, m] = (time || '21:00').split(':').map(Number);
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Abendbetrachtung',
      body: 'Was lief heute gut? Was hast du gelernt?',
      data: { url: '/heute' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h, minute: m },
  });
  await kvStorage.setItem(JOURNAL_ID_KEY, id);
}

/** Snooze: Notification-only, +1 Std ab jetzt (Fälligkeit in der DB bleibt). */
async function snoozeTask(taskId: string): Promise<void> {
  const repo = getTaskRepository();
  const task = (await repo.getAll()).find((t) => t.id === taskId);
  if (!task || task.completedAt !== null || task.deletedAt) return;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: task.title,
      body: task.note ?? undefined,
      categoryIdentifier: CATEGORY_TASK,
      data: { taskId: task.id, url: `/aufgabe/${task.id}` },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 60 * 60 * 1000) },
  });
  await repo.update(task.id, { notificationId: id });
}

/**
 * Verarbeitet Antworten auf Mitteilungen: „Erledigt", „+1 Std" und den Tap
 * (Deep-Link auf die Aufgabe). Im Root-Layout einhängen.
 * ⚠️ Auf einem echten Gerät verifizieren — Expo Go verhält sich anders (§8.4).
 */
export function useNotificationResponses(): void {
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (!native) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { taskId?: string; url?: string } | undefined;
      const action = response.actionIdentifier;

      void (async () => {
        if (action === ACTION_DONE && data?.taskId) {
          const repo = getTaskRepository();
          const task = (await repo.getAll()).find((t) => t.id === data.taskId);
          if (task && task.completedAt === null) {
            await repo.update(task.id, resolveCompletion(task, todayStr()));
            await qc.invalidateQueries({ queryKey: queryKeys.tasks });
            requestReschedule();
          }
          return;
        }
        if (action === ACTION_SNOOZE && data?.taskId) {
          await snoozeTask(data.taskId);
          return;
        }
        // Default-Aktion: Tap öffnet die Aufgabe.
        if (typeof data?.url === 'string') router.push(data.url as never);
      })();
    });
    return () => sub.remove();
  }, [router, qc]);
}
