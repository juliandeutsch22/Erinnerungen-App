// applyActions.test.ts — die Reihenfolge und die Schutzregeln des Anwendens.
// Diese Datei hält genau die Fehler fest, die vorher dreimal repariert werden
// mussten, weil die Schleife dreimal kopiert war.
import { applyAssistantActions, type ApplyDeps, type UndoDeps, undoAppliedActions } from './applyActions';
import type { AssistantAction } from './assistant';
import type { List, Person, Task } from '@/data/types';

const leer: AssistantAction = { aufgaben: [], termine: [], listen: [], aenderungen: [], checkliste: [], notizen: [] };

function list(id: string, name: string): List {
  return { id, name, icon: 'inbox', color: '#2B5FA6', goal: null, deadline: null, sort: 0, createdAt: '2026-07-01T08:00:00.000Z' };
}
function task(id: string, title: string, over: Partial<Task> = {}): Task {
  return {
    id, listId: 'default', title, note: null, dueDate: null, dueTime: null, rrule: null, flagged: false,
    eventId: null, completedAt: null, notificationId: null, tags: [], subtasks: [],
    createdAt: '2026-07-01T08:00:00.000Z', sort: 1, ...over,
  };
}

/** Aufzeichnende Attrappen — so lässt sich die REIHENFOLGE prüfen, nicht nur das Ergebnis. */
function deps(over: Partial<ApplyDeps> = {}) {
  const log: string[] = [];
  const createdTasks: Parameters<ApplyDeps['createTask']>[0][] = [];
  const patches: { id: string; patch: Partial<Omit<Task, 'id'>> }[] = [];
  const base: ApplyDeps = {
    lists: [list('default', 'Erinnerungen')],
    tasks: [],
    today: '2026-07-27',
    createList: async (input) => {
      log.push(`liste:${input.name}`);
      return list(`neu-${input.name}`, input.name);
    },
    createTask: async (input) => {
      log.push(`aufgabe:${input.title}`);
      createdTasks.push(input);
      return { id: `t-${input.title}` };
    },
    createNote: async (body) => {
      log.push(`notiz:${body.slice(0, 12)}`);
      return { id: `n-${body.slice(0, 6)}` };
    },
    updateTask: async (id, patch) => {
      log.push(`update:${id}`);
      patches.push({ id, patch });
    },
    completeTask: async (t) => log.push(`erledigt:${t.id}`),
    trashTask: async (id) => log.push(`papierkorb:${id}`),
    createEvents: async (t) => {
      log.push(`termine:${t.length}`);
      // Wie am Gerät: je Termin eine ID, in derselben Reihenfolge.
      return t.map((_, i) => `ev-${i}`);
    },
    linkEventPerson: async (eventId, personId) => {
      log.push(`termin-mensch:${eventId}:${personId}`);
    },
    createPerson: async (input) => {
      log.push(`mensch:${input.name}`);
      return { id: `p-${input.name}`, name: input.name, note: null, sort: 0, createdAt: '2026-07-27T09:00:00.000Z' };
    },
    colorAt: () => '#2B5FA6',
    ...over,
  };
  return { deps: base, log, createdTasks, patches };
}

function person(id: string, name: string): Person {
  return { id, name, note: null, sort: 0, createdAt: '2026-07-01T08:00:00.000Z' };
}

