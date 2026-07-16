// backup.ts — JSON-Export/-Import (Fahrplan §3.8): damit die Daten den
// 7-Tage-Signatur-Zyklus (§8.3) UND eine komplette Neuinstallation überleben.
//
// Enthalten sind Listen, Aufgaben (inkl. Tags/Unteraufgaben), gespeicherte
// Smart-Filter und die Termin-Fotos (als eingebettetes Base64, damit der
// Rückblick portabel ist). Kalendertermine selbst gehören dem Gerätekalender
// (EventKit) und synchronisieren über iCloud/Google — sie liegen nicht im Backup.
//
// Reine Logik: Datei-/Store-Zugriff wird als Quellen/Senken hereingereicht
// (siehe backupFile.ts, settings.store.ts), damit dieses Modul testbar bleibt.
import { Platform, Share } from 'react-native';

import type { FilterRange, SavedFilter } from '@/lib/taskFilters';
import { remapListColor } from './colorRebrand';
import { getListRepository, getPhotoRepository, getTaskRepository } from './index';
import { DEFAULT_LIST_ID } from './ListRepository';
import type { EventPhoto } from './PhotoRepository';
import type { List, Rrule, Task } from './types';
import { newId } from './types';

/** Ein Foto im Backup: Verknüpfung + eingebettete Bilddaten (Base64). */
export type BackupPhoto = {
  id: string;
  eventId: string;
  addedAt: string;
  ext: string;
  /** Base64 der Bilddatei; null, wenn beim Export nicht lesbar. */
  data: string | null;
};

export type BackupBundle = {
  app: 'stille';
  schemaVersion: 2;
  exportedAt: string;
  lists: List[];
  tasks: Task[];
  savedFilters: SavedFilter[];
  photos: BackupPhoto[];
};

/** Quellen, die nur zur Laufzeit verfügbar sind (Store, Datei-IO). */
export type BackupSources = {
  savedFilters: SavedFilter[];
  /** Liest eine Foto-Datei als Base64 (nativ). Fehlt/liefert null → Foto als reine Verknüpfung. */
  readPhotoBase64?: (uri: string) => Promise<string | null>;
  extFromUri?: (uri: string) => string;
};

export async function buildBackup(sources: BackupSources, now: Date = new Date()): Promise<BackupBundle> {
  const [lists, tasks, photoLinks] = await Promise.all([
    getListRepository().getAll(),
    getTaskRepository().getAll(),
    getPhotoRepository().getAll(),
  ]);

  const extOf = sources.extFromUri ?? ((uri: string) => (uri.split('.').pop() || 'jpg').toLowerCase());
  const photos: BackupPhoto[] = [];
  for (const p of photoLinks) {
    const data = sources.readPhotoBase64 ? await sources.readPhotoBase64(p.uri) : null;
    photos.push({ id: p.id, eventId: p.eventId, addedAt: p.addedAt, ext: extOf(p.uri), data });
  }

  return {
    app: 'stille',
    schemaVersion: 2,
    exportedAt: now.toISOString(),
    lists,
    tasks,
    savedFilters: sources.savedFilters,
    photos,
  };
}

export async function exportToJsonString(sources: BackupSources, now?: Date): Promise<string> {
  return JSON.stringify(await buildBackup(sources, now), null, 2);
}

