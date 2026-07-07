// liste/[id].tsx — Listen-Detail. `id` ist eine echte Liste oder eine
// Smart-Ansicht: 'geplant' (chronologisch gruppiert) / 'alle' (nach Liste).
// Offene zuerst (fällige oben), Erledigt-Sektion einklappbar (30-Tage-Fenster).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpDown, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { GlassButton } from '@/components/GlassButton';
import { GlassPanel } from '@/components/GlassPanel';
import { ListEditorSheet } from '@/components/ListEditorSheet';
import { listIcon } from '@/components/listMeta';
import { PressableScale } from '@/components/PressableScale';
import { ReorderSheet } from '@/components/ReorderSheet';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState } from '@/components/StateView';
import { TaskEditorSheet } from '@/components/TaskEditorSheet';
import { TaskRow } from '@/components/TaskRow';
import { Type } from '@/components/Type';
import { useCompleteTask, useLists, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { deadlineLabel, todayStr } from '@/lib/dates';
import { byTimeThenCreation, groupPlanned, isOpen, listProgress, recentlyCompleted } from '@/lib/taskLogic';
import { hapticSelect } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export default function ListeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const complete = useCompleteTask();
  const reopen = useReopenTask();

  const [editorTask, setEditorTask] = useState<Task | null | undefined>(undefined);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [editList, setEditList] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [reordering, setReordering] = useState(false);

  const today = todayStr();
  const isSmartView = id === 'geplant' || id === 'alle';
  const list = useMemo(() => (lists ?? []).find((l) => l.id === id) ?? null, [lists, id]);
  const listById = useMemo(() => new Map((lists ?? []).map((l) => [l.id, l])), [lists]);

  const scoped = useMemo(() => {
    const all = tasks ?? [];
    if (id === 'geplant') return all.filter((t) => t.dueDate !== null);
    if (id === 'alle') return all;
    return all.filter((t) => t.listId === id);
  }, [tasks, id]);

  // Offene: fällige zuerst (chronologisch), der Rest nach Anlage (Fahrplan §4).
  const open = useMemo(
    () =>
      scoped.filter(isOpen).sort((a, b) => {
        if (a.dueDate !== b.dueDate) {
          if (a.dueDate === null) return 1;
          if (b.dueDate === null) return -1;
          return a.dueDate < b.dueDate ? -1 : 1;
        }
        return byTimeThenCreation(a, b);
      }),
    [scoped],
  );
  const completed = useMemo(() => recentlyCompleted(scoped, today), [scoped, today]);
  const progress = useMemo(() => listProgress(scoped), [scoped]);
  const isProject = !!(list && (list.goal || list.deadline));
  const deadlineOverdue = !!list?.deadline && list.deadline < today && progress.ratio < 1;
  const plannedGroups = useMemo(() => (id === 'geplant' ? groupPlanned(scoped, today) : []), [id, scoped, today]);

  const title = id === 'geplant' ? 'Geplant' : id === 'alle' ? 'Alle' : (list?.name ?? 'Liste');
  const ListIcon = list ? listIcon(list.icon) : null;

  const toggle = (task: Task) => (next: boolean) => {
    if (next) complete.mutate(task);
    else reopen.mutate(task.id);
  };

  const renderRow = (t: Task, showListName: boolean) => (
    <TaskRow
      key={t.id}
      task={t}
      today={today}
      list={showListName && t.listId !== 'default' ? listById.get(t.listId) : undefined}
      onToggle={toggle(t)}
      onPress={() => setEditorTask(t)}
      onReschedule={() => setRescheduleTask(t)}
    />
  );

  return (
    <Screen withTabBar={false}>
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm, marginLeft: -Spacing.sm }}>
            <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
          </PressableScale>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Sortieren nur in echten Listen mit ≥ 2 offenen Aufgaben (Smart-Views
                haben eine feste chronologische Ordnung). */}
            {list && open.length > 1 && (
              <PressableScale accessibilityLabel="Reihenfolge sortieren" onPress={() => setReordering(true)} style={{ padding: Spacing.sm }}>
                <ArrowUpDown size={18} color={colors.text3} strokeWidth={2} />
              </PressableScale>
            )}
            {list && (
              <PressableScale accessibilityLabel="Liste bearbeiten" onPress={() => setEditList(true)} style={{ padding: Spacing.sm }}>
                <Pencil size={18} color={colors.text3} strokeWidth={2} />
              </PressableScale>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
          {ListIcon && list && <ListIcon size={26} color={list.color} strokeWidth={2.2} />}
          <Type variant="title">{title}</Type>
        </View>
        <Type variant="caption" tone="text3" style={{ marginTop: 2 }} tabular>
          {open.length === 1 ? '1 offene Aufgabe' : `${open.length} offene Aufgaben`}
        </Type>

        {/* Projekt-Block: Ziel, Fortschritt, Deadline (nur bei Ziel/Deadline). */}
        {isProject && list && (
          <View style={{ marginTop: Spacing.md, gap: Spacing.xs }}>
            {list.goal && <Type variant="body" tone="text2">{list.goal}</Type>}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Type variant="caption" tone="text3" tabular>
                {progress.total > 0 ? `${progress.done}/${progress.total} · ${Math.round(progress.ratio * 100)} %` : 'Noch keine Aufgaben'}
              </Type>
              {list.deadline && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CalendarClock size={13} color={deadlineOverdue ? colors.indigo : colors.text3} strokeWidth={2} />
                  <Type variant="caption" tone={deadlineOverdue ? 'indigo' : 'text3'}>
                    {progress.ratio >= 1 && progress.total > 0 ? 'Abgeschlossen' : deadlineLabel(list.deadline, today)}
                  </Type>
                </View>
              )}
            </View>
            {progress.total > 0 && (
              <View style={{ height: 4, borderRadius: 999, backgroundColor: colors.chip, overflow: 'hidden' }}>
                <View style={{ height: 4, width: `${Math.max(4, Math.round(progress.ratio * 100))}%`, backgroundColor: list.color, borderRadius: 999 }} />
              </View>
            )}
          </View>
        )}
      </Reveal>

      <Reveal delay={90}>
        <GlassPanel>
          {open.length === 0 ? (
            <EmptyState title="Nichts offen" body="Alles erledigt — oder noch nichts geplant." />
          ) : id === 'geplant' ? (
            plannedGroups.map((g, gi) => (
              <View key={g.key}>
                {gi > 0 && <Seam marginVertical={Spacing.md} />}
                <Type variant="eyebrow" tone={g.key === 'heute' ? 'teal' : 'text3'}>{g.title}</Type>
                <View style={{ marginTop: Spacing.xs }}>{g.tasks.map((t) => renderRow(t, true))}</View>
              </View>
            ))
          ) : (
            <View>{open.map((t) => renderRow(t, isSmartView))}</View>
          )}

          {/* Erledigt — einklappbar, automatisch nur die letzten 30 Tage. */}
          {completed.length > 0 && (
            <>
              <Seam marginVertical={Spacing.md} />
              <PressableScale
                accessibilityLabel={showCompleted ? 'Erledigte ausblenden' : 'Erledigte anzeigen'}
                onPress={() => {
                  hapticSelect();
                  setShowCompleted((v) => !v);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Type variant="eyebrow" tone="text3">Erledigt · {completed.length}</Type>
                {showCompleted ? (
                  <ChevronDown size={16} color={colors.text3} strokeWidth={2} />
                ) : (
                  <ChevronRight size={16} color={colors.text3} strokeWidth={2} />
                )}
              </PressableScale>
              {showCompleted && <View style={{ marginTop: Spacing.xs }}>{completed.map((t) => renderRow(t, isSmartView))}</View>}
            </>
          )}
        </GlassPanel>
      </Reveal>

      <Reveal delay={150}>
        <GlassButton accessibilityLabel="Neue Aufgabe" onPress={() => setEditorTask(null)}>
          <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
          <Type variant="label" style={{ color: '#FFFFFF' }}>Neue Aufgabe</Type>
        </GlassButton>
      </Reveal>

      {editorTask !== undefined && (
        <TaskEditorSheet
          task={editorTask}
          defaultListId={list?.id}
          defaultDueDate={id === 'geplant' ? today : null}
          onClose={() => setEditorTask(undefined)}
        />
      )}
      {rescheduleTask && <RescheduleSheet task={rescheduleTask} onClose={() => setRescheduleTask(null)} />}
      {editList && list && <ListEditorSheet list={list} onClose={() => setEditList(false)} />}
      {reordering && <ReorderSheet tasks={open} onClose={() => setReordering(false)} />}
    </Screen>
  );
}
