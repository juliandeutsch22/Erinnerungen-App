// taskLogic.ts — reine Ableitungen über Aufgaben (testbar, ohne UI/DB).
import type { List, Rrule, Task } from '@/data/types';
import { addDays, deadlineLabel, isAfterCompletionRule, nextOccurrenceAfter, parseRrule } from '@/lib/dates';

export function isOpen(t: Task): boolean {
  return t.completedAt === null;
}

/** Überfällig = offen, Fälligkeitsdatum vor heute (Indigo-Akzent, kein Alarm-Rot). */
export function isOverdue(t: Task, today: string): boolean {
  // `isCurrent` steht hier bewusst MIT drin, nicht erst bei den Aufrufern:
  // Verfallen heißt „gegenstandslos", nicht „zu spät" — eine Aufgabe, deren
  // Anlass vorbei ist, darf nirgends als überfällig gelten. Vorher galt das nur
  // in den Listen-Zählungen und den Smart-Filtern, ausgerechnet nicht auf
  // „Heute", wo „überfällig" am lautesten steht (und wo „Überfällige auf heute
  // holen" sie mit EINEM Tipp reihenweise wiederbelebt hat).
  return isOpen(t) && isCurrent(t, today) && t.dueDate !== null && t.dueDate < today;
}

export function isDueToday(t: Task, today: string): boolean {
  return isOpen(t) && isCurrent(t, today) && t.dueDate === today;
}

/** Erledigte der letzten 30 Tage (ältere werden automatisch ausgeblendet). */
export function recentlyCompleted(tasks: Task[], today: string): Task[] {
  const cutoff = addDays(today, -30);
  return tasks
    .filter((t) => t.completedAt !== null && t.completedAt.slice(0, 10) >= cutoff)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
}

/**
 * Abhak-Semantik (Fahrplan §5): mit Wiederholung wandert `dueDate` zum nächsten
 * Vorkommen nach heute und die Aufgabe bleibt offen; ohne Wiederholung wird
 * `completedAt` gesetzt.
 */
export function resolveCompletion(
  t: Pick<Task, 'dueDate' | 'rrule' | 'rruleUntil'>,
  today: string,
  now: Date = new Date(),
): Partial<Task> {
  if (t.rrule && t.dueDate) {
    const rule = t.rrule as Rrule;
    // „x Tage nach Erledigung": die neue Fälligkeit zählt ab HEUTE (dem Tag des
    // Abhakens), nicht ab dem alten Datum — sonst stapelt sich Überfälliges,
    // obwohl nichts überfällig ist (Pflanzen gießen, Filter wechseln).
    const next = isAfterCompletionRule(rule)
      ? addDays(today, parseRrule(rule)!.n)
      : nextOccurrenceAfter(t.dueDate, rule, today);
    // Serienende erreicht → die Aufgabe ist endgültig fertig, statt ewig weiterzulaufen.
    if (t.rruleUntil && next > t.rruleUntil) return { completedAt: now.toISOString() };
    return { dueDate: next };
  }
  return { completedAt: now.toISOString() };
}

/** Sortierung innerhalb einer Gruppe: Uhrzeit zuerst (ohne Uhrzeit ans Ende), dann Anlage. */
export function byTimeThenCreation(a: Task, b: Task): number {
  if (a.dueTime !== b.dueTime) {
    if (a.dueTime === null) return 1;
    if (b.dueTime === null) return -1;
    return a.dueTime < b.dueTime ? -1 : 1;
  }
  return a.createdAt < b.createdAt ? -1 : 1;
}

export type TodayGroups = {
  overdue: Task[];
  timed: Task[]; // heute, mit Uhrzeit (chronologisch)
  untimed: Task[]; // heute, ohne Uhrzeit, tagsüber
  /** Heute, ohne Uhrzeit, ausdrücklich für den Abend. Der Tag ist keine Liste,
   *  er hat zwei Temperaturen — was nach Feierabend passiert, gehört nicht
   *  zwischen die Arbeitssachen. */
  evening: Task[];
};

/** Gruppen des Heute-Screens: überfällig → heute mit Uhrzeit → heute ohne Uhrzeit. */
export function groupToday(tasks: Task[], today: string): TodayGroups {
  const overdue = tasks
    .filter((t) => isOverdue(t, today))
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : byTimeThenCreation(a, b)));
  const dueToday = tasks.filter((t) => isDueToday(t, today));
  return {
    overdue,
    timed: dueToday.filter((t) => t.dueTime !== null).sort(byTimeThenCreation),
    // Mit Uhrzeit hat eine Aufgabe ihren Platz auf der Zeitachse — die
    // Abend-Markierung wirkt deshalb nur ohne.
    untimed: dueToday.filter((t) => t.dueTime === null && !t.evening).sort(byTimeThenCreation),
    evening: dueToday.filter((t) => t.dueTime === null && !!t.evening).sort(byTimeThenCreation),
  };
}

/**
 * Auto-Übernahme (Fahrplan Horizont 1): überfällige Aufgaben „auf heute holen".
 * Ergebnis sind die zu setzenden Patches (dueDate → heute); die Uhrzeit bleibt
 * unangetastet, erledigte/undatierte bleiben außen vor. Reine Funktion.
 */
