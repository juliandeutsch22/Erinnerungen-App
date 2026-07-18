// duplicateList.ts — Vorlagen-Funktion: eine Liste samt Aufgaben duplizieren.
// Gedacht für wiederkehrende Abläufe („Packliste Reise", „Wocheneinkauf"):
// Die Kopie startet frisch — alles offen, Haken und Termine zurückgesetzt,
// Struktur (Titel, Notizen, Tags, Unteraufgaben) bleibt.
import type { List, Task } from '@/data/types';
import { newId } from '@/data/types';

export function duplicateListWithTasks(
  list: List,
  tasks: Task[],
  now: Date = new Date(),
): { list: List; tasks: Task[] } {
  const copy: List = {
    ...list,
    id: newId(),
    name: `${list.name} (Kopie)`,
    // Projekt-Zustand gehört zum Original — die Kopie startet neutral.
    deadline: null,
    sort: now.getTime(),
    createdAt: now.toISOString(),
  };
  const copiedTasks: Task[] = tasks
    .filter((t) => t.listId === list.id)
    .map((t, i) => ({
      ...t,
      id: newId(),
      listId: copy.id,
      completedAt: null,
      notificationId: null,
      // Fällige Daten der Vorlage sind Vergangenheit — die Kopie plant neu.
      dueDate: null,
      dueTime: null,
      eventId: null,
      subtasks: t.subtasks.map((s) => ({ ...s, id: newId(), done: false })),
      createdAt: now.toISOString(),
      sort: now.getTime() + i,
    }));
  return { list: copy, tasks: copiedTasks };
}
