// liste/warten.tsx — „Warten auf": alles, was gerade bei jemand anderem liegt.
//
// Ein eigener Bildschirm statt eines fünften Tabs: man schaut hier selten
// hinein, aber wenn, dann gezielt. Gruppiert nach Mensch — denn die Frage
// lautet fast nie „was wartet?", sondern „was liegt bei Anna?".
//
// Ausdrücklich OHNE Dauer-Anzeige („seit zwölf Tagen"). Das wäre ein
// Schuld-Zähler für etwas, das man gar nicht in der Hand hat.
import { useRouter } from 'expo-router';
import { ChevronLeft, PauseCircle } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState } from '@/components/StateView';
import { TaskEditorSheet } from '@/components/TaskEditorSheet';
import { TaskQuickSheet } from '@/components/TaskQuickSheet';
import { TaskRow } from '@/components/TaskRow';
import { Type } from '@/components/Type';
import { usePeople } from '@/data/personQueries';
import { useCompleteTask, useLists, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { todayStr } from '@/lib/dates';
import { waitingTasks } from '@/lib/taskLogic';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

/** Ohne Menschen bleibt eine Gruppe übrig: „Sonst". */
const OHNE = '__ohne__';

export default function WartenScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = todayStr();
  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const { data: people } = usePeople();
  const complete = useCompleteTask();
  const reopen = useReopenTask();

  const [editorTask, setEditorTask] = useState<Task | null | undefined>(undefined);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [quickTask, setQuickTask] = useState<Task | null>(null);

  const listById = useMemo(() => new Map((lists ?? []).map((l) => [l.id, l])), [lists]);
  const wartend = useMemo(() => waitingTasks(tasks ?? []), [tasks]);

  // Nach Mensch gruppiert; Namenlose ans Ende.
  const gruppen = useMemo(() => {
    const namen = new Map((people ?? []).map((p) => [p.id, p.name]));
    const map = new Map<string, Task[]>();
    for (const t of wartend) {
      const key = t.personId && namen.has(t.personId) ? t.personId : OHNE;
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return [...map.entries()]
      .map(([key, ts]) => ({ key, titel: key === OHNE ? 'Ohne Menschen' : (namen.get(key) ?? 'Mensch'), tasks: ts }))
      .sort((a, b) => (a.key === OHNE ? 1 : b.key === OHNE ? -1 : a.titel.localeCompare(b.titel, 'de')));
  }, [wartend, people]);

  const toggle = (task: Task) => (next: boolean) => {
    if (next) complete.mutate(task);
    else reopen.mutate(task.id);
  };

  return (
    <Screen withTabBar={false} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
      <Reveal>
        <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm, marginLeft: -Spacing.sm, alignSelf: 'flex-start' }}>
          <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
        </PressableScale>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
          <PauseCircle size={24} color={colors.teal} strokeWidth={2.2} />
          <Type variant="title">Warten auf</Type>
        </View>
        <Type variant="caption" tone="text3" style={{ marginTop: 2 }} tabular>
          {wartend.length === 1 ? '1 Sache liegt bei anderen' : `${wartend.length} Sachen liegen bei anderen`}
        </Type>
      </Reveal>

      <Reveal delay={90}>
        <GlassPanel>
          {gruppen.length === 0 ? (
            <EmptyState
              icon={<PauseCircle size={20} color={colors.teal} strokeWidth={2} />}
              title="Nichts liegt bei anderen"
              body={'Wenn etwas bei jemandem liegt, markiere es in der Aufgabe als „Warten auf" — es verschwindet dann aus Heute, ohne verloren zu gehen.'}
            />
          ) : (
            gruppen.map((g, gi) => (
              <View key={g.key}>
                {gi > 0 && <Seam marginVertical={Spacing.md} />}
                <PressableScale
                  accessibilityLabel={g.key === OHNE ? 'Ohne Menschen' : `Alles zu ${g.titel} ansehen`}
                  onPress={() => {
                    if (g.key !== OHNE) router.push(`/person/${g.key}`);
                  }}
                  pressedScale={g.key === OHNE ? 1 : 0.99}
                >
                  <Type variant="eyebrow" tone={g.key === OHNE ? 'text3' : 'teal'}>
                    {g.titel} · {g.tasks.length}
                  </Type>
                </PressableScale>
                <View style={{ marginTop: Spacing.xs }}>
                  {g.tasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      today={today}
                      list={t.listId !== 'default' ? listById.get(t.listId) : undefined}
                      onToggle={toggle(t)}
                      onPress={() => setEditorTask(t)}
                      onReschedule={() => setRescheduleTask(t)}
                      onLongPress={() => setQuickTask(t)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </GlassPanel>
      </Reveal>

      {editorTask !== undefined && <TaskEditorSheet task={editorTask} onClose={() => setEditorTask(undefined)} />}
      {rescheduleTask && <RescheduleSheet task={rescheduleTask} onClose={() => setRescheduleTask(null)} />}
      {quickTask && (
        <TaskQuickSheet task={quickTask} onClose={() => setQuickTask(null)} onReschedule={() => setRescheduleTask(quickTask)} />
      )}
    </Screen>
  );
}
