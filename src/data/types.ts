// types.ts — Domänen-Typen der Erinnerungen-App (Fahrplan §5).
//
// Fälligkeiten sind bewusst LOKALE Kalenderwerte ('YYYY-MM-DD' + 'HH:MM'),
// keine UTC-Timestamps — sonst rutschen ganztägige Aufgaben bei Zeitzonen-/
// Sommerzeitwechsel um einen Tag (Fahrplan §8.2).

/** Die festen Rhythmen — seit jeher gespeicherte Werte, nie umbenennen. */
export type RrulePreset = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

/**
 * Wiederholung. Statt echter RRULE bewusst kurze, lesbare Zeichenketten —
 * rückwärtskompatibel: alte Aufgaben tragen weiterhin nur die Presets.
 *
 *  - Preset            fester Rhythmus ab dem Fälligkeitsdatum
 *  - `every:<n><d|w|m|y>` alle n Tage/Wochen/Monate/Jahre ab dem Fälligkeitsdatum
 *  - `after:<n><d|w|m|y>` n Tage/… NACH dem Erledigen (Pflanzen gießen, Filter
 *                       wechseln) — richtet sich nicht nach dem Kalender,
 *                       sondern danach, wann du es zuletzt getan hast.
 */
export type RruleUnit = 'd' | 'w' | 'm' | 'y';
export type Rrule =
  | RrulePreset
  | `every:${number}${RruleUnit}`
  | `after:${number}${RruleUnit}`
  /** Feste Wochentage, JS-Nummern (0=So … 6=Sa), aufsteigend und
   *  kommagetrennt: 'wd:1,4' = jeden Montag und Donnerstag. */
  | `wd:${string}`;

/** Ein Schritt innerhalb einer Aufgabe (Checkliste). */
export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

export type List = {
  id: string;
  name: string;
  /** lucide-Icon-Name, z. B. 'inbox', 'shopping-cart', 'briefcase'. */
  icon: string;
  /** Akzentfarbe (Hex) — aus einer kuratierten Palette, nicht frei. */
  color: string;
  /** Projekt-Ziel: worauf die Liste hinarbeitet (frei, optional). */
  goal: string | null;
  /** Projekt-Deadline ('YYYY-MM-DD', optional) — macht die Liste zum Projekt. */
  deadline: string | null;
  /** Papierkorb (30 Tage); optional wie bei Task — fehlend = aktiv. */
  deletedAt?: string | null; // ISO
  sort: number;
  createdAt: string; // ISO
  /** Abgeschlossen (ISO), null = läuft. Ein abgeschlossenes Projekt mahnt
   *  nicht mehr: keine Deadline-Anzeige, kein Punkt im Kalender.
   *  Optional, damit Alt-Daten ohne das Feld gültig bleiben. */
  completedAt?: string | null;
};

export type Task = {
  id: string;
  listId: string;
  title: string;
  note: string | null;
  dueDate: string | null; // 'YYYY-MM-DD' | null
  dueTime: string | null; // 'HH:MM' | null (nur mit dueDate)
  rrule: Rrule | null;
  /** Ende der Serie ('YYYY-MM-DD'): rückt die Wiederholung darüber hinaus,
   *  wird die Aufgabe endgültig erledigt. Optional — fehlend = ohne Ende. */
  rruleUntil?: string | null;
  /** AB wann die Aufgabe überhaupt sichtbar ist ('YYYY-MM-DD').
   *  „Winterreifen wechseln" gehört in den Oktober — bis dahin existiert sie,
   *  liegt aber nicht im Weg. Null = ab sofort. */
  startDate?: string | null;
  /** BIS wann sie noch Sinn hat ('YYYY-MM-DD'). Danach ist sie nicht überfällig,
   *  sondern gegenstandslos („Karten fürs Konzert kaufen" nach dem Konzert).
   *  Null = ohne Verfall. */
  expiresOn?: string | null;
  /** Gehört in die zweite Hälfte des Tages („Anna anrufen", nicht zwischen die
   *  Arbeitssachen). Wirkt nur bei Aufgaben OHNE Uhrzeit — mit Uhrzeit hat die
   *  Aufgabe ihren Platz auf der Zeitachse. */
  evening?: boolean;
  flagged: boolean;
  /** An einen Gerätekalender-Termin gehängt (EventKit-Event-ID), null = frei. */
  eventId: string | null;
  /** null = offen. Bei Wiederholung: Instanz abgehakt → dueDate rückt weiter, bleibt null. */
  completedAt: string | null; // ISO
  /** Papierkorb (30 Tage, wie Notizen); optional, damit Alt-Daten/Fixtures ohne
   *  das Feld gültig bleiben — fehlend = aktiv. */
  deletedAt?: string | null; // ISO
  /** geplante lokale Notification (zum Ersetzen/Abbrechen), null = keine geplant. */
  notificationId: string | null;
  /** Frei vergebbare Tags (kleingeschrieben, ohne #) — kontextübergreifend filterbar. */
  tags: string[];
  /** Checkliste innerhalb der Aufgabe (eine Ebene). */
  subtasks: Subtask[];
  createdAt: string; // ISO
  sort: number;
};

/** Felder, die beim Anlegen vom Aufrufer kommen (Rest wird generiert). */
export type NewTask = {
  listId: string;
  title: string;
  note?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  rrule?: Rrule | null;
  startDate?: string | null;
  expiresOn?: string | null;
  evening?: boolean;
  flagged?: boolean;
  eventId?: string | null;
  tags?: string[];
  subtasks?: Subtask[];
};

/** Tag normalisieren: klein, ohne führendes #, keine Leerzeichen. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');
}

export type NewList = {
  name: string;
  icon: string;
  color: string;
  goal?: string | null;
  deadline?: string | null;
};

/** Eine Notiz: Inhalt ohne Handlung — kein Datum, kein „erledigt".
 *  Titel = erste Zeile des Textes (iOS-Notizen-Verhalten, siehe noteLogic).
 *  Optional an EINE Erinnerung (taskId) und/oder EINEN Termin (eventId)
 *  gehängt; eine Erinnerung/ein Termin kann mehrere Notizen tragen. */
export type Note = {
  id: string;
  body: string;
  taskId: string | null;
  /** EventKit-Event-ID (wie bei Fotos). */
  eventId: string | null;
  /** Angeheftet — steht in der Liste oben vor den Datumsgruppen. */
  pinned: boolean;
  /** Papierkorb: gesetzt = „Zuletzt gelöscht" (30 Tage), null = aktiv. */
  deletedAt: string | null; // ISO
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

/** Ein Assistenten-Chat: optional an EINEN Termin und/oder EINE Erinnerung
 *  gehängt. `context` ist der beim Anlegen eingefrorene Termin-Kontext
 *  (Titel, Daten, Ort) — so bleibt der Chat auch ohne Kalenderzugriff lesbar. */
export type Chat = {
  id: string;
  title: string;
  eventId: string | null;
  taskId: string | null;
  /** An eine Notiz gehängt: der Chat liest ihren Inhalt LIVE (kein Snapshot). */
  noteId: string | null;
  context: string | null;
  /** Papierkorb (30 Tage, wie Notizen), null = aktiv. */
  deletedAt: string | null; // ISO
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type ChatMessage = {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string; // ISO
};

/** Dependency-freier ID-Generator (ein Nutzer, ein Gerät — kein UUID nötig). */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
