// applyActions.ts — EINE Stelle, an der Assistenten-Vorschläge in den Bestand
// wandern. Vorher lag dieselbe Schleife dreimal (Braindump, Sprach-Sheet, Chat),
// und alle drei Fehler der letzten Fehlersuche steckten in genau dieser
// Verdreifachung: die doppelte Liste, die nie anlaufende Wiederholung und die
// nicht verankerte Fälligkeit mussten je dreimal repariert werden.
//
// Die Mutationen werden als Funktionen hereingereicht — dadurch ist das hier
// reine, testbare Logik, und die Bildschirme behalten ihre eigenen Hooks (und
// damit die Wiederholungs-Logik und die Notification-Neuplanung).
import { resolveListId, resolveTaskHandle, subtasksFromSchritte, actionDueDate, type AssistantAction } from '@/lib/assistant';
import type { List, NewList, NewTask, Subtask, Task } from '@/data/types';

export type ApplyDeps = {
  lists: List[];
  /** Nur zum Auflösen der Handles in „aenderungen" — darf leer sein. */
  tasks: Task[];
  today: string;
  createList: (input: NewList) => Promise<List>;
  createTask: (input: NewTask) => Promise<unknown>;
  createNote: (body: string) => Promise<unknown>;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => Promise<unknown>;
  completeTask: (task: Task) => Promise<unknown>;
  /** Papierkorb — NIE endgültig löschen. */
  trashTask: (id: string) => Promise<unknown>;
  createEvents: (termine: AssistantAction['termine']) => Promise<number>;
  /** Farbe für ein neues Projekt (Index = wievieltes in diesem Durchgang). */
  colorAt: (index: number) => string;
  /** Verknüpfung für neu angelegte Aufgaben (Chat an einem Termin). */
  taskEventId?: string | null;
};

export type ApplyResult = {
  projekte: number;
  aufgaben: number;
  notizen: number;
  termine: number;
  aenderungen: number;
};

/**
 * Wendet einen (bereits gefilterten) Aktions-Block an. Reihenfolge ist
 * bedeutsam und darf nicht getauscht werden:
 *  1. Projekte — danach kann „liste" einer Aufgabe darauf zeigen.
 *  2. Änderungen — VOR dem Anlegen, sonst könnte ein Handle auf eine gerade
 *     erst erzeugte Aufgabe treffen.
 *  3. Neue Aufgaben, Notizen, Termine.
 */
export async function applyAssistantActions(a: AssistantAction, deps: ApplyDeps): Promise<ApplyResult> {
  // 1. Projekte. Existiert der Name schon, wird die vorhandene Liste
  //    wiederverwendet — das Modell schlägt trotz Prompt gelegentlich eine
  //    bereits vorhandene vor.
  const frisch: { id: string; name: string }[] = [];
  let projekte = 0;
  for (const l of a.listen) {
    const bestehend = resolveListId(l.name, deps.lists, '');
    if (bestehend) {
      frisch.push({ id: bestehend, name: l.name });
      continue;
    }
    const created = await deps.createList({
      name: l.name,
      icon: 'inbox',
      color: deps.colorAt(deps.lists.length + projekte),
      goal: l.ziel ?? null,
      deadline: l.deadline ?? null,
    });
    frisch.push({ id: created.id, name: created.name });
    projekte += 1;
  }
  const alleListen = [...deps.lists, ...frisch];

  // 2. Änderungen an Bestehendem.
  let aenderungen = 0;
  for (const c of a.aenderungen) {
    const t = resolveTaskHandle(c.handle, deps.tasks);
    if (!t) continue; // unbekannt oder mehrdeutig → nie raten
    if (c.papierkorb) {
      await deps.trashTask(t.id);
      aenderungen += 1;
      continue;
    }
    const patch: Partial<Omit<Task, 'id'>> = {};
    if (c.titel) patch.title = c.titel;
    if (c.datum !== undefined) patch.dueDate = c.datum;
    if (c.zeit !== undefined) patch.dueTime = c.zeit;
    if (c.liste) patch.listId = resolveListId(c.liste, alleListen, t.listId);
    if (Object.keys(patch).length > 0) await deps.updateTask(t.id, patch);
    // Abhaken zuletzt: bei einer Wiederholung wandert dabei das Datum — das
    // soll auf dem bereits geänderten Stand geschehen.
    if (c.erledigt) await deps.completeTask({ ...t, ...patch });
    aenderungen += 1;
  }

  // 3. Neues.
  let aufgaben = 0;
  for (const t of a.aufgaben) {
    const subtasks: Subtask[] = subtasksFromSchritte(t.schritte);
    await deps.createTask({
      listId: resolveListId(t.liste, alleListen),
      title: t.titel,
      note: t.notiz ?? null,
      dueDate: actionDueDate(t, deps.today),
      dueTime: t.zeit ?? null,
      rrule: t.wiederholung ?? null,
      tags: t.tags ?? [],
      eventId: deps.taskEventId ?? null,
      subtasks,
    });
    aufgaben += 1;
  }

  let notizen = 0;
  for (const n of a.notizen) {
    await deps.createNote(n);
    notizen += 1;
  }

  const termine = a.termine.length > 0 ? await deps.createEvents(a.termine) : 0;

  return { projekte, aufgaben, notizen, termine, aenderungen };
}