describe('applyAssistantActions', () => {
  it('legt Projekte VOR den Aufgaben an — sonst landet die Aufgabe im Eingang', async () => {
    const d = deps();
    await applyAssistantActions(
      { ...leer, listen: [{ name: 'Umzug' }], aufgaben: [{ titel: 'Kaution', liste: 'Umzug' }] },
      d.deps,
    );
    expect(d.log).toEqual(['liste:Umzug', 'aufgabe:Kaution']);
    expect(d.createdTasks[0].listId).toBe('neu-Umzug');
  });

  it('verwendet eine bereits vorhandene Liste wieder, statt sie zu verdoppeln', async () => {
    const d = deps({ lists: [list('default', 'Erinnerungen'), list('p1', 'Umzug')] });
    const res = await applyAssistantActions(
      { ...leer, listen: [{ name: 'umzug' }], aufgaben: [{ titel: 'Kaution', liste: 'Umzug' }] },
      d.deps,
    );
    expect(d.log).toEqual(['aufgabe:Kaution']); // KEIN createList
    expect(res.projekte).toBe(0);
    expect(d.createdTasks[0].listId).toBe('p1');
  });

  it('ändert Bestehendes VOR dem Anlegen — ein Handle darf nie eine frische Aufgabe treffen', async () => {
    const d = deps({ tasks: [task('aaaa111111', 'Alt')] });
    await applyAssistantActions(
      { ...leer, aenderungen: [{ handle: '111111', titel: 'Neu benannt' }], aufgaben: [{ titel: 'Frisch' }] },
      d.deps,
    );
    expect(d.log).toEqual(['update:aaaa111111', 'aufgabe:Frisch']);
  });

  it('verankert eine Wiederholung ohne Datum auf heute', async () => {
    const d = deps();
    await applyAssistantActions({ ...leer, aufgaben: [{ titel: 'Müll', wiederholung: 'weekly' }] }, d.deps);
    expect(d.createdTasks[0].dueDate).toBe('2026-07-27');
    expect(d.createdTasks[0].rrule).toBe('weekly');
  });

  it('hakt NACH dem Ändern ab, damit die Wiederholung vom neuen Datum aus weiterläuft', async () => {
    const d = deps({ tasks: [task('bbbb222222', 'Müll', { rrule: 'weekly', dueDate: '2026-07-20' })] });
    await applyAssistantActions(
      { ...leer, aenderungen: [{ handle: '222222', datum: '2026-07-28', erledigt: true }] },
      d.deps,
    );
    expect(d.log).toEqual(['update:bbbb222222', 'erledigt:bbbb222222']);
  });

  it('fasst bei unbekanntem oder mehrdeutigem Handle NICHTS an', async () => {
    const d = deps({ tasks: [task('aaaa111111', 'A'), task('bbbb111111', 'B')] });
    const res = await applyAssistantActions(
      { ...leer, aenderungen: [{ handle: '111111', erledigt: true }, { handle: 'ZZZZZZ', erledigt: true }] },
      d.deps,
    );
    expect(d.log).toEqual([]);
    expect(res.aenderungen).toBe(0);
  });

  it('legt nur in den Papierkorb, nie endgültig', async () => {
    const d = deps({ tasks: [task('cccc333333', 'Weg')] });
    await applyAssistantActions({ ...leer, aenderungen: [{ handle: '333333', papierkorb: true }] }, d.deps);
    expect(d.log).toEqual(['papierkorb:cccc333333']);
  });

  it('zählt ehrlich, was tatsächlich passiert ist', async () => {
    const d = deps({ tasks: [task('dddd444444', 'X')] });
    const res = await applyAssistantActions(
      {
        ...leer,
        listen: [{ name: 'Projekt' }],
        aenderungen: [{ handle: '444444', datum: '2026-08-01' }],
        aufgaben: [{ titel: 'A' }, { titel: 'B' }],
        notizen: ['Ein Gedanke'],
        termine: [{ titel: 'Zahnarzt', datum: '2026-08-03' }],
      },
      d.deps,
    );
    expect(res).toMatchObject({ projekte: 1, aufgaben: 2, notizen: 1, termine: 1, aenderungen: 1 });
  });
});

describe('Fehler werden nicht verschluckt', () => {
  // Die Bildschirme fangen sie ab und zeigen sie an. Würde applyAssistantActions
  // still weiterlaufen, sähe der Nutzer eine Erfolgsmeldung für Dinge, die es
  // nicht gibt — genau das war beim kaputten SQL acht Releases lang der Fall,
  // nur ohne jede Meldung.
  it('eine scheiternde Mutation lässt den ganzen Aufruf scheitern', async () => {
    const kaputt = deps({
      createTask: () => Promise.reject(new Error('tasks has 20 columns but 21 values were supplied')),
    });
    await expect(
      applyAssistantActions({ ...leer, aufgaben: [{ titel: 'Keller aufräumen' }] }, kaputt.deps),
    ).rejects.toThrow('21 values');
  });
});

