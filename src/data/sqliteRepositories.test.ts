// sqliteRepositories.test.ts — der Code, der auf dem Telefon die Daten hält,
// wird hier zum ersten Mal AUSGEFÜHRT.
//
// Bis v1.60 lief die gesamte Verifikations-Pipeline im Web, wo alle
// Repositories InMemory sind. Die `Sqlite*`-Klassen waren toter Text für
// tsc, Jest und Playwright — geprüft nur von `sqliteSchema.test.ts`, das die
// SQL-Zeichenketten liest, ohne sie laufen zu lassen. Alles, was erst beim
// Ausführen auffällt (Spaltenname vertippt, Migration vergessen, NOT NULL
// verletzt, Bindungswert abgelehnt), fiel erst auf dem Gerät auf.
//
// Hier läuft echtes SQLite (`node:sqlite`, siehe `testing/expoSqliteNode.ts`)
// gegen `:memory:` — derselbe Repository-Code, dasselbe Schema, dieselben
// Migrationen. Was hier rot ist, geht auf dem Telefon mit Sicherheit schief.
import { DEFAULT_LIST_ID } from './ListRepository';
import type { List, Note, Task } from './types';

// Nicht der Schlüssel-Wert, sondern der Modulname: expo-sqlite gibt es im
// Test-Node nicht (natives Modul) — node:sqlite tritt an seine Stelle.
jest.mock('expo-sqlite', () => require('./testing/expoSqliteNode'));

/**
 * Eine frische, leere Datenbank samt frischer Repositories.
 *
 * `getDb()` merkt sich die Verbindung modulweit; `resetModules` legt sowohl
 * `db.ts` als auch den Stellvertreter neu auf, sodass jeder Test bei null
 * anfängt — inklusive Schema-Anlage, Migrationen und Seed der Standardliste.
 */
async function frisch() {
  jest.resetModules();
  const { SqliteTaskRepository } = require('./SqliteTaskRepository');
  const { SqliteListRepository } = require('./SqliteListRepository');
  const { SqliteNoteRepository } = require('./SqliteNoteRepository');
  const { SqliteJournalRepository } = require('./SqliteJournalRepository');
  const { SqliteChatRepository } = require('./SqliteChatRepository');
  const { SqlitePhotoRepository } = require('./SqlitePhotoRepository');
  const { SqliteDocumentRepository } = require('./SqliteDocumentRepository');
  const { getDb } = require('./db');
  // Erzwingt Schema + Migrationen + Seed, bevor der Test etwas erwartet.
  const db = await getDb();
  return {
    db,
    tasks: new SqliteTaskRepository(),
    lists: new SqliteListRepository(),
    notes: new SqliteNoteRepository(),
    journal: new SqliteJournalRepository(),
    chats: new SqliteChatRepository(),
    photos: new SqlitePhotoRepository(),
    documents: new SqliteDocumentRepository(),
  };
}

function aufgabe(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: DEFAULT_LIST_ID,
    title: 'Kartons besorgen',
    note: null,
    dueDate: '2026-07-30',
    dueTime: null,
    rrule: null,
    rruleUntil: null,
    startDate: null,
    expiresOn: null,
    evening: false,
    flagged: false,
    eventId: null,
    completedAt: null,
    deletedAt: null,
    notificationId: null,
    tags: [],
    subtasks: [],
    createdAt: '2026-07-30T09:00:00.000Z',
    sort: 0,
    ...over,
  };
}

describe('Schema und Seed', () => {
  it('legt die Standardliste an — ohne sie hat keine Aufgabe ein Zuhause', async () => {
    const { lists } = await frisch();
    const alle: List[] = await lists.getAll();
    expect(alle.map((l) => l.id)).toContain(DEFAULT_LIST_ID);
  });

  it('kennt jede Spalte, die die Migration nachrüstet', async () => {
    const { tasks } = await frisch();
    // Diese fünf kamen per ALTER TABLE dazu. Fehlt eine, wirft das INSERT.
    await tasks.create(
      aufgabe({
        rruleUntil: '2026-12-31',
        startDate: '2026-07-01',
        expiresOn: '2026-08-31',
        evening: true,
        deletedAt: null,
        tags: ['umzug'],
        subtasks: [{ id: 's1', title: 'Größen messen', done: false }],
      }),
    );
    const [t] = await tasks.getAll();
    expect(t.rruleUntil).toBe('2026-12-31');
    expect(t.startDate).toBe('2026-07-01');
    expect(t.expiresOn).toBe('2026-08-31');
    expect(t.evening).toBe(true);
    expect(t.tags).toEqual(['umzug']);
    expect(t.subtasks).toEqual([{ id: 's1', title: 'Größen messen', done: false }]);
  });
});

