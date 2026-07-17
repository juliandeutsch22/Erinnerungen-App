// backup.test.ts — Export/Import-Roundtrip (Fahrplan §3.8) über die InMemory-Repos.
import { exportToJsonString, importBackup } from './backup';
import {
  __setListRepositoryForTests,
  __setNoteRepositoryForTests,
  __setPhotoRepositoryForTests,
  __setTaskRepositoryForTests,
} from './index';
import { InMemoryListRepository } from './ListRepository';
import { InMemoryNoteRepository } from './NoteRepository';
import { InMemoryPhotoRepository } from './PhotoRepository';
import { InMemoryTaskRepository } from './TaskRepository';
import { getListRepository, getNoteRepository, getPhotoRepository, getTaskRepository } from './index';
import type { SavedFilter } from '@/lib/taskFilters';
import type { Task } from './types';

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    listId: 'default',
    title: 'Test',
    note: null,
    dueDate: null,
    dueTime: null,
    rrule: null,
    flagged: false,
    eventId: null,
    completedAt: null,
    notificationId: null,
    tags: [],
    subtasks: [],
    createdAt: '2026-07-01T08:00:00.000Z',
    sort: 1,
    ...overrides,
  };
}

const noPhotos = { savedFilters: [] as SavedFilter[] };

describe('Backup', () => {
  beforeEach(() => {
    __setListRepositoryForTests(new InMemoryListRepository());
    __setTaskRepositoryForTests(new InMemoryTaskRepository());
    __setPhotoRepositoryForTests(new InMemoryPhotoRepository());
    __setNoteRepositoryForTests(new InMemoryNoteRepository());
  });

  afterEach(() => {
    __setListRepositoryForTests(null);
    __setTaskRepositoryForTests(null);
    __setPhotoRepositoryForTests(null);
    __setNoteRepositoryForTests(null);
  });

  it('Roundtrip: Export → Import stellt Listen + Aufgaben wieder her', async () => {
    await getListRepository().create({ id: 'l1', name: 'Einkauf', icon: 'shopping-cart', color: '#5B6CFF', goal: null, deadline: null, sort: 1, createdAt: '2026-07-01T08:00:00.000Z' });
    await getTaskRepository().create(task({ id: 't1', listId: 'l1', title: 'Milch', dueDate: '2026-07-04', dueTime: '09:00', rrule: 'weekly', notificationId: 'notif-alt' }));
    await getTaskRepository().create(task({ id: 't2', title: 'Steuer', completedAt: '2026-07-02T10:00:00.000Z' }));
    await getTaskRepository().create(task({ id: 't3', title: 'Agenda vorbereiten', eventId: 'evt-42' }));
    await getNoteRepository().create({
      id: 'n1',
      body: 'Meeting-Notizen\nPunkte für Q3',
      taskId: 't3',
      eventId: 'evt-42',
      createdAt: '2026-07-02T09:00:00.000Z',
      updatedAt: '2026-07-02T09:30:00.000Z',
    });

    const json = await exportToJsonString(noPhotos, new Date('2026-07-03T12:00:00.000Z'));

    // Frische Repos = neues Gerät.
    __setListRepositoryForTests(new InMemoryListRepository());
    __setTaskRepositoryForTests(new InMemoryTaskRepository());
    __setPhotoRepositoryForTests(new InMemoryPhotoRepository());
    __setNoteRepositoryForTests(new InMemoryNoteRepository());

    const result = await importBackup(json);
    expect(result).toEqual({ lists: 2, tasks: 3, notes: 1, filters: 0, photos: 0 }); // Standardliste + Einkauf

    const tasks = await getTaskRepository().getAll();
    const milch = tasks.find((t) => t.id === 't1')!;
    expect(milch.title).toBe('Milch');
    expect(milch.listId).toBe('l1');
    expect(milch.dueDate).toBe('2026-07-04');
    expect(milch.rrule).toBe('weekly');
    // Notification-IDs gehören zum alten Install → zurückgesetzt.
    expect(milch.notificationId).toBeNull();
    expect(tasks.find((t) => t.id === 't2')!.completedAt).toBe('2026-07-02T10:00:00.000Z');
    // Termin-Verknüpfung überlebt den Roundtrip.
    expect(tasks.find((t) => t.id === 't3')!.eventId).toBe('evt-42');

    const lists = await getListRepository().getAll();
    expect(lists.map((l) => l.name).sort()).toEqual(['Einkauf', 'Erinnerungen']);
    // Alte Marken-Farbe (Indigo) zieht über die Kette auf die Ägäis-Palette um.
    expect(lists.find((l) => l.id === 'l1')!.color).toBe('#7E8C5C');

    // Notiz überlebt den Roundtrip samt Verknüpfungen.
    const restoredNotes = await getNoteRepository().getAll();
    expect(restoredNotes).toHaveLength(1);
    expect(restoredNotes[0].body).toContain('Meeting-Notizen');
    expect(restoredNotes[0].taskId).toBe('t3');
    expect(restoredNotes[0].eventId).toBe('evt-42');
  });

  it('Roundtrip: Projekt-Ziel und Deadline bleiben erhalten', async () => {
    await getListRepository().create({ id: 'p1', name: 'Umzug', icon: 'briefcase', color: '#5B6CFF', goal: 'Bis Ende Juli umziehen', deadline: '2026-07-31', sort: 2, createdAt: '2026-07-01T08:00:00.000Z' });
    const json = await exportToJsonString(noPhotos, new Date('2026-07-03T12:00:00.000Z'));

    __setListRepositoryForTests(new InMemoryListRepository());
    await importBackup(json);

    const p = (await getListRepository().getAll()).find((l) => l.id === 'p1')!;
    expect(p.goal).toBe('Bis Ende Juli umziehen');
    expect(p.deadline).toBe('2026-07-31');
  });

  it('Roundtrip: Smart-Filter und Fotos (mit Datei-IO) werden wiederhergestellt', async () => {
    const filter: SavedFilter = { id: 'f1', name: 'Arbeit heute', tags: ['arbeit'], flagged: true, range: 'today', includeCompleted: false };
    await getPhotoRepository().restore([
      { id: 'p1', eventId: 'ev-9', uri: 'file:///old/a.png', addedAt: '2026-07-02T10:00:00.000Z' },
      { id: 'p2', eventId: 'ev-9', uri: 'file:///old/b.jpg', addedAt: '2026-07-02T10:00:01.000Z' },
    ]);

    // Fake-IO: Base64 pro URI beim Export, neue URI beim Import.
    const bytes: Record<string, string> = { 'file:///old/a.png': 'AAAA', 'file:///old/b.jpg': 'BBBB' };
    const written: { ext: string; data: string }[] = [];
    const json = await exportToJsonString(
      { savedFilters: [filter], readPhotoBase64: async (uri) => bytes[uri] ?? null, extFromUri: (uri) => uri.split('.').pop()! },
      new Date('2026-07-03T12:00:00.000Z'),
    );

    // Neues Gerät.
    __setListRepositoryForTests(new InMemoryListRepository());
    __setTaskRepositoryForTests(new InMemoryTaskRepository());
    __setPhotoRepositoryForTests(new InMemoryPhotoRepository());
    const restoredFilters: SavedFilter[][] = [];

    const result = await importBackup(json, {
      setSavedFilters: (f) => restoredFilters.push(f),
      writePhotoFromBase64: async (ext, data) => {
        written.push({ ext, data });
        return `file:///new/${written.length}.${ext}`;
      },
    });

    expect(result.filters).toBe(1);
    expect(result.photos).toBe(2);
    expect(restoredFilters[0]).toEqual([filter]);
    // Bytes wurden korrekt durchgereicht (png/jpg unterschieden). getAll liefert
    // die neuesten zuerst → b.jpg (10:00:01) vor a.png (10:00:00).
    expect(written).toEqual([
      { ext: 'jpg', data: 'BBBB' },
      { ext: 'png', data: 'AAAA' },
    ]);
    const photos = await getPhotoRepository().getAll();
    expect(photos.map((p) => p.eventId)).toEqual(['ev-9', 'ev-9']);
    expect(photos.every((p) => p.uri.startsWith('file:///new/'))).toBe(true);
  });

  it('ohne Datei-Senke werden Fotos übersprungen (Web/Einfügen)', async () => {
    await getPhotoRepository().restore([
      { id: 'p1', eventId: 'ev-9', uri: 'file:///old/a.png', addedAt: '2026-07-02T10:00:00.000Z' },
    ]);
    const json = await exportToJsonString({ savedFilters: [], readPhotoBase64: async () => 'AAAA' });

    __setPhotoRepositoryForTests(new InMemoryPhotoRepository());
    const result = await importBackup(json); // keine Senken
    expect(result.photos).toBe(0);
    expect(await getPhotoRepository().getAll()).toEqual([]);
  });

  it('liest ältere schemaVersion-1-Backups (ohne Filter/Fotos)', async () => {
    const json = JSON.stringify({
      app: 'stille',
      schemaVersion: 1,
      exportedAt: '2026-07-03T12:00:00.000Z',
      lists: [],
      tasks: [{ id: 'x', listId: 'default', title: 'Alt' }],
    });
    const result = await importBackup(json);
    expect(result).toEqual({ lists: 0, tasks: 1, notes: 0, filters: 0, photos: 0 });
  });

  it('Aufgaben mit unbekannter Liste fallen in die Standardliste', async () => {
    const json = JSON.stringify({
      app: 'stille',
      schemaVersion: 1,
      exportedAt: '2026-07-03T12:00:00.000Z',
      lists: [],
      tasks: [{ id: 'x', listId: 'weg', title: 'Verwaist' }],
    });
    await importBackup(json);
    const tasks = await getTaskRepository().getAll();
    expect(tasks[0].listId).toBe('default');
  });

  it('lehnt fremdes/ungültiges JSON ab', async () => {
    await expect(importBackup('kein json')).rejects.toThrow('Kein gültiges JSON.');
    await expect(importBackup('{"app":"cairn","schemaVersion":1}')).rejects.toThrow('Kein Erinnerungen-Backup');
  });
});
