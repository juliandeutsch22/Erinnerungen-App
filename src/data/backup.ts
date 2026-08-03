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

import { isRrule } from '@/lib/dates';
import type { FilterRange, SavedFilter } from '@/lib/taskFilters';
import { remapListColor } from './colorRebrand';
import type { EventDocument } from './DocumentRepository';
import { getChatRepository, getDocumentRepository, getJournalRepository, getListRepository, getNoteRepository, getPersonRepository, getPhotoRepository, getTaskRepository } from './index';
import type { JournalEntry } from './JournalRepository';
import { DEFAULT_LIST_ID } from './ListRepository';
import type { EventPhoto } from './PhotoRepository';
import type { Chat, ChatMessage, List, Note, Person, Task } from './types';
import { newId, normalizePersonName } from './types';

/** Ein Foto im Backup: Verknüpfung + eingebettete Bilddaten (Base64). */
export type BackupPhoto = {
  id: string;
  eventId: string;
  addedAt: string;
  ext: string;
  /** Base64 der Bilddatei; null, wenn beim Export nicht lesbar. */
  data: string | null;
};

/** Ein Termin-Dokument im Backup: Verknüpfung + eingebettete Datei (Base64).
 *  data = null, wenn die Datei zu groß (> 10 MB) oder nicht lesbar war. */
export type BackupDocument = {
  id: string;
  eventId: string;
  name: string;
  addedAt: string;
  ext: string;
  data: string | null;
};

/** Der Satz des Tages je Datum ('YYYY-MM-DD') — der Morgen des Bogens. */
export type BackupDayIntentions = Record<string, { text: string; done: boolean }>;

export type BackupBundle = {
  app: 'stille';
  schemaVersion: 3;
  exportedAt: string;
  lists: List[];
  tasks: Task[];
  notes: Note[];
  /** Menschen (v1.73.0) — ältere Backups haben das Feld nicht. */
  people: Person[];
  savedFilters: SavedFilter[];
  photos: BackupPhoto[];
  chats: Chat[];
  chatMessages: ChatMessage[];
  documents: BackupDocument[];
  journal: JournalEntry[];
  dayIntentions: BackupDayIntentions;
  assistantMemory: string;
};

/**
 * Die Teile des Einstellungs-Stores, die ins Backup gehören — bewusst EIN
 * Objekt statt Einzelparameter: Was hier dazukommt, nimmt danach jeder Aufrufer
 * automatisch mit. `dayIntentions` hatte genau diese Lücke (v1.29.0 angelegt,
 * bis v1.33.0 nie gesichert), weil es als zweiter Parameter hätte nachgezogen
 * werden müssen und an vier Stellen vergessen wurde.
 */
export type BackupStoreSlice = {
  savedFilters: SavedFilter[];
  dayIntentions: BackupDayIntentions;
  /** Merkzettel für den Assistenten — vom Nutzer geschrieben, also seine Daten. */
  assistantMemory: string;
};

/** Quellen, die nur zur Laufzeit verfügbar sind (Store, Datei-IO). */
export type BackupSources = BackupStoreSlice & {
  /** Liest eine Foto-Datei als Base64 (nativ). Fehlt/liefert null → Foto als reine Verknüpfung. */
  readPhotoBase64?: (uri: string) => Promise<string | null>;
  extFromUri?: (uri: string) => string;
  /** Liest ein Dokument als Base64 (nativ); null bei Übergröße/Fehler. */
  readDocumentBase64?: (uri: string) => Promise<string | null>;
};

export async function buildBackup(sources: BackupSources, now: Date = new Date()): Promise<BackupBundle> {
  const [lists, tasks, notes, people, photoLinks, chats, chatMessages, docLinks, journal] = await Promise.all([
    getListRepository().getAll(),
    getTaskRepository().getAll(),
    getNoteRepository().getAll(),
    getPersonRepository().getAll(),
    getPhotoRepository().getAll(),
    getChatRepository().getAll(),
    getChatRepository().getAllMessages(),
    getDocumentRepository().getAll(),
    getJournalRepository().getAll(),
  ]);

  const extOf = sources.extFromUri ?? ((uri: string) => (uri.split('.').pop() || 'jpg').toLowerCase());
  const photos: BackupPhoto[] = [];
  for (const p of photoLinks) {
    const data = sources.readPhotoBase64 ? await sources.readPhotoBase64(p.uri) : null;
    photos.push({ id: p.id, eventId: p.eventId, addedAt: p.addedAt, ext: extOf(p.uri), data });
  }

  const documents: BackupDocument[] = [];
  for (const d of docLinks) {
    const data = sources.readDocumentBase64 ? await sources.readDocumentBase64(d.uri) : null;
    documents.push({ id: d.id, eventId: d.eventId, name: d.name, addedAt: d.addedAt, ext: extOf(d.uri), data });
  }

  return {
    app: 'stille',
    schemaVersion: 3,
    exportedAt: now.toISOString(),
    lists,
    tasks,
    notes,
    people,
    savedFilters: sources.savedFilters,
    photos,
    chats,
    chatMessages,
    documents,
    journal,
    dayIntentions: sources.dayIntentions,
    assistantMemory: sources.assistantMemory,
  };
}

