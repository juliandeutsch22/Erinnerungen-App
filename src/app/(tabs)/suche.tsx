// suche.tsx — Suche über alles (Fahrplan §3.7): Aufgaben (Titel + Notiz,
// offen wie erledigt), Listen und Notizen. Live-Filter, Treffer öffnen den Editor.
import { useRouter } from 'expo-router';
import { NotebookPen, Search } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { GlassPanel } from '@/components/GlassPanel';
import { Highlighted } from '@/components/Highlighted';
import { listIcon } from '@/components/listMeta';
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
import { useNotes } from '@/data/noteQueries';
import { useCompleteTask, useLists, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { todayStr } from '@/lib/dates';
import { noteMatchLine, noteTitle } from '@/lib/noteLogic';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Shadow, Spacing, T } from '@/theme/theme.tokens';

export default function SucheScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const { data: notes } = useNotes();
  const complete = useCompleteTask();
  const reopen = useReopenTask();

  const [query, setQuery] = useState('');
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [quickTask, setQuickTask] = useState<Task | null>(null);

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

  const noteHits = useMemo(() => {
    if (!q) return [];
    return (notes ?? []).filter((n) => n.deletedAt === null && n.body.toLowerCase().includes(q)).slice(0, 30);
  }, [notes, q]);

  const toggle = (task: Task) => (next: boolean) => {
    if (next) complete.mutate(task);
    else reopen.mutate(task.id);
  };

  return (
    // Tastatur-Insets: lange Trefferlisten bleiben bei offener Tastatur scrollbar.
    <Screen automaticallyAdjustKeyboardInsets>
      <Reveal>
        <View style={{ gap: Spacing.xs }}>
          <Type variant="title">Suche</Type>
          {/* Ruhige Zähl-Zeile — dieselbe Stimme wie die Tages-Bilanz auf Heute. */}
          <Type variant="caption" tone="text3" tabular>
            {(() => {
              const noteCount = (notes ?? []).filter((n) => n.deletedAt === null).length;
              return `${(tasks ?? []).length} ${(tasks ?? []).length === 1 ? 'Aufgabe' : 'Aufgaben'} · ${(lists ?? []).length} ${(lists ?? []).length === 1 ? 'Liste' : 'Listen'} · ${noteCount} ${noteCount === 1 ? 'Notiz' : 'Notizen'} durchsuchbar`;
            })()}
          </Type>
        </View>
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
            {taskHits.length === 0 && listHits.length === 0 && noteHits.length === 0 ? (
              <EmptyState
                icon={<Search size={20} color={colors.teal} strokeWidth={2} />}
                title="Keine Treffer"
                body={`Nichts zu „${query.trim()}" gefunden.`}
              />
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
                    {taskHits.length > 0 && <Seam variant="ornament" marginVertical={Spacing.md} />}
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
                          highlight={q}
                          onToggle={toggle(t)}
                          onPress={() => setEditorTask(t)}
                          onReschedule={() => setRescheduleTask(t)}
                          onLongPress={() => setQuickTask(t)}
                        />
                      ))}
                    </View>
                  </>
                )}
                {noteHits.length > 0 && (
                  <>
                    {(taskHits.length > 0 || listHits.length > 0) && <Seam marginVertical={Spacing.md} />}
                    <Type variant="eyebrow" tone="text3">Notizen</Type>
                    <View style={{ marginTop: Spacing.xs }}>
                      {noteHits.map((n) => {
                        // Die Zeile mit dem Treffer zeigen — nicht stur die Vorschau.
                        const matchLine = noteMatchLine(n.body, q);
                        return (
                          <PressableScale
                            key={n.id}
                            accessibilityLabel={`Notiz ${noteTitle(n.body)} öffnen`}
                            onPress={() => router.push(`/notiz/${n.id}`)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 }}
                          >
                            <NotebookPen size={18} color={colors.text3} strokeWidth={2} />
                            <View style={{ flex: 1, gap: 1 }}>
                              <Type variant="body" numberOfLines={1}>
                                <Highlighted text={noteTitle(n.body)} query={q} />
                              </Type>
                              {!!matchLine && (
                                <Type variant="caption" tone="text3" numberOfLines={1}>
                                  <Highlighted text={matchLine} query={q} />
                                </Type>
                              )}
                            </View>
                          </PressableScale>
                        );
                      })}
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
      {quickTask && <TaskQuickSheet task={quickTask} onClose={() => setQuickTask(null)} />}
    </Screen>
  );
}
