// applyActions.test.ts — die Reihenfolge und die Schutzregeln des Anwendens.
// Diese Datei hält genau die Fehler fest, die vorher dreimal repariert werden
// mussten, weil die Schleife dreimal kopiert war.
import { applyAssistantActions, type ApplyDeps } from './applyActions';
import type { AssistantAction } from './assistant';
import type { List, Task } from '@/data/types';

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
    },
    createNote: async (body) => log.push(`notiz:${body.slice(0, 12)}`),
    updateTask: async (id, patch) => {
      log.push(`update:${id}`);
      patches.push({ id, patch });
    },
    completeTask: async (t) => log.push(`erledigt:${t.id}`),
    trashTask: async (id) => log.push(`papierkorb:${id}`),
    createEvents: async (t) => {
      log.push(`termine:${t.length}`);
      return t.length;
    },
    colorAt: () => '#2B5FA6',
    ...over,
  };
  return { deps: base, log, createdTasks, patches };
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
    expect(res).toEqual({ projekte: 1, aufgaben: 2, notizen: 1, termine: 1, aenderungen: 1 });
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
