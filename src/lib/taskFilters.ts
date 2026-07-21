// taskFilters.ts — reine Filter-Logik für gespeicherte Smart-Filter (Feature 5).
// Kombiniert Tags, Flagge und Zeitraum; testbar ohne UI/DB.
import type { Subtask, Task } from '@/data/types';
import { addDays } from '@/lib/dates';
import { isOpen, isOverdue } from '@/lib/taskLogic';

export type FilterRange = 'all' | 'today' | 'week' | 'overdue' | 'undated';

export type SavedFilter = {
  id: string;
  name: string;
  /** Aufgabe muss ALLE dieser Tags tragen (UND-Verknüpfung). */
  tags: string[];
  /** nur geflaggte. */
  flagged: boolean;
  range: FilterRange;
  /** erledigte einbeziehen? Standard: nur offene. */
  includeCompleted: boolean;
};

export function emptyFilter(): Omit<SavedFilter, 'id' | 'name'> {
  return { tags: [], flagged: false, range: 'all', includeCompleted: false };
}

function matchesRange(t: Task, range: FilterRange, today: string): boolean {
  switch (range) {
    case 'all':
      return true;
    case 'today':
      return t.dueDate !== null && t.dueDate <= today;
    case 'week':
      return t.dueDate !== null && t.dueDate <= addDays(today, 7);
    case 'overdue':
      return isOverdue(t, today);
    case 'undated':
      return t.dueDate === null;
  }
}

/** Wendet einen Filter auf die Aufgabenliste an (reine Funktion). */
export function applyFilter(tasks: Task[], filter: Omit<SavedFilter, 'id' | 'name'>, today: string): Task[] {
  return tasks.filter((t) => {
    if (!filter.includeCompleted && !isOpen(t)) return false;
    if (filter.flagged && !t.flagged) return false;
    if (filter.tags.length > 0 && !filter.tags.every((tag) => t.tags.includes(tag))) return false;
    if (!matchesRange(t, filter.range, today)) return false;
    return true;
  });
}

/** Alle vergebenen Tags mit Häufigkeit, absteigend sortiert (für Vorschläge/Filter). */
export function tagCounts(tasks: Task[]): { tag: string; count: number }[] {
  const map = new Map<string, number>();
  for (const t of tasks) {
    for (const tag of t.tags) map.set(tag, (map.get(tag) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag));
}

/** Fortschritt einer Checkliste. */
export function subtaskProgress(subtasks: Subtask[]): { done: number; total: number } {
  return { done: subtasks.filter((s) => s.done).length, total: subtasks.length };
}

/**
 * Volltext-Treffer für die Suche: Titel, Notiz, Tags und Unteraufgaben-Titel.
 * `q` wird bereits kleingeschrieben/getrimmt hereingereicht. Rein & testbar.
 */
export function taskMatchesQuery(task: Task, q: string): boolean {
  if (q.length === 0) return false;
  return (
    task.title.toLowerCase().includes(q) ||
    (task.note ?? '').toLowerCase().includes(q) ||
    task.tags.some((tag) => tag.toLowerCase().includes(q)) ||
    task.subtasks.some((s) => s.title.toLowerCase().includes(q))
  );
}
