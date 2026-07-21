// listen.tsx — Grid aus Glass-Karten (Icon, Name, offene Anzahl); Tap = Liste,
// Long-Press = bearbeiten; „+ Neue Liste" als gestrichelte Geister-Karte.
// Darüber die Smart-Ansichten Geplant / Alle (Fahrplan §3.3).
import { useRouter } from 'expo-router';
import { CalendarClock, CalendarDays, Filter as FilterIcon, Layers, Plus, SlidersHorizontal } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Glass } from '@/components/Glass';
import { ListEditorSheet } from '@/components/ListEditorSheet';
import { listIcon } from '@/components/listMeta';
import { PressableScale } from '@/components/PressableScale';
import { ProgressLine } from '@/components/ProgressLine';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { Type } from '@/components/Type';
import { useLists, useTasks } from '@/data/queries';
import type { List, Task } from '@/data/types';
import { applyFilter } from '@/lib/taskFilters';
import { deadlineLabel, todayStr } from '@/lib/dates';
import { isOpen, listProgress } from '@/lib/taskLogic';
import { hapticSelect } from '@/lib/haptics';
import { useSettings } from '@/theme/settings.store';
import { useColors } from '@/theme/ThemeProvider';
import { R, Shadow, Spacing } from '@/theme/theme.tokens';

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
