// listen.tsx — Grid aus Glass-Karten (Icon, Name, offene Anzahl); Tap = Liste,
// Long-Press = bearbeiten; „+ Neue Liste" als gestrichelte Geister-Karte.
// Darüber die Smart-Ansichten Geplant / Alle (Fahrplan §3.3).
import { useRouter } from 'expo-router';
import { CalendarClock, CalendarDays, Filter as FilterIcon, Layers, Plus, SlidersHorizontal } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { DisclosureChevron } from '@/components/DisclosureChevron';
import { Glass } from '@/components/Glass';
import { GlassPanel } from '@/components/GlassPanel';
import { ListEditorSheet } from '@/components/ListEditorSheet';
import { listIcon } from '@/components/listMeta';
import { PressableScale } from '@/components/PressableScale';
import { ProgressLine } from '@/components/ProgressLine';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { SwipeActionSlide } from '@/components/SwipeActionSlide';
import { Type } from '@/components/Type';
import {
  useDeleteListForever,
  useDeleteTaskForever,
  useLists,
  useRestoreList,
  useRestoreTask,
  useTasks,
  useTrashedLists,
  useTrashedTasks,
} from '@/data/queries';
import type { List, Task } from '@/data/types';
import { applyFilter } from '@/lib/taskFilters';
import { addDays, deadlineLabel, formatDueDate, toDateStr, todayStr } from '@/lib/dates';
import { isOpen, listProgress } from '@/lib/taskLogic';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { useSettings } from '@/theme/settings.store';
import { useColors } from '@/theme/ThemeProvider';
import { R, Shadow, Spacing, T } from '@/theme/theme.tokens';

