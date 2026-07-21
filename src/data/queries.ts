// queries.ts — TanStack-Query-Hooks über die Repositories. Eine Quelle
// (['tasks'] / ['lists']), alle Smart-Ansichten sind reine Ableitungen.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { todayStr } from '@/lib/dates';
import { adoptOverdueToToday, resolveCompletion } from '@/lib/taskLogic';
import { getListRepository, getTaskRepository } from './index';
import type { List, NewList, NewTask, Task } from './types';
import { newId } from './types';

export const queryKeys = {
  tasks: ['tasks'] as const,
  lists: ['lists'] as const,
  tasksTrash: ['tasks-trash'] as const,
  listsTrash: ['lists-trash'] as const,
};

// M4 hakt sich hier ein: nach jeder Datenänderung Notifications neu planen.
let onTasksChanged: (() => void) | null = null;
export function setOnTasksChanged(fn: (() => void) | null) {
  onTasksChanged = fn;
}

// Die Standard-Hooks liefern nur AKTIVE Einträge — der Papierkorb hat eigene
// Hooks. So bleibt jeder bestehende Konsument (Heute, Suche, Assistent, …)
// automatisch papierkorb-frei.
export function useLists() {
  return useQuery<List[]>({
    queryKey: queryKeys.lists,
    queryFn: async () => (await getListRepository().getAll()).filter((l) => !l.deletedAt),
  });
}

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: queryKeys.tasks,
    queryFn: async () => (await getTaskRepository().getAll()).filter((t) => !t.deletedAt),
  });
}

/** Papierkorb: kürzlich gelöschte Aufgaben (ohne die einer gelöschten Liste —
 *  die hängen an ihrer Liste und kommen mit ihr zurück). */
export function useTrashedTasks() {
  return useQuery<Task[]>({
    queryKey: queryKeys.tasksTrash,
    queryFn: async () => {
      const [tasks, lists] = await Promise.all([getTaskRepository().getAll(), getListRepository().getAll()]);
      const trashedListStamps = new Map(lists.filter((l) => l.deletedAt).map((l) => [l.id, l.deletedAt]));
      return tasks.filter((t) => t.deletedAt && trashedListStamps.get(t.listId) !== t.deletedAt);
    },
  });
}

export function useTrashedLists() {
  return useQuery<List[]>({
    queryKey: queryKeys.listsTrash,
    queryFn: async () => (await getListRepository().getAll()).filter((l) => l.deletedAt),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.tasks });
    void qc.invalidateQueries({ queryKey: queryKeys.lists });
    void qc.invalidateQueries({ queryKey: queryKeys.tasksTrash });
    void qc.invalidateQueries({ queryKey: queryKeys.listsTrash });
    onTasksChanged?.();
  };
}

export function useCreateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: NewTask) => {
      const now = new Date();
      const task: Task = {
        id: newId(),
        listId: input.listId,
        title: input.title.trim(),
        note: input.note ?? null,
        dueDate: input.dueDate ?? null,
        dueTime: input.dueTime ?? null,
        rrule: input.rrule ?? null,
        flagged: input.flagged ?? false,
        eventId: input.eventId ?? null,
        completedAt: null,
        notificationId: null,
        tags: input.tags ?? [],
        subtasks: input.subtasks ?? [],
        createdAt: now.toISOString(),
        sort: now.getTime(),
      };
      await getTaskRepository().create(task);
      return task;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<Task, 'id'>> }) =>
      getTaskRepository().update(id, patch),
    onSuccess: invalidate,
  });
}

/** Abhaken: Wiederholung → dueDate wandert; sonst completedAt = jetzt. */
export function useCompleteTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (task: Task) => {
      const patch = resolveCompletion(task, todayStr());
      await getTaskRepository().update(task.id, patch);
    },
    onSuccess: invalidate,
  });
}

/** Erledigt → wieder offen (nur für Aufgaben ohne Wiederholung sinnvoll). */
export function useReopenTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => getTaskRepository().update(id, { completedAt: null }),
    onSuccess: invalidate,
  });
}

/** „Löschen" = Papierkorb (30 Tage) — endgültig löscht useDeleteTaskForever. */
export function useDeleteTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      getTaskRepository().update(id, { deletedAt: new Date().toISOString(), notificationId: null }),
    onSuccess: invalidate,
  });
}

export function useRestoreTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => getTaskRepository().update(id, { deletedAt: null }),
    onSuccess: invalidate,
  });
}

export function useDeleteTaskForever() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => getTaskRepository().remove(id),
    onSuccess: invalidate,
  });
}

/** Auto-Übernahme: alle überfälligen Aufgaben auf heute holen (dueDate → heute). */
export function useAdoptOverdue() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (tasks: Task[]) => {
      const repo = getTaskRepository();
      const patches = adoptOverdueToToday(tasks, todayStr());
      for (const { id, dueDate } of patches) await repo.update(id, { dueDate });
      return patches.length;
    },
    onSuccess: invalidate,
  });
}

/** Manuelle Reihenfolge festschreiben: sort nach der übergebenen id-Folge setzen. */
export function useReorderTasks() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const repo = getTaskRepository();
      // Große Abstände lassen später Platz zum Einfügen ohne Rundungsprobleme.
      for (let i = 0; i < orderedIds.length; i++) {
        await repo.update(orderedIds[i], { sort: i * 1000 });
      }
    },
    onSuccess: invalidate,
  });
}

export function useCreateList() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: NewList) => {
      const now = new Date();
      const list: List = {
        id: newId(),
        name: input.name.trim(),
        icon: input.icon,
        color: input.color,
        goal: input.goal ?? null,
        deadline: input.deadline ?? null,
        sort: now.getTime(),
        createdAt: now.toISOString(),
      };
      await getListRepository().create(list);
      return list;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateList() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<List, 'id'>> }) =>
      getListRepository().update(id, patch),
    onSuccess: invalidate,
  });
}

/** „Löschen" = Papierkorb: Liste UND ihre aktiven Aufgaben bekommen denselben
 *  Zeitstempel — beim Wiederherstellen kommen genau diese Aufgaben zurück. */
export function useDeleteList() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const stamp = new Date().toISOString();
      const taskRepo = getTaskRepository();
      const affected = (await taskRepo.getAll()).filter((t) => t.listId === id && !t.deletedAt);
      for (const t of affected) await taskRepo.update(t.id, { deletedAt: stamp, notificationId: null });
      await getListRepository().update(id, { deletedAt: stamp });
    },
    onSuccess: invalidate,
  });
}

export function useRestoreList() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (list: List) => {
      const taskRepo = getTaskRepository();
      // Nur die Aufgaben zurückholen, die MIT der Liste gelöscht wurden
      // (gleicher Stempel) — vorher einzeln gelöschte bleiben im Papierkorb.
      const affected = (await taskRepo.getAll()).filter(
        (t) => t.listId === list.id && t.deletedAt && t.deletedAt === list.deletedAt,
      );
      for (const t of affected) await taskRepo.update(t.id, { deletedAt: null });
      await getListRepository().update(list.id, { deletedAt: null });
    },
    onSuccess: invalidate,
  });
}

/** Endgültig: entfernt die Liste samt ALLER ihrer Aufgaben. */
export function useDeleteListForever() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await getTaskRepository().removeByList(id);
      await getListRepository().remove(id);
    },
    onSuccess: invalidate,
  });
}