describe('SqliteTaskRepository', () => {
  it('legt an, liest zurück und verliert dabei kein Feld', async () => {
    const { tasks } = await frisch();
    const t = aufgabe({ note: 'Beim Baumarkt fragen', dueTime: '17:30', flagged: true, rrule: 'weekly' });
    await tasks.create(t);
    const [gelesen] = await tasks.getAll();
    expect(gelesen).toEqual(t);
  });

  it('ändert einzelne Felder, ohne die anderen anzufassen', async () => {
    const { tasks } = await frisch();
    await tasks.create(aufgabe());
    await tasks.update('t1', { title: 'Kartons abholen', dueDate: '2026-08-02' });
    const [t] = await tasks.getAll();
    expect(t.title).toBe('Kartons abholen');
    expect(t.dueDate).toBe('2026-08-02');
    expect(t.listId).toBe(DEFAULT_LIST_ID);
    expect(t.createdAt).toBe('2026-07-30T09:00:00.000Z');
  });

  it('nimmt `evening` als boolean an — expo-sqlite tut das, die App verlässt sich darauf', async () => {
    const { tasks } = await frisch();
    await tasks.create(aufgabe());
    await tasks.update('t1', { evening: true });
    expect((await tasks.getAll())[0].evening).toBe(true);
    await tasks.update('t1', { evening: false });
    expect((await tasks.getAll())[0].evening).toBe(false);
  });

  it('macht aus einem leeren Patch KEIN kaputtes UPDATE', async () => {
    const { tasks } = await frisch();
    await tasks.create(aufgabe());
    await expect(tasks.update('t1', {})).resolves.toBeUndefined();
    expect((await tasks.getAll())[0].title).toBe('Kartons besorgen');
  });

  it('sortiert nach sort, dann nach Anlegezeit', async () => {
    const { tasks } = await frisch();
    await tasks.create(aufgabe({ id: 'a', sort: 2, title: 'Zweite' }));
    await tasks.create(aufgabe({ id: 'b', sort: 1, title: 'Erste' }));
    await tasks.create(aufgabe({ id: 'c', sort: 1, title: 'Auch erste, aber später', createdAt: '2026-07-30T10:00:00.000Z' }));
    expect((await tasks.getAll()).map((t: Task) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('löscht einzeln und listenweise', async () => {
    const { tasks } = await frisch();
    await tasks.create(aufgabe({ id: 'a' }));
    await tasks.create(aufgabe({ id: 'b', listId: 'projekt' }));
    await tasks.create(aufgabe({ id: 'c', listId: 'projekt' }));
    await tasks.remove('a');
    expect((await tasks.getAll()).map((t: Task) => t.id)).toEqual(['b', 'c']);
    await tasks.removeByList('projekt');
    expect(await tasks.getAll()).toEqual([]);
  });

  it('überschreibt beim zweiten create dieselbe id (INSERT OR REPLACE)', async () => {
    const { tasks } = await frisch();
    await tasks.create(aufgabe());
    await tasks.create(aufgabe({ title: 'Doch etwas anderes' }));
    const alle = await tasks.getAll();
    expect(alle).toHaveLength(1);
    expect(alle[0].title).toBe('Doch etwas anderes');
  });
});

describe('SqliteListRepository', () => {
  it('legt an, ändert und räumt in den Papierkorb', async () => {
    const { lists } = await frisch();
    await lists.create({
      id: 'umzug',
      name: 'Umzug',
      icon: 'box',
      color: '#2B5FA6',
      goal: 'Bis Ende August raus',
      deadline: '2026-08-31',
      completedAt: null,
      deletedAt: null,
      sort: 1,
      createdAt: '2026-07-30T09:00:00.000Z',
    });
    const nach = (await lists.getAll()).find((l: List) => l.id === 'umzug');
    expect(nach?.goal).toBe('Bis Ende August raus');
    expect(nach?.deadline).toBe('2026-08-31');

    await lists.update('umzug', { name: 'Umzug 2026', deletedAt: '2026-08-01T00:00:00.000Z' });
    const danach = (await lists.getAll()).find((l: List) => l.id === 'umzug');
    expect(danach?.name).toBe('Umzug 2026');
    expect(danach?.deletedAt).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('SqliteNoteRepository', () => {
  it('trägt Notizen samt Verknüpfungen und Papierkorb', async () => {
    const { notes } = await frisch();
    await notes.create({
      id: 'n1',
      body: 'Kaution 1200 EUR',
      taskId: 't1',
      eventId: null,
      pinned: true,
      deletedAt: null,
      createdAt: '2026-07-30T09:00:00.000Z',
      updatedAt: '2026-07-30T09:00:00.000Z',
    });
    const [n]: Note[] = await notes.getAll();
    expect(n.body).toBe('Kaution 1200 EUR');
    expect(n.taskId).toBe('t1');
    expect(n.pinned).toBe(true);

    await notes.update('n1', { pinned: false, body: 'Kaution 1300 EUR' });
    const [nach]: Note[] = await notes.getAll();
    expect(nach.pinned).toBe(false);
    expect(nach.body).toBe('Kaution 1300 EUR');
  });
});

describe('SqliteJournalRepository', () => {
  it('hält pro Tag genau einen Eintrag — der zweite ersetzt den Text, nicht die Zeile', async () => {
    const { journal } = await frisch();
    await journal.upsert({ id: 'j1', date: '2026-07-30', text: 'Ruhiger Tag.', deletedAt: null, createdAt: 'A', updatedAt: 'A' });
    await journal.upsert({ id: 'j2', date: '2026-07-30', text: 'Doch nicht so ruhig.', deletedAt: null, createdAt: 'B', updatedAt: 'B' });
    const alle = await journal.getAll();
    expect(alle).toHaveLength(1);
    // id und createdAt gehören dem ERSTEN Eintrag des Tages.
    expect(alle[0].id).toBe('j1');
    expect(alle[0].createdAt).toBe('A');
    expect(alle[0].text).toBe('Doch nicht so ruhig.');
    expect(alle[0].updatedAt).toBe('B');
  });

  it('legt in den Papierkorb, holt zurück und löscht erst dann endgültig', async () => {
    const { journal } = await frisch();
    await journal.upsert({ id: 'j1', date: '2026-07-30', text: 'Ruhiger Tag.', deletedAt: null, createdAt: 'A', updatedAt: 'A' });
    await journal.setDeletedAt('j1', '2026-07-31T20:00:00.000Z');
    expect((await journal.getAll())[0].deletedAt).toBe('2026-07-31T20:00:00.000Z');
    // Die Zeile ist noch DA — genau das ist der Unterschied zu vorher.
    expect(await journal.getAll()).toHaveLength(1);

    await journal.setDeletedAt('j1', null);
    expect((await journal.getAll())[0].deletedAt).toBeNull();

    await journal.remove('j1');
    expect(await journal.getAll()).toEqual([]);
  });

  it('holt einen Abend zurück, sobald man an dem Tag wieder schreibt', async () => {
    const { journal } = await frisch();
    await journal.upsert({ id: 'j1', date: '2026-07-30', text: 'Erst so.', deletedAt: null, createdAt: 'A', updatedAt: 'A' });
    await journal.setDeletedAt('j1', '2026-07-31T20:00:00.000Z');
    // Ohne diese Zusage stünde der neue Text da, der Eintrag bliebe gelöscht.
    await journal.upsert({ id: 'j9', date: '2026-07-30', text: 'Doch anders.', deletedAt: null, createdAt: 'B', updatedAt: 'B' });
    const [e] = await journal.getAll();
    expect(e.deletedAt).toBeNull();
    expect(e.text).toBe('Doch anders.');
    expect(e.id).toBe('j1');
  });

  it('gibt die neuesten Tage zuerst', async () => {
    const { journal } = await frisch();
    for (const d of ['2026-07-28', '2026-07-30', '2026-07-29']) {
      await journal.upsert({ id: `j-${d}`, date: d, text: d, deletedAt: null, createdAt: d, updatedAt: d });
    }
    expect((await journal.getAll()).map((e: { date: string }) => e.date)).toEqual(['2026-07-30', '2026-07-29', '2026-07-28']);
  });
});

describe('SqliteChatRepository', () => {
  it('hält Chat und Nachrichten getrennt und in Reihenfolge', async () => {
    const { chats } = await frisch();
    await chats.create({
      id: 'c1',
      title: 'Umzug',
      eventId: null,
      taskId: null,
      noteId: null,
      context: null,
      deletedAt: null,
      createdAt: '2026-07-30T09:00:00.000Z',
      updatedAt: '2026-07-30T09:00:00.000Z',
    });
    await chats.addMessage({ id: 'm1', chatId: 'c1', role: 'user', content: 'Was fehlt noch?', createdAt: '2026-07-30T09:01:00.000Z' });
    await chats.addMessage({ id: 'm2', chatId: 'c1', role: 'assistant', content: 'Kartons.', createdAt: '2026-07-30T09:02:00.000Z' });
    const msgs = await chats.getMessages('c1');
    expect(msgs.map((m: { id: string }) => m.id)).toEqual(['m1', 'm2']);
    expect((await chats.getAll())[0].title).toBe('Umzug');
    // getAllMessages ignoriert den Chat — das braucht das Backup.
    expect((await chats.getAllMessages())).toHaveLength(2);
  });
});

describe('SqlitePhotoRepository und SqliteDocumentRepository', () => {
  it('hängen Anlagen an einen Termin und geben sie wieder her', async () => {
    const { photos, documents } = await frisch();
    // `add` vergibt die IDs selbst und gibt die angelegten Zeilen zurück.
    const [p1] = await photos.add('e1', ['file:///a.jpg']);
    await photos.add('e2', ['file:///b.jpg']);
    expect((await photos.getForEvent('e1')).map((p: { uri: string }) => p.uri)).toEqual(['file:///a.jpg']);
    expect(await photos.getAll()).toHaveLength(2);
    await photos.remove(p1.id);
    expect(await photos.getForEvent('e1')).toEqual([]);

    await documents.add({ id: 'd1', eventId: 'e1', name: 'Ticket.pdf', uri: 'file:///t.pdf', addedAt: '2026-07-30T09:00:00.000Z' });
    expect((await documents.getAll()).map((d: { name: string }) => d.name)).toEqual(['Ticket.pdf']);
    // restore ersetzt den Bestand — das ist der Weg, den der Backup-Import geht.
    await documents.restore([
      { id: 'd2', eventId: 'e9', name: 'Buchung.pdf', uri: 'file:///b.pdf', addedAt: '2026-07-30T10:00:00.000Z' },
    ]);
    expect((await documents.getAll()).map((d: { id: string }) => d.id)).toEqual(['d2']);
  });
});

describe('Transaktionen', () => {
  it('nimmt die Aufgaben einer Liste mit — in EINEM Zug', async () => {
    const { tasks, lists } = await frisch();
    await lists.create({
      id: 'umzug', name: 'Umzug', icon: 'box', color: '#2B5FA6', goal: null,
      deadline: null, completedAt: null, deletedAt: null, sort: 1, createdAt: 'A',
    });
    await tasks.create(aufgabe({ id: 'a', listId: 'umzug' }));
    await tasks.create(aufgabe({ id: 'b' }));
    await lists.remove('umzug');
    expect((await lists.getAll()).map((l: List) => l.id)).toEqual([DEFAULT_LIST_ID]);
    expect((await tasks.getAll()).map((t: Task) => t.id)).toEqual(['b']);
  });

  it('lässt die Standardliste stehen — sie ist das Zuhause jeder Aufgabe', async () => {
    const { lists } = await frisch();
    await lists.remove(DEFAULT_LIST_ID);
    expect((await lists.getAll()).map((l: List) => l.id)).toEqual([DEFAULT_LIST_ID]);
  });

  it('rollt zurück, wenn mitten im Zug etwas wirft — halbe Zustände gibt es nicht', async () => {
    const { db, tasks } = await frisch();
    await tasks.create(aufgabe({ id: 'a' }));
    await expect(
      db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM tasks WHERE id = ?', ['a']);
        throw new Error('Abbruch mitten drin');
      }),
    ).rejects.toThrow('Abbruch mitten drin');
    // Die Aufgabe ist noch da: der Abbruch hat den ganzen Zug zurückgenommen.
    expect((await tasks.getAll()).map((t: Task) => t.id)).toEqual(['a']);
  });
});

describe('kvStorage (der native Pfad)', () => {
  // Hier liegen Thema, Bewegung, Onboarding und der Account-Zustand. Der Pfad
  // ist im Web nie aktiv (dort localStorage) und war deshalb ebenfalls nie
  // ausgeführt — obwohl er eine EIGENE Verbindung zu derselben Datei aufmacht
  // und dort eine eigene Tabelle anlegt.
  it('legt seine Tabelle an, hält Werte und nimmt sie wieder zurück', async () => {
    jest.resetModules();
    const { kvStorage } = require('./kvStorage');
    expect(await kvStorage.getItem('stoa.theme')).toBeNull();
    await kvStorage.setItem('stoa.theme', '{"scheme":"dark"}');
    expect(await kvStorage.getItem('stoa.theme')).toBe('{"scheme":"dark"}');
    // Derselbe Schlüssel zweimal ersetzt, statt zu doppeln (PRIMARY KEY).
    await kvStorage.setItem('stoa.theme', '{"scheme":"light"}');
    expect(await kvStorage.getItem('stoa.theme')).toBe('{"scheme":"light"}');
    await kvStorage.removeItem('stoa.theme');
    expect(await kvStorage.getItem('stoa.theme')).toBeNull();
  });

  it('teilt sich die Datei mit den Repositories, ohne sich in die Quere zu kommen', async () => {
    jest.resetModules();
    const { kvStorage } = require('./kvStorage');
    const { SqliteTaskRepository } = require('./SqliteTaskRepository');
    const { getDb } = require('./db');
    await getDb();
    await kvStorage.setItem('stoa.onboarding', 'done');
    const tasks = new SqliteTaskRepository();
    await tasks.create(aufgabe());
    expect(await kvStorage.getItem('stoa.onboarding')).toBe('done');
    expect(await tasks.getAll()).toHaveLength(1);
  });
});

describe('Fremdschlüssel und Aufräumen', () => {
  it('räumt clearAll wirklich leer — die Grundlage jedes Backup-Imports', async () => {
    const { tasks, lists, notes } = await frisch();
    await tasks.create(aufgabe());
    await notes.create({
      id: 'n1', body: 'x', taskId: null, eventId: null, pinned: false,
      deletedAt: null, createdAt: 'A', updatedAt: 'A',
    });
    await tasks.clearAll();
    await notes.clearAll();
    await lists.clearAll();
    expect(await tasks.getAll()).toEqual([]);
    expect(await notes.getAll()).toEqual([]);
    // Die Standardliste überlebt bewusst: nach dem Import muss jede Aufgabe
    // ein Zuhause haben, auch wenn das Backup keine Listen mitbrachte.
    expect((await lists.getAll()).map((l: List) => l.id)).toEqual([DEFAULT_LIST_ID]);
  });

  it('lässt eine Aufgabe in einer Liste zu, die es nicht gibt — wie auf dem Gerät', async () => {
    // `REFERENCES lists(id)` steht im Schema, aber SQLite prüft Fremdschlüssel
    // nur mit `PRAGMA foreign_keys = ON`, und expo-sqlite setzt das nirgends.
    // Der Test hält das ausdrücklich fest: wer die Bedingung will, muss sie
    // einschalten — und dann fällt genau hier auf, was das kostet.
    const { tasks } = await frisch();
    await expect(tasks.create(aufgabe({ listId: 'gibt-es-nicht' }))).resolves.toBeUndefined();
    expect((await tasks.getAll())[0].listId).toBe('gibt-es-nicht');
  });
});
