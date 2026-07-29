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
  /** Muss die angelegte Aufgabe zurückgeben — ohne id kein Rückgängig. */
  createTask: (input: NewTask) => Promise<{ id: string }>;
  /** Muss die angelegte Notiz zurückgeben — ohne id kein Rückgängig. */
  createNote: (body: string) => Promise<{ id: string }>;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => Promise<unknown>;
  completeTask: (task: Task) => Promise<unknown>;
  /** Papierkorb — NIE endgültig löschen. */
  trashTask: (id: string) => Promise<unknown>;
  createEvents: (termine: AssistantAction['termine']) => Promise<number>;
  /** Farbe für ein neues Projekt (Index = wievieltes in diesem Durchgang). */
  colorAt: (index: number) => string;
  /** Verknüpfung für neu angelegte Aufgaben (Chat an einem Termin). */
  taskEventId?: string | null;
  /**
   * Wohin Aufgaben gehen, für die das Modell KEINE Liste genannt hat.
   *
   * Der Bildschirm ist der Kontext: wer in einer Liste steht und dort etwas
   * eingibt, meint diese Liste — auch dann, wenn der Assistent die Eingabe
   * übernimmt. Ohne das sagte der Chip „→ Umzug", und die Aufgabe landete im
   * Eingang. Standard bleibt der Eingang.
   */
  defaultListId?: string;
};

/**
 * Was sich von einem Durchgang zurücknehmen lässt — genug, um den Bestand
 * wieder herzustellen, ohne den Durchgang zweimal zu rechnen.
 *
 * Termine fehlen hier BEWUSST: sie liegen im Gerätekalender, und dessen
 * Lösch-Weg braucht das native Event-Objekt, das `createAssistantEvent` gar
 * nicht zurückgibt. Ihn dafür umzubauen hieße, einen Löschpfad zu bauen, den
 * die Web-Verifikation nie ausführt — genau die Konstellation, aus der der
 * SQL-Fehler von v1.42 entstanden ist. Die Leiste sagt deshalb ehrlich, dass
 * Termine stehen bleiben.
 */
export type ApplyUndo = {
  /** IDs neu angelegter Aufgaben → in den Papierkorb. */
  aufgaben: string[];
  /** IDs neu angelegter Notizen → in den Papierkorb. */
  notizen: string[];
  /** IDs neu angelegter Projekte → in den Papierkorb. */
  listen: string[];
  /** Geänderte Aufgaben mit ihrem Stand VORHER. */
  aenderungen: { id: string; vorher: Partial<Omit<Task, 'id'>> }[];
  /** In den Papierkorb gelegte Aufgaben → wiederherstellen. */
  entsorgt: string[];
  /**
   * Abgehakte Aufgaben mit ihrem Stand VORHER.
   *
   * ⚠️ Nicht bloß die id: Abhaken ist bei einer Wiederholung ein DATUMS-SPRUNG
   * (`resolveCompletion`), nicht ein `completedAt`. Ein Zurücknehmen, das nur
   * `completedAt` zurücksetzt, ließe die Aufgabe eine Woche in der Zukunft
   * stehen — genau davor warnt schon der Kommentar in `useCompleteTask`.
   */
  abgehakt: { id: string; completedAt: string | null; dueDate: string | null }[];
};

export type ApplyResult = {
  projekte: number;
  aufgaben: number;
  notizen: number;
  termine: number;
  aenderungen: number;
  rueckgaengig: ApplyUndo;
};

export type UndoDeps = {
  trashTask: (id: string) => Promise<unknown>;
  restoreTask: (id: string) => Promise<unknown>;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => Promise<unknown>;
  trashNote: (id: string) => Promise<unknown>;
  trashList: (id: string) => Promise<unknown>;
};

/**
 * Einen Durchgang zurücknehmen. Die Reihenfolge ist die UMGEKEHRTE des
 * Anwendens: erst das Neue weg, dann das Geänderte zurück, zuletzt die
 * Projekte — sonst läge eine Aufgabe in einem Projekt, das es schon nicht
 * mehr gibt.
 *
 * Nichts wird endgültig gelöscht: alles geht in den Papierkorb, so wie
 * überall sonst in dieser App.
 */
