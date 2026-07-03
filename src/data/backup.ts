// backup.ts — JSON-Export/-Import (Fahrplan §3.8): damit die Daten den
// 7-Tage-Signatur-Zyklus (§8.3) garantiert überleben. Muster aus Cairns
// dataExport/shareExport übernommen.
import { Platform, Share } from 'react-native';

import { getListRepository, getTaskRepository } from './index';
import { DEFAULT_LIST_ID } from './ListRepository';
import type { List, Rrule, Task } from './types';

export type BackupBundle = {
  app: 'stille';
  schemaVersion: 1;
  exportedAt: string;
  lists: List[];
  tasks: Task[];
};

export async function buildBackup(now: Date = new Date()): Promise<BackupBundle> {
  const [lists, tasks] = await Promise.all([getListRepository().getAll(), getTaskRepository().getAll()]);
  return { app: 'stille', schemaVersion: 1, exportedAt: now.toISOString(), lists, tasks };
}

export async function exportToJsonString(now?: Date): Promise<string> {
  return JSON.stringify(await buildBackup(now), null, 2);
}

/** Web: Datei-Download. Nativ: Share-Sheet (Datei speichern / AirDrop / …). */
export async function shareBackup(json: string, filename = 'stille-backup.json'): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ message: json });
}

const RRULES = new Set(['daily', 'weekdays', 'weekly', 'monthly', 'yearly']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function str(v: unknown): v is string {
  return typeof v === 'string';
}

/**
 * Validiert + importiert ein Backup. Ersetzt den kompletten Bestand
 * (Wiederherstellung, kein Merge). Wirft bei ungültigem Format.
 */
export async function importBackup(json: string): Promise<{ lists: number; tasks: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Kein gültiges JSON.');
  }
  if (!isRecord(parsed) || parsed.app !== 'stille' || parsed.schemaVersion !== 1) {
    throw new Error('Kein Erinnerungen-Backup (app/schemaVersion fehlt).');
  }
  const rawLists = Array.isArray(parsed.lists) ? parsed.lists : [];
  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

  const lists: List[] = [];
  for (const l of rawLists) {
    if (!isRecord(l) || !str(l.id) || !str(l.name)) throw new Error('Ungültige Liste im Backup.');
    lists.push({
      id: l.id,
      name: l.name,
      icon: str(l.icon) ? l.icon : 'inbox',
      color: str(l.color) ? l.color : '#1FB6A6',
      sort: typeof l.sort === 'number' ? l.sort : 0,
      createdAt: str(l.createdAt) ? l.createdAt : new Date().toISOString(),
    });
  }
  const listIds = new Set(lists.map((l) => l.id));

  const tasks: Task[] = [];
  for (const t of rawTasks) {
    if (!isRecord(t) || !str(t.id) || !str(t.title)) throw new Error('Ungültige Aufgabe im Backup.');
    tasks.push({
      id: t.id,
      listId: str(t.listId) && listIds.has(t.listId) ? t.listId : DEFAULT_LIST_ID,
      title: t.title,
      note: str(t.note) ? t.note : null,
      dueDate: str(t.dueDate) ? t.dueDate : null,
      dueTime: str(t.dueTime) ? t.dueTime : null,
      rrule: str(t.rrule) && RRULES.has(t.rrule) ? (t.rrule as Rrule) : null,
      flagged: t.flagged === true,
      completedAt: str(t.completedAt) ? t.completedAt : null,
      // Geplante Notifications gehören zum alten Gerät/Install — neu planen.
      notificationId: null,
      createdAt: str(t.createdAt) ? t.createdAt : new Date().toISOString(),
      sort: typeof t.sort === 'number' ? t.sort : 0,
    });
  }

  const listRepo = getListRepository();
  const taskRepo = getTaskRepository();
  await taskRepo.clearAll();
  await listRepo.clearAll();
  for (const l of lists) await listRepo.create(l);
  for (const t of tasks) await taskRepo.create(t);
  return { lists: lists.length, tasks: tasks.length };
}