export function adoptOverdueToToday(tasks: Task[], today: string): { id: string; dueDate: string }[] {
  return tasks.filter((t) => isOverdue(t, today)).map((t) => ({ id: t.id, dueDate: today }));
}

/**
 * Projekt-Fortschritt einer Liste: erledigte gegen alle Aufgaben (offen +
 * erledigt). ratio in [0,1]; leere Liste → 0. Reine Funktion.
 */
export function listProgress(tasks: Task[]): { done: number; total: number; ratio: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => !isOpen(t)).length;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

export type DayGroup = { date: string; tasks: Task[] };

/**
 * Wochenvorschau (Startscreen): offene Aufgaben der nächsten `days` Tage
 * NACH heute, gruppiert nach Tag — nur Tage, für die etwas ansteht.
 */
export function groupUpcomingDays(tasks: Task[], today: string, days: number = 6): DayGroup[] {
  const horizon = addDays(today, days);
  const byDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!isOpen(t) || t.dueDate === null) continue;
    if (t.dueDate <= today || t.dueDate > horizon) continue;
    const arr = byDate.get(t.dueDate) ?? [];
    arr.push(t);
    byDate.set(t.dueDate, arr);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, dayTasks]) => ({ date, tasks: dayTasks.sort(byTimeThenCreation) }));
}

export type PlannedGroup = { key: 'heute' | 'morgen' | 'woche' | 'spaeter'; title: string; tasks: Task[] };

/** „Geplant"-Gruppierung: Heute / Morgen / Diese Woche (7 Tage) / Später. */
export function groupPlanned(tasks: Task[], today: string): PlannedGroup[] {
  const open = tasks
    .filter((t) => isOpen(t) && t.dueDate !== null)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : byTimeThenCreation(a, b)));
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const groups: PlannedGroup[] = [
    { key: 'heute', title: 'Heute', tasks: open.filter((t) => t.dueDate! <= today) },
    { key: 'morgen', title: 'Morgen', tasks: open.filter((t) => t.dueDate! === tomorrow) },
    { key: 'woche', title: 'Diese Woche', tasks: open.filter((t) => t.dueDate! > tomorrow && t.dueDate! <= weekEnd) },
    { key: 'spaeter', title: 'Später', tasks: open.filter((t) => t.dueDate! > weekEnd) },
  ];
  return groups.filter((g) => g.tasks.length > 0);
}

/**
 * Der Zustand eines Projekts mit Deadline — an EINER Stelle, weil er vorher an
 * drei Stellen unterschiedlich entschieden wurde: Listen-Übersicht und
 * Projekt-Seite prüften den Fortschritt, der KALENDER gar nicht. Dort stand
 * deshalb „7 Tage überfällig" unter einem Projekt, in dem längst alles erledigt
 * war.
 *
 * Reihenfolge der Prüfung ist bedeutsam: ausdrücklich abgeschlossen schlägt
 * „alles erledigt" schlägt Deadline.
 */
export type ProjectState = 'abgeschlossen' | 'alles-erledigt' | 'laeuft';

export function projectState(
  list: Pick<List, 'completedAt'>,
  progress: { done: number; total: number },
): ProjectState {
  if (list.completedAt) return 'abgeschlossen';
  if (progress.total > 0 && progress.done >= progress.total) return 'alles-erledigt';
  return 'laeuft';
}

/** Beschriftung unter einem Projekt. Ein ruhendes Projekt mahnt NIE. */
export function projectDeadlineLabel(
  list: Pick<List, 'completedAt' | 'deadline'>,
  progress: { done: number; total: number },
  today: string,
): string | null {
  const state = projectState(list, progress);
  if (state === 'abgeschlossen') return 'Abgeschlossen';
  if (state === 'alles-erledigt') return 'Alles erledigt';
  return list.deadline ? deadlineLabel(list.deadline, today) : null;
}

/** Darf das Projekt im Kalender als Deadline auftauchen? Ruhendes nicht. */
export function projectShowsDeadline(
  list: Pick<List, 'completedAt' | 'deadline' | 'deletedAt'>,
  progress: { done: number; total: number },
): boolean {
  if (list.deletedAt || !list.deadline) return false;
  return projectState(list, progress) === 'laeuft';
}

// ——— Lebensspanne einer Aufgabe: ab wann, bis wann. ———
// Eine Aufgabe kannte bisher genau EINEN Zeitpunkt: fällig. Das erzeugt zwei
// Sorten Rauschen — Dinge, die noch nicht dran sind, stehen trotzdem im Weg;
// und Dinge, deren Anlass vorbei ist, gelten als „überfällig", obwohl sie
// schlicht gegenstandslos sind. Beides bekommt jetzt ein eigenes Datum.

/** Schlummert die Aufgabe noch? (Startdatum liegt in der Zukunft.) */
export function isDormant(t: Pick<Task, 'startDate'>, today: string): boolean {
  return !!t.startDate && t.startDate > today;
}

