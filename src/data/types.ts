// types.ts — Domänen-Typen der Erinnerungen-App (Fahrplan §5).
//
// Fälligkeiten sind bewusst LOKALE Kalenderwerte ('YYYY-MM-DD' + 'HH:MM'),
// keine UTC-Timestamps — sonst rutschen ganztägige Aufgaben bei Zeitzonen-/
// Sommerzeitwechsel um einen Tag (Fahrplan §8.2).

/** Wiederholung als einfaches Enum statt echter RRULE (deckt 95 % des Alltags ab). */
export type Rrule = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

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
  sort: number;
  createdAt: string; // ISO
};

export type Task = {
  id: string;
  listId: string;
  title: string;
  note: string | null;
  dueDate: string | null; // 'YYYY-MM-DD' | null
  dueTime: string | null; // 'HH:MM' | null (nur mit dueDate)
  rrule: Rrule | null;
  flagged: boolean;
  /** An einen Gerätekalender-Termin gehängt (EventKit-Event-ID), null = frei. */
  eventId: string | null;
  /** null = offen. Bei Wiederholung: Instanz abgehakt → dueDate rückt weiter, bleibt null. */
  completedAt: string | null; // ISO
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