export async function undoAppliedActions(u: ApplyUndo, deps: UndoDeps): Promise<void> {
  for (const id of u.aufgaben) await deps.trashTask(id);
  for (const id of u.notizen) await deps.trashNote(id);
  // Beide Felder zurück, nicht nur `completedAt` — siehe `ApplyUndo.abgehakt`.
  for (const a of u.abgehakt) await deps.updateTask(a.id, { completedAt: a.completedAt, dueDate: a.dueDate });
  for (const id of u.entsorgt) await deps.restoreTask(id);
  for (const { id, vorher } of u.aenderungen) await deps.updateTask(id, vorher);
  for (const id of u.listen) await deps.trashList(id);
}

/** Leerer Rückgängig-Block — für Aufrufer, die (noch) keinen brauchen. */
export const KEIN_UNDO: ApplyUndo = { aufgaben: [], notizen: [], listen: [], aenderungen: [], entsorgt: [], abgehakt: [] };

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
  // NUR die wirklich neu angelegten — `frisch` enthält auch wiederverwendete
  // Listen, und die darf ein Rückgängig niemals wegräumen.
  const neueListen: string[] = [];
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
    neueListen.push(created.id);
    projekte += 1;
  }
  const alleListen = [...deps.lists, ...frisch];

  // 2. Änderungen an Bestehendem.
  let aenderungen = 0;
  const rueckgaengig: ApplyUndo = { aufgaben: [], notizen: [], listen: neueListen, aenderungen: [], entsorgt: [], abgehakt: [] };
  for (const c of a.aenderungen) {
    const t = resolveTaskHandle(c.handle, deps.tasks);
    if (!t) continue; // unbekannt oder mehrdeutig → nie raten
    if (c.papierkorb) {
      await deps.trashTask(t.id);
      rueckgaengig.entsorgt.push(t.id);
      aenderungen += 1;
      continue;
    }
    const patch: Partial<Omit<Task, 'id'>> = {};
    if (c.titel) patch.title = c.titel;
    if (c.datum !== undefined) patch.dueDate = c.datum;
    if (c.zeit !== undefined) patch.dueTime = c.zeit;
    if (c.liste) patch.listId = resolveListId(c.liste, alleListen, t.listId);
    if (Object.keys(patch).length > 0) {
      // Den Stand VORHER merken — und nur die Felder, die wirklich angefasst
      // werden. Ein vollständiger Task als „vorher" würde beim Zurücknehmen
      // auch überschreiben, was inzwischen woanders geändert wurde.
      const vorher: Partial<Omit<Task, 'id'>> = {};
      for (const k of Object.keys(patch) as (keyof Omit<Task, 'id'>)[]) {
        (vorher as Record<string, unknown>)[k] = t[k];
      }
      rueckgaengig.aenderungen.push({ id: t.id, vorher });
      await deps.updateTask(t.id, patch);
    }
    // Abhaken zuletzt: bei einer Wiederholung wandert dabei das Datum — das
    // soll auf dem bereits geänderten Stand geschehen.
    if (c.erledigt) {
      // Der Stand VOR dem Abhaken — und zwar nach dem Patch, denn genau der
      // wird abgehakt (`{ ...t, ...patch }`).
      const vorherStand = { ...t, ...patch };
      await deps.completeTask(vorherStand);
      rueckgaengig.abgehakt.push({ id: t.id, completedAt: vorherStand.completedAt, dueDate: vorherStand.dueDate });
    }
    aenderungen += 1;
  }

  // 3. Neues.
  let aufgaben = 0;
  for (const t of a.aufgaben) {
    const subtasks: Subtask[] = subtasksFromSchritte(t.schritte);
    const neu = await deps.createTask({
      listId: resolveListId(t.liste, alleListen, deps.defaultListId ?? 'default'),
      title: t.titel,
      note: t.notiz ?? null,
      dueDate: actionDueDate(t, deps.today),
      dueTime: t.zeit ?? null,
      rrule: t.wiederholung ?? null,
      tags: t.tags ?? [],
      eventId: deps.taskEventId ?? null,
      subtasks,
    });
    if (neu?.id) rueckgaengig.aufgaben.push(neu.id);
    aufgaben += 1;
  }

  let notizen = 0;
  for (const n of a.notizen) {
    const neu = await deps.createNote(n);
    if (neu?.id) rueckgaengig.notizen.push(neu.id);
    notizen += 1;
  }

  const termine = a.termine.length > 0 ? await deps.createEvents(a.termine) : 0;

  return { projekte, aufgaben, notizen, termine, aenderungen, rueckgaengig };
}