/** Ist der Anlass vorbei? Nicht „zu spät" — sondern gegenstandslos. */
export function isExpired(t: Pick<Task, 'expiresOn' | 'completedAt'>, today: string): boolean {
  return t.completedAt === null && !!t.expiresOn && t.expiresOn < today;
}

/**
 * Liegt die Aufgabe bei jemand anderem? Dann ist sie gerade nicht deine
 * Handlung — und hat auf „Heute" und im Überfällig-Stapel nichts verloren.
 *
 * Erledigtes zählt bewusst NICHT als wartend: eine abgehakte Aufgabe ist
 * fertig, egal wer sie am Ende getan hat. Sonst verschwände sie aus der
 * Erledigt-Sektion.
 */
export function isWaiting(t: Pick<Task, 'waiting' | 'completedAt'>): boolean {
  return t.completedAt === null && t.waiting === true;
}

/**
 * Zählt die Aufgabe in den normalen Ansichten mit? Schlummernde, verfallene
 * und wartende werden ausgeblendet — sie sind nicht gelöscht, nur nicht jetzt
 * bzw. nicht deine Handlung.
 * WICHTIG: erledigte Aufgaben filtert weiterhin `isOpen`; das hier ist eine
 * ZUSÄTZLICHE Bedingung, keine Ersetzung.
 *
 * Dass „wartend" HIER steht und nicht bei jedem Aufrufer einzeln, ist der
 * ganze Punkt: `isCurrent` ist das eine Tor, durch das Heute, Überfällig, die
 * Wochenvorschau, „Geplant" und die Smart-Filter gehen. Eine wartende Aufgabe
 * kann so nirgends als Versäumnis auftauchen.
 */
export function isCurrent(
  t: Pick<Task, 'startDate' | 'expiresOn' | 'completedAt' | 'waiting'>,
  today: string,
): boolean {
  return !isDormant(t, today) && !isExpired(t, today) && !isWaiting(t);
}

/** Wartende, noch offene Aufgaben — für die eigene ruhige Ansicht. */
export function waitingTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.deletedAt && isWaiting(t));
}

/**
 * In welchen Abschnitt einer LISTE gehört die Aufgabe? Genau einen.
 *
 * Bis v1.74 rechnete der Listen-Bildschirm seine vier Gruppen einzeln aus, und
 * die Bedingungen überlappten: eine Aufgabe, die WARTET und deren Startdatum
 * noch in der Zukunft liegt, stand unter „Später" UND unter „Warten auf" —
 * dieselbe Zeile zweimal auf einem Bildschirm, mit zwei Haken, die dasselbe
 * meinen.
 *
 * Die Rangfolge ist eine Aussage, keine Willkür:
 *  1. `verfallen` — der Anlass ist vorbei. Endgültig; daran ändert kein Warten
 *     und kein Startdatum mehr etwas.
 *  2. `warten`    — es liegt bei jemand anderem. Das sagt mehr über das Jetzt
 *     als „noch nicht dran": man wartet ja bereits.
 *  3. `spaeter`   — es ist schlicht noch nicht so weit.
 *  4. `offen`     — der Normalfall.
 *
 * Erledigtes ist hier NICHT dabei: es hat seine eigene Sektion und darf nicht
 * verschwinden, nur weil es zufällig auch verfallen wäre.
 */
export type ListenGruppe = 'offen' | 'warten' | 'spaeter' | 'verfallen';

export function listenGruppe(t: Task, today: string): ListenGruppe {
  if (isExpired(t, today)) return 'verfallen';
  if (isWaiting(t)) return 'warten';
  if (isDormant(t, today)) return 'spaeter';
  return 'offen';
}

/**
 * Was unter einer wartenden Aufgabe steht. Bewusst OHNE Dauer („seit zwölf
 * Tagen") — das wäre ein Schuld-Zähler für etwas, das man gar nicht in der
 * Hand hat.
 */
export function waitingLabel(t: Pick<Task, 'waiting' | 'waitingFor' | 'completedAt'>, personName?: string | null): string | null {
  if (!isWaiting(t)) return null;
  const worauf = (t.waitingFor ?? '').trim();
  if (personName && worauf) return `Wartet auf ${personName} · ${worauf}`;
  if (personName) return `Wartet auf ${personName}`;
  if (worauf) return `Wartet auf ${worauf}`;
  return 'Wartet';
}

/** Verfallene, noch offene Aufgaben — für den ruhigen Aufräum-Hinweis. */
export function expiredTasks(tasks: Task[], today: string): Task[] {
  return tasks.filter((t) => !t.deletedAt && isExpired(t, today));
}

/** Wie eine Lebensspanne unter der Aufgabe steht. null = nichts zu sagen. */
export function lifespanLabel(
  t: Pick<Task, 'startDate' | 'expiresOn' | 'completedAt'>,
  today: string,
): string | null {
  if (isExpired(t, today)) return 'Anlass vorbei';
  if (isDormant(t, today)) return `ab ${t.startDate}`;
  if (t.expiresOn) return `bis ${t.expiresOn}`;
  return null;
}
