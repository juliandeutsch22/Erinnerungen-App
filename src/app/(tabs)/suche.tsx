// suche.tsx — Suche über alles (Fahrplan §3.7): Aufgaben (Titel + Notiz,
// offen wie erledigt), Listen, Notizen, Dokumente, Chats und Abendbetrachtung.
// Live-Filter, Treffer öffnen den Editor. Bereichs-Chips grenzen die Suche ein;
// ohne Eingabe zeigt die Seite die zuletzt gesuchten Begriffe.
import { useRouter } from 'expo-router';
import { FileText, History, MoonStar, NotebookPen, Search, Sparkles } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
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
import { useAllChatMessages, useChats } from '@/data/chatQueries';
import { useDocuments } from '@/data/documentQueries';
import { useJournal } from '@/data/journalQueries';
import { useNotes } from '@/data/noteQueries';
import { useCompleteTask, useLists, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { formatDueDate, toDateStr, todayStr } from '@/lib/dates';
import { openDocument } from '@/lib/documents';
import { hapticSelect } from '@/lib/haptics';
import { noteMatchLine, noteTitle } from '@/lib/noteLogic';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { useSettings } from '@/theme/settings.store';
import { Shadow, Spacing, T } from '@/theme/theme.tokens';

/** Bereichs-Filter: „Alle" oder genau ein Bereich. */
type Scope = 'alle' | 'aufgaben' | 'listen' | 'notizen' | 'dokumente' | 'chats' | 'abend';
const SCOPES: { value: Scope; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'aufgaben', label: 'Aufgaben' },
  { value: 'listen', label: 'Listen' },
  { value: 'notizen', label: 'Notizen' },
  { value: 'dokumente', label: 'Dokumente' },
  { value: 'chats', label: 'Chats' },
  { value: 'abend', label: 'Abendbetrachtung' },
];