describe('Rückgängig für „Übernehmen"', () => {
  it('merkt sich neu Angelegtes — Aufgaben, Notizen, Projekte', async () => {
    const res = await applyAssistantActions(
      { ...leer, listen: [{ name: 'Umzug' }], aufgaben: [{ titel: 'Kartons' }], notizen: ['Ein Gedanke'] },
      deps().deps,
    );
    expect(res.rueckgaengig.aufgaben).toEqual(['t-Kartons']);
    expect(res.rueckgaengig.notizen).toEqual(['n-Ein Ge']);
    expect(res.rueckgaengig.listen).toEqual(['neu-Umzug']);
  });

  it('räumt eine WIEDERVERWENDETE Liste nicht weg', async () => {
    // „Erinnerungen" gibt es schon — das Modell schlägt sie trotzdem vor.
    const res = await applyAssistantActions({ ...leer, listen: [{ name: 'Erinnerungen' }] }, deps().deps);
    expect(res.projekte).toBe(0);
    expect(res.rueckgaengig.listen).toEqual([]);
  });

  it('merkt bei Änderungen NUR die angefassten Felder', async () => {
    const t: Task = {
      id: 'a1', listId: 'default', title: 'Zahnarzt', note: 'wichtig', dueDate: '2026-07-27', dueTime: '10:00',
      rrule: null, startDate: null, expiresOn: null, evening: false, flagged: false, eventId: null,
      completedAt: null, notificationId: null, tags: [], subtasks: [], createdAt: '', sort: 0,
    };
    const d = deps({ tasks: [t] });
    const res = await applyAssistantActions(
      { ...leer, aenderungen: [{ handle: 'a1', datum: '2026-08-01' }] },
      d.deps,
    );
    const [erste] = res.rueckgaengig.aenderungen;
    expect(erste.id).toBe('a1');
    expect(erste.vorher).toEqual({ dueDate: '2026-07-27' });
    // Die Notiz wurde nie angefasst und darf beim Zurücknehmen nicht auftauchen.
    expect(Object.keys(erste.vorher)).not.toContain('note');
  });

  it('nimmt in umgekehrter Reihenfolge zurück: erst Inhalt, zuletzt das Projekt', async () => {
    const log: string[] = [];
    const rueck: UndoDeps = {
      trashTask: async (id) => void log.push(`aufgabe-weg:${id}`),
      restoreTask: async (id) => void log.push(`zurück:${id}`),
      updateTask: async (id, patch) => void log.push(`update:${id}:${JSON.stringify(patch)}`),
      trashNote: async (id) => void log.push(`notiz-weg:${id}`),
      trashList: async (id) => void log.push(`liste-weg:${id}`),
    };
    await undoAppliedActions(
      {
        aufgaben: ['t1'],
        notizen: ['n1'],
        listen: ['l1'],
        aenderungen: [{ id: 'a1', vorher: {} }],
        entsorgt: ['e1'],
        abgehakt: [{ id: 'h1', completedAt: null, dueDate: '2026-07-27' }],
      },
      rueck,
    );
    expect(log).toEqual([
      'aufgabe-weg:t1',
      'notiz-weg:n1',
      // Beide Felder zurueck — nicht nur completedAt.
      'update:h1:{"completedAt":null,"dueDate":"2026-07-27"}',
      'zurück:e1',
      'update:a1:{}',
      'liste-weg:l1',
    ]);
  });
});

