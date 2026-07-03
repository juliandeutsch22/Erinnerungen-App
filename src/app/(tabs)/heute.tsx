// heute.tsx — Startscreen (Fahrplan §4): Datum-Eyebrow + Begrüßung; darunter
// überfällig (Indigo, ruhig) → heute mit Uhrzeit → heute ohne Uhrzeit auf
// EINER Glass-Fläche mit Seams. Abhaken = Teal-Puls + Haptik.
import { useRouter } from 'expo-router';
import { Plus, Settings } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { GlassButton } from '@/components/GlassButton';
import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState, LoadingState } from '@/components/StateView';
import { TaskEditorSheet } from '@/components/TaskEditorSheet';
import { TaskRow } from '@/components/TaskRow';
import { Type } from '@/components/Type';
import { useCompleteTask, useLists, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { todayStr } from '@/lib/dates';
import { groupToday } from '@/lib/taskLogic';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export default function HeuteScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: tasks, isLoading } = useTasks();
  const { data: lists } = useLists();
  const complete = useCompleteTask();
  const reopen = useReopenTask();

  // undefined = Editor zu, null = neue Aufgabe, Task = bearbeiten.
  const [editorTask, setEditorTask] = useState<Task | null | undefined>(undefined);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);

  const today = todayStr();
  const groups = useMemo(() => groupToday(tasks ?? [], today), [tasks, today]);
  const listById = useMemo(() => new Map((lists ?? []).map((l) => [l.id, l])), [lists]);
  const total = groups.overdue.length + groups.timed.length + groups.untimed.length;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 5 ? 'Gute Nacht' : hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
  const dateLine = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  const toggle = (task: Task) => (next: boolean) => {
    if (next) complete.mutate(task);
    else reopen.mutate(task.id);
  };

  const renderRows = (items: Task[]) =>
    items.map((t) => (
      <TaskRow
        key={t.id}
        task={t}
        today={today}
        list={t.listId !== 'default' ? listById.get(t.listId) : undefined}
        onToggle={toggle(t)}
        onPress={() => setEditorTask(t)}
        onReschedule={() => setRescheduleTask(t)}
      />
    ));

  return (
    <Screen>
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: Spacing.xs }}>
            <Type variant="eyebrow" tone="text3">{dateLine}</Type>
            <Type variant="title">{greeting}</Type>
          </View>
          <PressableScale
            accessibilityLabel="Einstellungen öffnen"
            onPress={() => router.push('/einstellungen')}
            style={{ padding: Spacing.sm }}
          >
            <Settings size={21} color={colors.text3} strokeWidth={2} />
          </PressableScale>
        </View>
      </Reveal>

      <Reveal delay={90}>
        <GlassPanel>
          {isLoading && total === 0 ? (
            <LoadingState />
          ) : total === 0 ? (
            <EmptyState title="Nichts für heute" body="Kopf frei. Neues landet über das Plus — oder du genießt die Stille." />
          ) : (
            <>
              {groups.overdue.length > 0 && (
                <>
                  <Type variant="eyebrow" tone="indigo">Überfällig</Type>
                  <View style={{ marginTop: Spacing.xs }}>{renderRows(groups.overdue)}</View>
                  {(groups.timed.length > 0 || groups.untimed.length > 0) && <Seam marginVertical={Spacing.md} />}
                </>
              )}
              {groups.timed.length > 0 && (
                <>
                  <Type variant="eyebrow" tone="text3">Heute</Type>
                  <View style={{ marginTop: Spacing.xs }}>{renderRows(groups.timed)}</View>
                  {groups.untimed.length > 0 && <Seam marginVertical={Spacing.md} />}
                </>
              )}
              {groups.untimed.length > 0 && (
                <>
                  <Type variant="eyebrow" tone="text3">Ohne Uhrzeit</Type>
                  <View style={{ marginTop: Spacing.xs }}>{renderRows(groups.untimed)}</View>
                </>
              )}
            </>
          )}
        </GlassPanel>
      </Reveal>

      <Reveal delay={160}>
        <GlassButton accessibilityLabel="Neue Aufgabe" onPress={() => setEditorTask(null)}>
          <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
          <Type variant="label" style={{ color: '#FFFFFF' }}>Neue Aufgabe</Type>
        </GlassButton>
      </Reveal>

      {editorTask !== undefined && (
        <TaskEditorSheet task={editorTask} defaultDueDate={today} onClose={() => setEditorTask(undefined)} />
      )}
      {rescheduleTask && <RescheduleSheet task={rescheduleTask} onClose={() => setRescheduleTask(null)} />}
    </Screen>
  );
}
