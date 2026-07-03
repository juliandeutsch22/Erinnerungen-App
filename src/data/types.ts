// types.ts — Domänen-Typen der Erinnerungen-App (Fahrplan §5).
//
// Fälligkeiten sind bewusst LOKALE Kalenderwerte ('YYYY-MM-DD' + 'HH:MM'),
// keine UTC-Timestamps — sonst rutschen ganztägige Aufgaben bei Zeitzonen-/
// Sommerzeitwechsel um einen Tag (Fahrplan §8.2).

/** Wiederholung als einfaches Enum statt echter RRULE (deckt 95 % des Alltags ab). */
export type Rrule = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export type List = {
  id: string;
  name: string;
  /** lucide-Icon-Name, z. B. 'inbox', 'shopping-cart', 'briefcase'. */
  icon: string;
  /** Akzentfarbe (Hex) — aus einer kuratierten Palette, nicht frei. */
  color: string;
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
  /** null = offen. Bei Wiederholung: Instanz abgehakt → dueDate rückt weiter, bleibt null. */
  completedAt: string | null; // ISO
  /** geplante lokale Notification (zum Ersetzen/Abbrechen), null = keine geplant. */
  notificationId: string | null;
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
};

export type NewList = {
  name: string;
  icon: string;
  color: string;
};

/** Dependency-freier ID-Generator (ein Nutzer, ein Gerät — kein UUID nötig). */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
