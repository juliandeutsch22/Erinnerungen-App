// suche.tsx — Suche über alles (Fahrplan §3.7): Aufgaben (Titel + Notiz,
// offen wie erledigt) und Listen. Live-Filter, Treffer öffnen den Editor.
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { GlassPanel } from '@/components/GlassPanel';
import { listIcon } from '@/components/listMeta';
import { PressableScale } from '@/components/PressableScale';
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
import { todayStr } from '@/lib/dates';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Shadow, Spacing, T } from '@/theme/theme.tokens';

export default function SucheScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const complete = useCompleteTask();
  const reopen = useReopenTask();

  const [query, setQuery] = useState('');
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);

  const today = todayStr();
  const listById = useMemo(() => new Map((lists ?? []).map((l) => [l.id, l])), [lists]);
  const q = query.trim().toLowerCase();

  const taskHits = useMemo(() => {
    if (!q) return [];
    return (tasks ?? [])
      .filter((t) => t.title.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q))
      .sort((a, b) => Number(a.completedAt !== null) - Number(b.completedAt !== null))
      .slice(0, 50);
  }, [tasks, q]);

  const listHits = useMemo(() => {
    if (!q) return [];
    return (lists ?? []).filter((l) => l.name.toLowerCase().includes(q));
  }, [lists, q]);

  const toggle = (task: Task) => (next: boolean) => {
    if (next) complete.mutate(task);
    else reopen.mutate(task.id);
  };

  return (
    <Screen>
      <Reveal>
        <Type variant="title">Suche</Type>
      </Reveal>

      <Reveal delay={60}>
        <Glass
          variant="pill"
          style={Shadow.sm}
          contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md }}
        >
          <Search size={17} color={colors.text3} strokeWidth={2.2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Aufgaben, Notizen, Listen…"
            placeholderTextColor={colors.text3}
            autoCorrect={false}
            accessibilityLabel="Suchbegriff"
            style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: 2 }, webNoOutline]}
          />
        </Glass>
      </Reveal>

      {q.length > 0 && (
        <Reveal delay={90}>
          <GlassPanel>
            {taskHits.length === 0 && listHits.length === 0 ? (
              <EmptyState title="Keine Treffer" body={`Nichts zu „${query.trim()}" gefunden.`} />
            ) : (
              <>
                {listHits.length > 0 && (
                  <>
                    <Type variant="eyebrow" tone="text3">Listen</Type>
                    <View style={{ marginTop: Spacing.xs }}>
                      {listHits.map((l) => {
                        const Icon = listIcon(l.icon);
                        return (
                          <PressableScale
                            key={l.id}
                            accessibilityLabel={`Liste ${l.name} öffnen`}
                            onPress={() => router.push(`/liste/${l.id}`)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 }}
                          >
                            <Icon size={18} color={l.color} strokeWidth={2} />
                            <Type variant="body">{l.name}</Type>
                          </PressableScale>
                        );
                      })}
                    </View>
                    {taskHits.length > 0 && <Seam marginVertical={Spacing.md} />}
                  </>
                )}
                {taskHits.length > 0 && (
                  <>
                    <Type variant="eyebrow" tone="text3">Aufgaben</Type>
                    <View style={{ marginTop: Spacing.xs }}>
                      {taskHits.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          today={today}
                          list={t.listId !== 'default' ? listById.get(t.listId) : undefined}
                          onToggle={toggle(t)}
                          onPress={() => setEditorTask(t)}
                          onReschedule={() => setRescheduleTask(t)}
                        />
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </GlassPanel>
        </Reveal>
      )}

      {editorTask && <TaskEditorSheet task={editorTask} onClose={() => setEditorTask(null)} />}
      {rescheduleTask && <RescheduleSheet task={rescheduleTask} onClose={() => setRescheduleTask(null)} />}
    </Screen>
  );
}