describe('Rückgängig eines Abhakens bei WIEDERHOLUNG', () => {
  // Abhaken ist bei einer Wiederholung ein Datums-Sprung, kein `completedAt`.
  // Wer nur `completedAt` zuruecksetzt, laesst die Aufgabe eine Woche in der
  // Zukunft stehen — und genau das tat die erste Fassung (`reopenTask`).
  const woechentlich: Task = {
    id: 'w1', listId: 'default', title: 'Müll rausbringen', note: null,
    dueDate: '2026-07-27', dueTime: null, rrule: 'weekly', startDate: null, expiresOn: null,
    evening: false, flagged: false, eventId: null, completedAt: null, notificationId: null,
    tags: [], subtasks: [], createdAt: '', sort: 0,
  };

  it('merkt sich Datum UND completedAt, nicht nur die id', async () => {
    const d = deps({ tasks: [woechentlich] });
    const res = await applyAssistantActions({ ...leer, aenderungen: [{ handle: 'w1', erledigt: true }] }, d.deps);
    expect(res.rueckgaengig.abgehakt).toEqual([{ id: 'w1', completedAt: null, dueDate: '2026-07-27' }]);
  });

  it('nimmt beim Zurücknehmen BEIDE Felder zurück', async () => {
    const gesetzt: { id: string; patch: Partial<Omit<Task, 'id'>> }[] = [];
    await undoAppliedActions(
      { aufgaben: [], notizen: [], listen: [], aenderungen: [], entsorgt: [], abgehakt: [{ id: 'w1', completedAt: null, dueDate: '2026-07-27' }] },
      {
        trashTask: async () => {},
        restoreTask: async () => {},
        updateTask: async (id, patch) => void gesetzt.push({ id, patch }),
        trashNote: async () => {},
        trashList: async () => {},
      },
    );
    expect(gesetzt).toEqual([{ id: 'w1', patch: { completedAt: null, dueDate: '2026-07-27' } }]);
  });

  it('bei einer Änderung MIT Abhaken zählt der Stand nach dem Patch', async () => {
    const d = deps({ tasks: [woechentlich] });
    const res = await applyAssistantActions(
      { ...leer, aenderungen: [{ handle: 'w1', datum: '2026-08-03', erledigt: true }] },
      d.deps,
    );
    // Abgehakt wird `{ ...t, ...patch }` — also mit dem NEUEN Datum.
    expect(res.rueckgaengig.abgehakt).toEqual([{ id: 'w1', completedAt: null, dueDate: '2026-08-03' }]);
    // Und die Änderung selbst kennt weiterhin das alte Datum.
    expect(res.rueckgaengig.aenderungen).toEqual([{ id: 'w1', vorher: { dueDate: '2026-07-27' } }]);
  });
});

describe('Warten auf und Menschen', () => {
  it('legt eine wartende Aufgabe mit Text an', async () => {
    const d = deps();
    await applyAssistantActions(
      { ...leer, aufgaben: [{ titel: 'Dach reparieren', wartet_auf: 'Angebot' }] },
      d.deps,
    );
    expect(d.createdTasks[0].waiting).toBe(true);
    expect(d.createdTasks[0].waitingFor).toBe('Angebot');
  });

  it('lässt eine gewöhnliche Aufgabe NICHT warten', async () => {
    const d = deps();
    await applyAssistantActions({ ...leer, aufgaben: [{ titel: 'Milch kaufen' }] }, d.deps);
    expect(d.createdTasks[0].waiting).toBe(false);
    expect(d.createdTasks[0].waitingFor).toBeNull();
    expect(d.createdTasks[0].personId).toBeNull();
  });

  it('findet einen vorhandenen Menschen, statt ihn zu verdoppeln — Groß/Klein egal', async () => {
    const d = deps({ people: [person('p1', 'Anna')] });
    await applyAssistantActions({ ...leer, aufgaben: [{ titel: 'Urlaub klären', person: 'anna' }] }, d.deps);
    expect(d.log).toEqual(['aufgabe:Urlaub klären']); // KEIN createPerson
    expect(d.createdTasks[0].personId).toBe('p1');
  });

  it('legt einen unbekannten Menschen an — aber nur EINMAL pro Durchgang', async () => {
    const d = deps();
    await applyAssistantActions(
      {
        ...leer,
        aufgaben: [
          { titel: 'Fotos schicken', person: 'Papa' },
          { titel: 'Anrufen', person: ' papa ' },
        ],
      },
      d.deps,
    );
    expect(d.log.filter((x) => x.startsWith('mensch:'))).toEqual(['mensch:Papa']);
    expect(d.createdTasks[0].personId).toBe('p-Papa');
    expect(d.createdTasks[1].personId).toBe('p-Papa');
  });

  it('ignoriert „person" still, wenn der Aufrufer gar keine Menschen führt', async () => {
    const d = deps({ createPerson: undefined });
    await applyAssistantActions({ ...leer, aufgaben: [{ titel: 'X', person: 'Anna' }] }, d.deps);
    expect(d.createdTasks[0].personId).toBeNull();
  });

  it('setzt und beendet das Warten über eine Änderung', async () => {
    const bestehend = task('abc123', 'Angebot einholen', { waiting: true, waitingFor: 'Dachdecker' });
    const d = deps({ tasks: [bestehend] });
    await applyAssistantActions(
      { ...leer, aenderungen: [{ handle: 'abc123'.slice(-6), wartet_auf: null }] },
      d.deps,
    );
    expect(d.patches[0].patch.waiting).toBe(false);
    // Der Text muss MIT weg — sonst bliebe eine Fußnote ohne Zustand.
    expect(d.patches[0].patch.waitingFor).toBeNull();
  });

  it('nimmt eine Änderung, die NUR das Warten betrifft, überhaupt an', async () => {
    const bestehend = task('abc123', 'Rückruf');
    const d = deps({ tasks: [bestehend] });
    const res = await applyAssistantActions(
      { ...leer, aenderungen: [{ handle: 'abc123'.slice(-6), wartet_auf: 'Rückruf vom Amt' }] },
      d.deps,
    );
    expect(res.aenderungen).toBe(1);
    expect(d.patches[0].patch).toEqual({ waiting: true, waitingFor: 'Rückruf vom Amt' });
  });

  it('löst den Menschen über eine Änderung wieder', async () => {
    const bestehend = task('abc123', 'Urlaub', { personId: 'p1' });
    const d = deps({ tasks: [bestehend], people: [person('p1', 'Anna')] });
    await applyAssistantActions({ ...leer, aenderungen: [{ handle: 'abc123'.slice(-6), person: null }] }, d.deps);
    expect(d.patches[0].patch.personId).toBeNull();
  });

  it('macht das Anlegen eines Menschen NICHT rückgängig — er ist kein Vorschlag', async () => {
    const d = deps();
    const res = await applyAssistantActions({ ...leer, aufgaben: [{ titel: 'X', person: 'Neu' }] }, d.deps);
    // Nur die Aufgabe steht im Rückgängig-Block, der Mensch bleibt.
    expect(res.rueckgaengig.aufgaben).toEqual(['t-X']);
    expect(JSON.stringify(res.rueckgaengig)).not.toContain('p-Neu');
  });
});