/** Web-Fallback: Datei-Download über einen Blob (nativ nutzt saveAndShareBackup). */
export async function shareBackup(json: string, filename = 'erinnerungen-backup.json'): Promise<void> {
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
const RANGES = new Set<FilterRange>(['all', 'today', 'week', 'overdue', 'undated']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function str(v: unknown): v is string {
  return typeof v === 'string';
}

function parseSavedFilters(raw: unknown): SavedFilter[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedFilter[] = [];
  for (const f of raw) {
    if (!isRecord(f) || !str(f.id) || !str(f.name)) continue;
    out.push({
      id: f.id,
      name: f.name,
      tags: Array.isArray(f.tags) ? f.tags.filter(str) : [],
      flagged: f.flagged === true,
      range: str(f.range) && RANGES.has(f.range as FilterRange) ? (f.range as FilterRange) : 'all',
      includeCompleted: f.includeCompleted === true,
    });
  }
  return out;
}

/** Senken für nur zur Laufzeit verfügbare Ziele (Store, Datei-IO). */
export type ImportSinks = {
  setSavedFilters?: (filters: SavedFilter[]) => void;
  /** Schreibt Base64-Bilddaten als Datei und gibt die neue URI zurück (nativ). */
  writePhotoFromBase64?: (ext: string, base64: string) => Promise<string | null>;
};

export type ImportResult = { lists: number; tasks: number; filters: number; photos: number };

/**
 * Validiert + importiert ein Backup. Ersetzt den kompletten Bestand
 * (Wiederherstellung, kein Merge). Akzeptiert schemaVersion 1 (Listen/Aufgaben)
 * und 2 (zusätzlich Filter + Fotos). Wirft bei ungültigem Format.
 */
export async function importBackup(json: string, sinks: ImportSinks = {}): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Kein gültiges JSON.');
  }
  if (!isRecord(parsed) || parsed.app !== 'stille' || (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2)) {
    throw new Error('Kein Erinnerungen-Backup (app/schemaVersion fehlt).');
  }
  const rawLists = Array.isArray(parsed.lists) ? parsed.lists : [];
  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const rawPhotos = Array.isArray(parsed.photos) ? parsed.photos : [];

  const lists: List[] = [];
  for (const l of rawLists) {
    if (!isRecord(l) || !str(l.id) || !str(l.name)) throw new Error('Ungültige Liste im Backup.');
    lists.push({
      id: l.id,
      name: l.name,
      icon: str(l.icon) ? l.icon : 'inbox',
      // Alte Marken-Farben aus Backups vor v1.2 ziehen mit auf die Erdtöne um.
      color: str(l.color) ? remapListColor(l.color) : '#2B5FA6',
      goal: str(l.goal) ? l.goal : null,
      deadline: str(l.deadline) ? l.deadline : null,
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
      eventId: str(t.eventId) ? t.eventId : null,
      completedAt: str(t.completedAt) ? t.completedAt : null,
      // Geplante Notifications gehören zum alten Gerät/Install — neu planen.
      notificationId: null,
      tags: Array.isArray(t.tags) ? t.tags.filter(str) : [],
      subtasks: Array.isArray(t.subtasks)
        ? t.subtasks
            .filter((s): s is Record<string, unknown> => isRecord(s) && str(s.id) && str(s.title))
            .map((s) => ({ id: s.id as string, title: s.title as string, done: s.done === true }))
        : [],
      createdAt: str(t.createdAt) ? t.createdAt : new Date().toISOString(),
      sort: typeof t.sort === 'number' ? t.sort : 0,
    });
  }

  const filters = parseSavedFilters(parsed.savedFilters);

  // Fotos: Base64 zurück in echte Container-Dateien schreiben, dann neu verknüpfen.
  // Ohne Datei-Senke (Web/Test) werden Fotos übersprungen.
  const photos: EventPhoto[] = [];
  for (const p of rawPhotos) {
    if (!isRecord(p) || !str(p.eventId) || !str(p.data) || !p.data) continue;
    if (!sinks.writePhotoFromBase64) continue;
    const uri = await sinks.writePhotoFromBase64(str(p.ext) ? p.ext : 'jpg', p.data);
    if (!uri) continue;
    photos.push({
      id: str(p.id) ? p.id : newId(),
      eventId: p.eventId,
      uri,
      addedAt: str(p.addedAt) ? p.addedAt : new Date().toISOString(),
    });
  }

  const listRepo = getListRepository();
  const taskRepo = getTaskRepository();
  const photoRepo = getPhotoRepository();
  await taskRepo.clearAll();
  await listRepo.clearAll();
  await photoRepo.clearAll();
  for (const l of lists) await listRepo.create(l);
  for (const t of tasks) await taskRepo.create(t);
  await photoRepo.restore(photos);
  sinks.setSavedFilters?.(filters);

  return { lists: lists.length, tasks: tasks.length, filters: filters.length, photos: photos.length };
}