export default function ListenScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: lists } = useLists();
  const { data: tasks } = useTasks();

  // undefined = Sheet zu, null = neue Liste, List = bearbeiten.
  const [editorList, setEditorList] = useState<List | null | undefined>(undefined);
  const savedFilters = useSettings((s) => s.savedFilters);
  const today = todayStr();

  const openByList = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks ?? []) {
      if (isOpen(t)) map.set(t.listId, (map.get(t.listId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);
  const progressByList = useMemo(() => {
    const byList = new Map<string, Task[]>();
    for (const t of tasks ?? []) {
      const arr = byList.get(t.listId) ?? [];
      arr.push(t);
      byList.set(t.listId, arr);
    }
    const map = new Map<string, { done: number; total: number; ratio: number }>();
    for (const [id, arr] of byList) map.set(id, listProgress(arr));
    return map;
  }, [tasks]);
  const openTotal = useMemo(() => (tasks ?? []).filter(isOpen).length, [tasks]);
  const openPlanned = useMemo(() => (tasks ?? []).filter((t) => isOpen(t) && t.dueDate !== null).length, [tasks]);

  return (
    <Screen>
      <Reveal>
        <View style={{ gap: Spacing.xs }}>
          <Type variant="title">Listen</Type>
          {/* Ruhige Zähl-Zeile — dieselbe Stimme wie die Tages-Bilanz auf Heute. */}
          <Type variant="caption" tone="text3" tabular>
            {openTotal === 1 ? '1 offene Aufgabe' : `${openTotal} offene Aufgaben`}
            {` · ${(lists ?? []).length} ${(lists ?? []).length === 1 ? 'Liste' : 'Listen'}`}
          </Type>
        </View>
      </Reveal>

      {/* Smart-Ansichten */}
      <Reveal delay={60}>
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <SmartCard
            title="Geplant"
            count={openPlanned}
            icon={<CalendarDays size={20} color={colors.teal} strokeWidth={2} />}
            onPress={() => router.push('/liste/geplant')}
          />
          <SmartCard
            title="Alle"
            count={openTotal}
            icon={<Layers size={20} color={colors.indigo} strokeWidth={2} />}
            onPress={() => router.push('/liste/alle')}
          />
        </View>
      </Reveal>

      {/* Filter — gespeicherte Smart-Ansichten + neuer Filter. */}
      <Reveal delay={90}>
        <View style={{ gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Type variant="eyebrow" tone="text3">Filter</Type>
            <PressableScale accessibilityLabel="Neuer Filter" onPress={() => router.push('/filter')} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.xs }}>
              <SlidersHorizontal size={14} color={colors.teal} strokeWidth={2} />
              <Type variant="label" tone="teal">Neuer Filter</Type>
            </PressableScale>
          </View>
          {savedFilters.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
              {savedFilters.map((f) => {
                const count = applyFilter(tasks ?? [], f, today).length;
                return (
                  <PressableScale
                    key={f.id}
                    accessibilityLabel={`Filter ${f.name} öffnen`}
                    onPress={() => router.push(`/filter?id=${f.id}`)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: R.pill, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.chipBorder }}
                  >
                    <FilterIcon size={13} color={colors.teal} strokeWidth={2} />
                    <Type variant="label">{f.name}</Type>
                    <Type variant="caption" tone="text3" tabular>{count}</Type>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </View>
      </Reveal>

      {/* Listen-Grid */}
      <Reveal delay={120}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }}>
          {(lists ?? []).map((l) => {
            const Icon = listIcon(l.icon);
            const isProject = !!(l.goal || l.deadline);
            const prog = progressByList.get(l.id);
            const deadlineOverdue = !!l.deadline && l.deadline < today && (prog?.ratio ?? 0) < 1;
            return (
              <PressableScale
                key={l.id}
                accessibilityLabel={`Liste ${l.name} öffnen`}
                onPress={() => router.push(`/liste/${l.id}`)}
                onLongPress={() => {
                  hapticSelect();
                  setEditorList(l);
                }}
                style={{ width: '47%', flexGrow: 1 }}
              >
                <Glass variant="card" radius={R.xl} style={Shadow.md} contentStyle={{ padding: Spacing.md, gap: Spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: R.md,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: `${l.color}1F`,
                      }}
                    >
                      <Icon size={19} color={l.color} strokeWidth={2} />
                    </View>
                    <Type variant="heading" tabular tone="text2">{openByList.get(l.id) ?? 0}</Type>
                  </View>
                  <Type variant="label" numberOfLines={1}>{l.name}</Type>
                  {/* Projekt: dünne Fortschrittslinie + Deadline-Hinweis. */}
                  {isProject && (
                    <View style={{ gap: 4 }}>
                      {prog && prog.total > 0 && <ProgressLine ratio={prog.ratio} color={l.color} />}
                      {l.deadline && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <CalendarClock size={11} color={deadlineOverdue ? colors.indigo : colors.text3} strokeWidth={2} />
                          <Type variant="caption" tone={deadlineOverdue ? 'indigo' : 'text3'} numberOfLines={1}>
                            {(prog?.ratio ?? 0) >= 1 && (prog?.total ?? 0) > 0 ? 'Abgeschlossen' : deadlineLabel(l.deadline, today)}
                          </Type>
                        </View>
                      )}
                    </View>
                  )}
                </Glass>
              </PressableScale>
            );
          })}

          {/* Geister-Karte: Neue Liste */}
          <PressableScale
            accessibilityLabel="Neue Liste anlegen"
            onPress={() => setEditorList(null)}
            style={{ width: '47%', flexGrow: 1 }}
          >
            {/* Tonale Well statt Strichlinie (Design-Leitplanke). */}
            <View
              style={{
                borderRadius: R.xl,
                backgroundColor: colors.chip,
                padding: Spacing.md,
                gap: Spacing.sm,
                minHeight: 106,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={22} color={colors.text3} strokeWidth={2} />
              <Type variant="label" tone="text3">Neue Liste</Type>
            </View>
          </PressableScale>
        </View>
      </Reveal>

      <TrashSection />

      {editorList !== undefined && <ListEditorSheet list={editorList} onClose={() => setEditorList(undefined)} />}
    </Screen>
  );
}

function SmartCard({ title, count, icon, onPress }: { title: string; count: number; icon: React.ReactNode; onPress: () => void }) {
  return (
    <PressableScale accessibilityLabel={`${title} öffnen`} onPress={onPress} style={{ flex: 1 }}>
      <Glass variant="card" radius={R.xl} style={Shadow.md} contentStyle={{ padding: Spacing.md, gap: Spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {icon}
          <Type variant="heading" tabular tone="text2">{count}</Type>
        </View>
        <Type variant="label">{title}</Type>
      </Glass>
    </PressableScale>
  );
}

/** Papierkorb: kürzlich gelöschte Listen & Aufgaben (30 Tage, wie Notizen/Chats).
 *  Tippen stellt wieder her; Swipe links löscht endgültig. Aufgaben, die MIT
 *  einer Liste gelöscht wurden, hängen an der Liste und erscheinen hier nicht. */
function TrashSection() {
  const colors = useColors();
  const today = todayStr();
  const { data: trashedTasks } = useTrashedTasks();
  const { data: trashedLists } = useTrashedLists();
  const restoreTask = useRestoreTask();
  const restoreList = useRestoreList();
  const deleteTaskForever = useDeleteTaskForever();
  const deleteListForever = useDeleteListForever();
  const [show, setShow] = useState(false);

  // Nach 30 Tagen still endgültig entsorgen (Muster aus Notizen/Chats).
  const cutoff = addDays(today, -30);
  const purged = useRef(false);
  useEffect(() => {
    if (purged.current || !trashedTasks || !trashedLists) return;
    const expiredTasks = trashedTasks.filter((t) => t.deletedAt && toDateStr(new Date(t.deletedAt)) < cutoff);
    const expiredLists = trashedLists.filter((l) => l.deletedAt && toDateStr(new Date(l.deletedAt)) < cutoff);
    if (expiredTasks.length === 0 && expiredLists.length === 0) return;
    purged.current = true;
    for (const t of expiredTasks) deleteTaskForever.mutate(t.id);
    for (const l of expiredLists) deleteListForever.mutate(l.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trashedTasks, trashedLists, cutoff]);

  const count = (trashedLists?.length ?? 0) + (trashedTasks?.length ?? 0);
  if (count === 0) return null;

  return (
    <Reveal delay={140}>
      <GlassPanel>
        <PressableScale
          accessibilityLabel={show ? 'Zuletzt gelöschte ausblenden' : 'Zuletzt gelöschte anzeigen'}
          onPress={() => {
            hapticSelect();
            setShow((v) => !v);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Type variant="eyebrow" tone="text3">Zuletzt gelöscht · {count}</Type>
          <DisclosureChevron open={show} color={colors.text3} />
        </PressableScale>
        {show && (
          <View style={{ marginTop: Spacing.xs }}>
            <Type variant="caption" tone="text3" style={{ marginBottom: Spacing.xs }}>
              Tippen stellt wieder her · nach 30 Tagen endgültig gelöscht.
            </Type>
            {(trashedLists ?? []).map((l) => (
              <TrashRow
                key={l.id}
                title={l.name}
                sub={`Liste · Gelöscht: ${l.deletedAt ? formatDueDate(toDateStr(new Date(l.deletedAt)), today) : ''}`}
                onRestore={() => restoreList.mutate(l)}
                onDeleteForever={() => deleteListForever.mutate(l.id)}
              />
            ))}
            {(trashedTasks ?? []).map((t) => (
              <TrashRow
                key={t.id}
                title={t.title}
                sub={`Gelöscht: ${t.deletedAt ? formatDueDate(toDateStr(new Date(t.deletedAt)), today) : ''}`}
                onRestore={() => restoreTask.mutate(t.id)}
                onDeleteForever={() => deleteTaskForever.mutate(t.id)}
              />
            ))}
          </View>
        )}
      </GlassPanel>
    </Reveal>
  );
}

function TrashRow({
  title,
  sub,
  onRestore,
  onDeleteForever,
}: {
  title: string;
  sub: string;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  const colors = useColors();
  const swipeRef = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={56}
      overshootRight={false}
      renderRightActions={(_progress, translation) => (
        <SwipeActionSlide side="right" width={130} translation={translation} color={colors.indigo}>
          <Type variant="label" style={{ color: '#FFFFFF', fontSize: T.sm }}>Endgültig löschen</Type>
        </SwipeActionSlide>
      )}
      onSwipeableWillOpen={() => {
        swipeRef.current?.close();
        hapticSelect();
        onDeleteForever();
      }}
    >
      <PressableScale
        accessibilityLabel={`„${title}" wiederherstellen`}
        onPress={() => {
          hapticSuccess();
          onRestore();
        }}
        pressedScale={0.99}
        style={{ paddingVertical: Spacing.sm, gap: 2, backgroundColor: 'transparent' }}
      >
        <Type variant="body" tone="text2" numberOfLines={1}>{title}</Type>
        <Type variant="caption" tone="text3" tabular>{sub}</Type>
      </PressableScale>
    </ReanimatedSwipeable>
  );
}