describe('Menschen an Terminen', () => {
  it('hängt die Menschen an den RICHTIGEN Termin — die Reihenfolge ist die Zuordnung', async () => {
    const d = deps();
    await applyAssistantActions(
      {
        ...leer,
        termine: [
          { titel: 'Abendessen', datum: '2026-08-05', personen: ['Anna'] },
          { titel: 'Übergabe', datum: '2026-08-06', personen: ['Herr Brandt', 'Anna'] },
        ],
      },
      d.deps,
    );
    expect(d.log.filter((x) => x.startsWith('termin-mensch:'))).toEqual([
      'termin-mensch:ev-0:p-Anna',
      'termin-mensch:ev-1:p-Herr Brandt',
      'termin-mensch:ev-1:p-Anna',
    ]);
  });

  it('überspringt einen Termin, der gar nicht angelegt wurde (kein Kalenderzugriff)', async () => {
    const d = deps({ createEvents: async () => [null] });
    const res = await applyAssistantActions(
      { ...leer, termine: [{ titel: 'Abendessen', datum: '2026-08-05', personen: ['Anna'] }] },
      d.deps,
    );
    expect(res.termine).toBe(0);
    expect(d.log.filter((x) => x.startsWith('termin-mensch:'))).toEqual([]);
    // Und es wird auch kein Mensch auf Vorrat angelegt.
    expect(d.log.filter((x) => x.startsWith('mensch:'))).toEqual([]);
  });

  it('legt einen Menschen nur EINMAL an, auch wenn er an zwei Terminen steht', async () => {
    const d = deps();
    await applyAssistantActions(
      {
        ...leer,
        termine: [
          { titel: 'A', datum: '2026-08-05', personen: ['Anna'] },
          { titel: 'B', datum: '2026-08-06', personen: ['anna'] },
        ],
      },
      d.deps,
    );
    expect(d.log.filter((x) => x.startsWith('mensch:'))).toEqual(['mensch:Anna']);
  });

  it('lässt „personen" folgenlos, wenn der Aufrufer nicht verknüpfen kann', async () => {
    const d = deps({ linkEventPerson: undefined });
    const res = await applyAssistantActions(
      { ...leer, termine: [{ titel: 'A', datum: '2026-08-05', personen: ['Anna'] }] },
      d.deps,
    );
    expect(res.termine).toBe(1);
    expect(d.log.filter((x) => x.startsWith('termin-mensch:'))).toEqual([]);
  });
});