export default function SucheScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const { data: notes } = useNotes();
  const complete = useCompleteTask();
  const reopen = useReopenTask();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('alle');
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [quickTask, setQuickTask] = useState<Task | null>(null);

  const recentSearches = useSettings((s) => s.recentSearches);
  const addRecentSearch = useSettings((s) => s.addRecentSearch);
  const clearRecentSearches = useSettings((s) => s.clearRecentSearches);
  /** Beim Öffnen eines Treffers den Begriff still in „Zuletzt gesucht" merken. */
  const remember = () => addRecentSearch(query);

  const today = todayStr();
  const listById = useMemo(() => new Map((lists ?? []).map((l) => [l.id, l])), [lists]);
  const q = query.trim().toLowerCase();
  const inScope = (s: Scope) => scope === 'alle' || scope === s;

  const taskHits = useMemo(() => {
    if (!q || !inScope('aufgaben')) return [];
    return (tasks ?? [])
      .filter((t) => t.title.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q))
      .sort((a, b) => Number(a.completedAt !== null) - Number(b.completedAt !== null))
      .slice(0, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, q, scope]);

  const listHits = useMemo(() => {
    if (!q || !inScope('listen')) return [];
    return (lists ?? []).filter((l) => l.name.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, q, scope]);

  const noteHits = useMemo(() => {
    if (!q || !inScope('notizen')) return [];
    return (notes ?? []).filter((n) => n.deletedAt === null && n.body.toLowerCase().includes(q)).slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, q, scope]);

  // Dokumente: Dateinamen durchsuchbar, Tippen öffnet die iOS-Vorschau.
  const { data: docs } = useDocuments();
  const docHits = useMemo(() => {
    if (!q || !inScope('dokumente')) return [];
    return (docs ?? []).filter((d) => d.name.toLowerCase().includes(q)).slice(0, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, q, scope]);

  const { data: journalEntries } = useJournal();
  const journalHits = useMemo(() => {
    if (!q || !inScope('abend')) return [];
    return (journalEntries ?? []).filter((e) => e.text.toLowerCase().includes(q)).slice(0, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalEntries, q, scope]);

  const { data: chats } = useChats();
  const { data: allChatMessages } = useAllChatMessages();
  const chatHits = useMemo(() => {
    if (!q || !inScope('chats')) return [];
    const matchingChatIds = new Set(
      (allChatMessages ?? []).filter((m) => m.content.toLowerCase().includes(q)).map((m) => m.chatId),
    );
    return (chats ?? [])
      .filter((c) => c.deletedAt === null && (c.title.toLowerCase().includes(q) || matchingChatIds.has(c.id)))
      .slice(0, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, allChatMessages, q, scope]);

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
            returnKeyType="search"
            onSubmitEditing={() => addRecentSearch(query)}
            accessibilityLabel="Suchbegriff"
            style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: 2 }, webNoOutline]}
          />
        </Glass>
      </Reveal>

      {/* Bereichs-Chips: „Alle" oder ein Bereich — nochmal tippen hebt auf. */}
      <Reveal delay={75}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
          {SCOPES.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              active={scope === s.value}
              onPress={() => {
                hapticSelect();
                setScope(scope === s.value && s.value !== 'alle' ? 'alle' : s.value);
              }}
            />
          ))}
        </ScrollView>
      </Reveal>

      {/* Ohne Eingabe: die zuletzt gesuchten Begriffe — oder eine stille Einladung. */}
      {q.length === 0 && (
        <Reveal delay={90}>
          <GlassPanel>
            {recentSearches.length > 0 ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Type variant="eyebrow" tone="text3">Zuletzt gesucht</Type>
                  <PressableScale
                    accessibilityLabel="Zuletzt gesuchte Begriffe löschen"
                    onPress={() => {
                      hapticSelect();
                      clearRecentSearches();
                    }}
                  >
                    <Type variant="caption" tone="text3">Löschen</Type>
                  </PressableScale>
                </View>
                <View style={{ marginTop: Spacing.xs }}>
                  {recentSearches.map((r) => (
                    <PressableScale
                      key={r}
                      accessibilityLabel={`Nach „${r}" suchen`}
                      onPress={() => setQuery(r)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 }}
                    >
                      <History size={16} color={colors.text3} strokeWidth={2} />
                      <Type variant="body" tone="text2">{r}</Type>
                    </PressableScale>
                  ))}
                </View>
              </>
            ) : (
              <EmptyState
                icon={<Search size={20} color={colors.teal} strokeWidth={2} />}
                title="Alles auffindbar"
                body="Ein Begriff genügt — durchsucht werden Aufgaben, Listen, Notizen, Dokumente, Chats und die Abendbetrachtung."
              />
            )}
          </GlassPanel>
        </Reveal>
      )}

      {q.length > 0 && (
        <Reveal delay={90}>
          <GlassPanel>
            {taskHits.length === 0 && listHits.length === 0 && noteHits.length === 0 && chatHits.length === 0 && journalHits.length === 0 && docHits.length === 0 ? (
              <EmptyState
                icon={<Search size={20} color={colors.teal} strokeWidth={2} />}
                title="Keine Treffer"
                body={
                  scope === 'alle'
                    ? `Nichts zu „${query.trim()}" gefunden.`
                    : `Nichts zu „${query.trim()}" in diesem Bereich — „Alle" sucht überall.`
                }
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
                            onPress={() => {
                              remember();
                              router.push(`/liste/${l.id}`);
                            }}
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
                          onPress={() => {
                            remember();
                            setEditorTask(t);
                          }}
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
                            onPress={() => {
                              remember();
                              router.push(`/notiz/${n.id}`);
                            }}
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
                {docHits.length > 0 && (
                  <>
                    {(taskHits.length > 0 || listHits.length > 0 || noteHits.length > 0) && <Seam marginVertical={Spacing.md} />}
                    <Type variant="eyebrow" tone="text3">Dokumente</Type>
                    <View style={{ marginTop: Spacing.xs }}>
                      {docHits.map((d) => (
                        <PressableScale
                          key={d.id}
                          accessibilityLabel={`Dokument ${d.name} öffnen`}
                          onPress={() => {
                            remember();
                            void openDocument(d.uri);
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 }}
                        >
                          <FileText size={18} color={colors.text3} strokeWidth={2} />
                          <Type variant="body" numberOfLines={1} style={{ flex: 1 }}>
                            <Highlighted text={d.name} query={q} />
                          </Type>
                        </PressableScale>
                      ))}
                    </View>
                  </>
                )}
                {chatHits.length > 0 && (
                  <>
                    {(taskHits.length > 0 || listHits.length > 0 || noteHits.length > 0 || docHits.length > 0) && <Seam marginVertical={Spacing.md} />}
                    <Type variant="eyebrow" tone="text3">Chats</Type>
                    <View style={{ marginTop: Spacing.xs }}>
                      {chatHits.map((c) => (
                        <PressableScale
                          key={c.id}
                          accessibilityLabel={`Chat ${c.title} öffnen`}
                          onPress={() => {
                            remember();
                            router.push(`/chat/${c.id}`);
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 }}
                        >
                          <Sparkles size={18} color={colors.text3} strokeWidth={2} />
                          <View style={{ flex: 1, gap: 1 }}>
                            <Type variant="body" numberOfLines={1}>
                              <Highlighted text={c.title} query={q} />
                            </Type>
                            <Type variant="caption" tone="text3" tabular>
                              {formatDueDate(toDateStr(new Date(c.updatedAt)), today)}
                            </Type>
                          </View>
                        </PressableScale>
                      ))}
                    </View>
                  </>
                )}
                {journalHits.length > 0 && (
                  <>
                    {(taskHits.length > 0 || listHits.length > 0 || noteHits.length > 0 || chatHits.length > 0 || docHits.length > 0) && <Seam marginVertical={Spacing.md} />}
                    <Type variant="eyebrow" tone="text3">Abendbetrachtung</Type>
                    <View style={{ marginTop: Spacing.xs }}>
                      {journalHits.map((e) => {
                        // Journal-Einträge haben keine Titel-Zeile — schlicht die
                        // Zeile mit dem Treffer zeigen (gekürzt).
                        const raw = e.text.split('\n').find((l) => l.toLowerCase().includes(q))?.trim() ?? e.text.trim();
                        const line = raw.length > 120 ? `${raw.slice(0, 119)}…` : raw;
                        return (
                          <PressableScale
                            key={e.id}
                            accessibilityLabel={`Betrachtung vom ${e.date} öffnen`}
                            onPress={() => {
                              remember();
                              router.push('/journal');
                            }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 }}
                          >
                            <MoonStar size={18} color={colors.text3} strokeWidth={2} />
                            <View style={{ flex: 1, gap: 1 }}>
                              <Type variant="body" numberOfLines={1}>{formatDueDate(e.date, today)}</Type>
                              <Type variant="caption" tone="text3" numberOfLines={1}>
                                <Highlighted text={line} query={q} />
                              </Type>
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