export async function exportToJsonString(sources: BackupSources, now?: Date): Promise<string> {
  return JSON.stringify(await buildBackup(sources, now), null, 2);
}

// ——— Ehrlicher Backup-Bericht: was ist drin, was fehlt. ———
export type BackupSummary = {
  lists: number;
  tasks: number;
  notes: number;
  chats: number;
  journal: number;
  photos: number;
  documents: number;
  /** Dokumente OHNE eingebettete Datei (zu groß > 10 MB oder nicht lesbar) — nur die Verknüpfung ist gesichert. */
  skippedDocuments: string[];
};

/** Zählt den Inhalt eines Bundles — aktive Einträge, Papierkorb zählt nicht mit. */
export function summarizeBundle(bundle: BackupBundle): BackupSummary {
  return {
    lists: bundle.lists.filter((l) => !l.deletedAt && l.id !== DEFAULT_LIST_ID).length,
    tasks: bundle.tasks.filter((t) => !t.deletedAt).length,
    notes: bundle.notes.filter((n) => n.deletedAt === null).length,
    chats: bundle.chats.filter((c) => c.deletedAt === null).length,
    journal: bundle.journal.length,
    photos: bundle.photos.length,
    documents: bundle.documents.length,
    skippedDocuments: bundle.documents.filter((d) => d.data === null).map((d) => d.name),
  };
}

