// queries.ts — TanStack-Query-Hooks über die Repositories. Eine Quelle
// (['tasks'] / ['lists']), alle Smart-Ansichten sind reine Ableitungen.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { todayStr } from '@/lib/dates';
import { resolveCompletion } from '@/lib/taskLogic';
import { getListRepository, getTaskRepository } from './index';
import type { List, NewList, NewTask, Task } from './types';
import { newId } from './types';

export const queryKeys = {
  tasks: ['tasks'] as const,
  lists: ['lists'] as const,
};

// M4 hakt sich hier ein: nach jeder Datenänderung Notifications neu planen.
let onTasksChanged: (() => void) | null = null;
export function setOnTasksChanged(fn: (() => void) | null) {
  onTasksChanged = fn;
}

export function useLists() {
  return useQuery<List[]>({ queryKey: queryKeys.lists, queryFn: () => getListRepository().getAll() });
}

export function useTasks() {
  return useQuery<Task[]>({ queryKey: queryKeys.tasks, queryFn: () => getTaskRepository().getAll() });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.tasks });
    void qc.invalidateQueries({ queryKey: queryKeys.lists });
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
        completedAt: null,
        notificationId: null,
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

export function useDeleteTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => getTaskRepository().remove(id),
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

/** Löscht Liste + zugehörige Aufgaben (zweistufig bestätigen — UI-Sache). */
export function useDeleteList() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await getTaskRepository().removeByList(id);
      await getListRepository().remove(id);
    },
    onSuccess: invalidate,
  });
}