/** Bericht als ruhiger deutscher Satz — inklusive der ehrlichen Lücke. */
export function describeSummary(s: BackupSummary): string {
  const parts = [
    `${s.tasks} Aufgaben`,
    `${s.lists} Listen`,
    `${s.notes} Notizen`,
    `${s.chats} Chats`,
    `${s.journal} Betrachtungen`,
    `${s.photos} Fotos`,
    `${s.documents} Dokumente`,
  ];
  let text = `Gesichert: ${parts.join(', ')}.`;
  if (s.skippedDocuments.length > 0) {
    const names = s.skippedDocuments.slice(0, 3).join(', ');
    const more = s.skippedDocuments.length > 3 ? ` und ${s.skippedDocuments.length - 3} weitere` : '';
    text += ` Ohne Dateiinhalt (größer als 10 MB oder nicht lesbar): ${names}${more}.`;
  }
  return text;
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

// Wiederholungen werden über isRrule geprüft — deckt Presets UND die
// erweiterten Formen ('every:2w', 'after:3d') ab.
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

/** Liest die Tages-Sätze tolerant zurück — ältere Backups haben sie nicht. */
function parseDayIntentions(raw: unknown): BackupDayIntentions {
  if (!isRecord(raw)) return {};
  const out: BackupDayIntentions = {};
  for (const [date, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isRecord(v) || !str(v.text)) continue;
    const text = v.text.trim();
    if (text.length === 0) continue;
    out[date] = { text, done: v.done === true };
  }
  // Wie im Store: nur die letzten 30 Tage — ein Tagesgedanke, kein Archiv.
  const keys = Object.keys(out).sort().slice(-30);
  return Object.fromEntries(keys.map((k) => [k, out[k]]));
}

/** Senken für nur zur Laufzeit verfügbare Ziele (Store, Datei-IO). */
export type ImportSinks = {
  setSavedFilters?: (filters: SavedFilter[]) => void;
  setDayIntentions?: (intentions: BackupDayIntentions) => void;
  setAssistantMemory?: (memory: string) => void;
  /** Schreibt Base64-Bilddaten als Datei und gibt die neue URI zurück (nativ). */
  writePhotoFromBase64?: (ext: string, base64: string) => Promise<string | null>;
  /** Schreibt Base64-Dokumentdaten als Datei und gibt die neue URI zurück (nativ). */
  writeDocumentFromBase64?: (ext: string, base64: string) => Promise<string | null>;
};

export type ImportResult = { lists: number; tasks: number; notes: number; filters: number; photos: number; chats: number; documents: number; journal: number };

/**
 * Validiert + importiert ein Backup. Ersetzt den kompletten Bestand
 * (Wiederherstellung, kein Merge). Akzeptiert schemaVersion 1 (Listen/Aufgaben),
 * 2 (zusätzlich Filter + Fotos) und 3 (zusätzlich Notizen). Wirft bei
 * ungültigem Format.
 */
export async function importBackup(json: string, sinks: ImportSinks = {}): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Kein gültiges JSON.');
  }
  if (!isRecord(parsed) || parsed.app !== 'stille' || ![1, 2, 3].includes(parsed.schemaVersion as number)) {
    throw new Error('Kein Erinnerungen-Backup (app/schemaVersion fehlt).');
  }
  const rawLists = Array.isArray(parsed.lists) ? parsed.lists : [];
  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const rawPhotos = Array.isArray(parsed.photos) ? parsed.photos : [];
  const rawNotes = Array.isArray(parsed.notes) ? parsed.notes : [];
  const rawChats = Array.isArray(parsed.chats) ? parsed.chats : [];
  const rawChatMessages = Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [];
  const rawDocuments = Array.isArray(parsed.documents) ? parsed.documents : [];
  const rawJournal = Array.isArray(parsed.journal) ? parsed.journal : [];
  const rawPeople = Array.isArray(parsed.people) ? parsed.people : [];

  // Menschen zuerst: Aufgaben, Notizen und Chats prüfen ihre Zuordnung gegen
  // diese Liste. Namen sind eindeutig — zwei „Anna" wären für den Nutzer nicht
  // unterscheidbar und verteilten seine offenen Punkte auf zwei Ansichten.
  const people: Person[] = [];
  const gesehen = new Set<string>();
  for (const p of rawPeople) {
    if (!isRecord(p) || !str(p.id) || !str(p.name)) continue;
    const schluessel = normalizePersonName(p.name);
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    people.push({
      id: p.id,
      name: p.name,
      note: str(p.note) ? p.note : null,
      sort: typeof p.sort === 'number' ? p.sort : 0,
      createdAt: str(p.createdAt) ? p.createdAt : new Date().toISOString(),
    });
  }
  const personIds = new Set(people.map((p) => p.id));

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
      completedAt: str(l.completedAt) ? l.completedAt : null,
      // Papierkorb-Zustand kommt mit zurück (ältere Backups: aktiv).
      deletedAt: str(l.deletedAt) ? l.deletedAt : null,
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
      rrule: isRrule(t.rrule) ? t.rrule : null,
      rruleUntil: str(t.rruleUntil) ? t.rruleUntil : null,
      startDate: str(t.startDate) ? t.startDate : null,
      expiresOn: str(t.expiresOn) ? t.expiresOn : null,
      evening: t.evening === true,
      waiting: t.waiting === true,
      waitingFor: str(t.waitingFor) ? t.waitingFor : null,
      // Wie bei listId: eine Zuordnung auf einen Menschen, den es im Backup
      // nicht gibt, ist keine Zuordnung.
      personId: str(t.personId) && personIds.has(t.personId) ? t.personId : null,
      flagged: t.flagged === true,
      eventId: str(t.eventId) ? t.eventId : null,
      completedAt: str(t.completedAt) ? t.completedAt : null,
      deletedAt: str(t.deletedAt) ? t.deletedAt : null,
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

  // Notizen: taskId nur behalten, wenn die Aufgabe im Backup existiert;
  // eventId zeigt auf den Gerätekalender und bleibt wie bei Fotos erhalten.
  const taskIds = new Set(tasks.map((t) => t.id));
  const notes: Note[] = [];
  for (const n of rawNotes) {
    if (!isRecord(n) || !str(n.id) || !str(n.body)) continue;
    notes.push({
      id: n.id,
      body: n.body,
      taskId: str(n.taskId) && taskIds.has(n.taskId) ? n.taskId : null,
      eventId: str(n.eventId) ? n.eventId : null,
      // Wie bei taskId: eine Zuordnung auf eine Liste, die es im Backup nicht
      // gibt, ist keine Zuordnung — sonst hinge die Notiz an einem Projekt,
      // das nie aufgeht.
      listId: str(n.listId) && listIds.has(n.listId) ? n.listId : null,
      personId: str(n.personId) && personIds.has(n.personId) ? n.personId : null,
      // Ältere Backups (ohne Anheften/Papierkorb) → Standardwerte.
      pinned: n.pinned === true,
      deletedAt: str(n.deletedAt) ? n.deletedAt : null,
      createdAt: str(n.createdAt) ? n.createdAt : new Date().toISOString(),
      updatedAt: str(n.updatedAt) ? n.updatedAt : new Date().toISOString(),
    });
  }

  // Chats: Titel/Verlauf tolerant übernehmen (ältere Backups haben keine).
  const chats: Chat[] = [];
  for (const c of rawChats) {
    if (!isRecord(c) || !str(c.id) || !str(c.title)) continue;
    chats.push({
      id: c.id,
      title: c.title,
      eventId: str(c.eventId) ? c.eventId : null,
      taskId: str(c.taskId) ? c.taskId : null,
      noteId: str(c.noteId) ? c.noteId : null,
      listId: str(c.listId) && listIds.has(c.listId) ? c.listId : null,
      personId: str(c.personId) && personIds.has(c.personId) ? c.personId : null,
      context: str(c.context) ? c.context : null,
      deletedAt: str(c.deletedAt) ? c.deletedAt : null,
      createdAt: str(c.createdAt) ? c.createdAt : new Date().toISOString(),
      updatedAt: str(c.updatedAt) ? c.updatedAt : new Date().toISOString(),
    });
  }
  const chatIds = new Set(chats.map((c) => c.id));
  const chatMessages: ChatMessage[] = [];
  for (const m of rawChatMessages) {
    if (!isRecord(m) || !str(m.id) || !str(m.chatId) || !chatIds.has(m.chatId) || !str(m.content)) continue;
    chatMessages.push({
      id: m.id,
      chatId: m.chatId,
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
      createdAt: str(m.createdAt) ? m.createdAt : new Date().toISOString(),
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

  // Dokumente: wie Fotos — Base64 zurück in Container-Dateien, ohne Senke überspringen.
  const documents: EventDocument[] = [];
  for (const d of rawDocuments) {
    if (!isRecord(d) || !str(d.eventId) || !str(d.name) || !str(d.data) || !d.data) continue;
    if (!sinks.writeDocumentFromBase64) continue;
    const uri = await sinks.writeDocumentFromBase64(str(d.ext) ? d.ext : 'pdf', d.data);
    if (!uri) continue;
    documents.push({
      id: str(d.id) ? d.id : newId(),
      eventId: d.eventId,
      name: d.name,
      uri,
      addedAt: str(d.addedAt) ? d.addedAt : new Date().toISOString(),
    });
  }

  // Abendbetrachtungen: tolerant übernehmen (ältere Backups haben keine).
  const journal: JournalEntry[] = [];
  const journalDates = new Set<string>();
  for (const j of rawJournal) {
    if (!isRecord(j) || !str(j.date) || !/^\d{4}-\d{2}-\d{2}$/.test(j.date) || !str(j.text)) continue;
    if (journalDates.has(j.date)) continue;
    journalDates.add(j.date);
    journal.push({
      id: str(j.id) ? j.id : newId(),
      date: j.date,
      text: j.text,
      // Ältere Backups kennen den Papierkorb nicht — dort lebt alles.
      deletedAt: str(j.deletedAt) ? j.deletedAt : null,
      createdAt: str(j.createdAt) ? j.createdAt : new Date().toISOString(),
      updatedAt: str(j.updatedAt) ? j.updatedAt : new Date().toISOString(),
    });
  }

  const listRepo = getListRepository();
  const taskRepo = getTaskRepository();
  const photoRepo = getPhotoRepository();
  const noteRepo = getNoteRepository();
  const chatRepo = getChatRepository();
  const docRepo = getDocumentRepository();
  const journalRepo = getJournalRepository();
  const personRepo = getPersonRepository();
  await taskRepo.clearAll();
  await listRepo.clearAll();
  await photoRepo.clearAll();
  await noteRepo.clearAll();
  await chatRepo.clearAll();
  await docRepo.clearAll();
  await journalRepo.clearAll();
  await personRepo.clearAll();
  // Menschen vor allem anderen: danach zeigen die Zuordnungen ins Leere nicht.
  for (const p of people) await personRepo.create(p);
  for (const l of lists) await listRepo.create(l);
  for (const t of tasks) await taskRepo.create(t);
  for (const n of notes) await noteRepo.create(n);
  for (const c of chats) await chatRepo.create(c);
  for (const m of chatMessages) await chatRepo.addMessage(m);
  await photoRepo.restore(photos);
  await docRepo.restore(documents);
  for (const j of journal) await journalRepo.upsert(j);
  sinks.setSavedFilters?.(filters);
  sinks.setDayIntentions?.(parseDayIntentions(parsed.dayIntentions));
  sinks.setAssistantMemory?.(str(parsed.assistantMemory) ? parsed.assistantMemory.trim() : '');

  return { lists: lists.length, tasks: tasks.length, notes: notes.length, filters: filters.length, photos: photos.length, chats: chats.length, documents: documents.length, journal: journal.length };
}
