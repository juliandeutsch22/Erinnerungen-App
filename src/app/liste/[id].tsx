// liste/[id].tsx — Listen-Detail. `id` ist eine echte Liste oder eine
// Smart-Ansicht: 'geplant' (chronologisch gruppiert) / 'alle' (nach Liste).
// Offene zuerst (fällige oben), Erledigt-Sektion einklappbar (30-Tage-Fenster).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpDown, CalendarClock, CheckCheck, ChevronLeft, Pencil, Plus, RotateCcw, Share2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton } from '@/components/GlassButton';
import { DisclosureChevron } from '@/components/DisclosureChevron';
import { GlassPanel } from '@/components/GlassPanel';
import { ListEditorSheet } from '@/components/ListEditorSheet';
import { listIcon } from '@/components/listMeta';
import { PressableScale } from '@/components/PressableScale';
import { ProgressLine } from '@/components/ProgressLine';
import { ReorderSheet } from '@/components/ReorderSheet';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { Reveal } from '@/components/Reveal';
import { QuickAdd } from '@/components/QuickAdd';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState } from '@/components/StateView';
import { TaskEditorSheet } from '@/components/TaskEditorSheet';
import { TaskQuickSheet } from '@/components/TaskQuickSheet';
import { TaskRow } from '@/components/TaskRow';
import { Type } from '@/components/Type';
import { useCompleteList, useCompleteTask, useLists, useReopenList, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { todayStr } from '@/lib/dates';
import { byTimeThenCreation, expiredTasks, groupPlanned, isCurrent, isDormant, isOpen, listProgress, projectDeadlineLabel, projectState, recentlyCompleted } from '@/lib/taskLogic';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { shareText } from '@/lib/share';
import { listToShareText } from '@/lib/shareText';
import { QUICK_ADD_CLEARANCE } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

// Das Listen-Symbol als eigene, MODULWEITE Komponente. Vorher stand
// `const ListIcon = listIcon(list.icon)` im Rendern — ein Komponententyp, der
// mit jedem Rendern neu bestimmt wird; React baut ihn dann jedes Mal neu auf
// statt ihn zu aktualisieren.
function ListenIcon({ icon, color }: { icon: string; color: string }) {
  // `createElement` statt `<Icon …>`: `listIcon` ist ein NACHSCHLAGEN in einer
  // festen Tabelle, kein Erzeugen — die Identität ist je Namen stabil. In
  // JSX-Schreibweise liest der Linter es trotzdem als „Komponente im Rendern
  // gebaut", weil er der Tabelle nicht folgen kann.
  return React.createElement(listIcon(icon), { size: 26, color, strokeWidth: 2.2 });
}

export default function ListeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  // Der Fußraum muss die Home-Anzeige MITrechnen: die Zeile sitzt hier ohne
  // Tab-Bar direkt über dem unteren Rand.
  const insets = useSafeAreaInsets();
  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const completeList = useCompleteList();
  const reopenList = useReopenList();

  const [editorTask, setEditorTask] = useState<Task | null | undefined>(undefined);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [quickTask, setQuickTask] = useState<Task | null>(null);
  const [editList, setEditList] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
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
      scoped.filter((t) => isOpen(t) && isCurrent(t, today)).sort((a, b) => {
        if (a.dueDate !== b.dueDate) {
          if (a.dueDate === null) return 1;
          if (b.dueDate === null) return -1;
          return a.dueDate < b.dueDate ? -1 : 1;
        }
        return byTimeThenCreation(a, b);
      }),
    [scoped, today],
  );
  // Schlummernde und verfallene Aufgaben verschwinden aus der offenen Liste,
  // aber NICHT aus der App: sie bekommen unten je eine eigene, ruhige Gruppe.
  const spaeter = useMemo(
    () => scoped.filter((t) => isOpen(t) && isDormant(t, today)).sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1)),
    [scoped, today],
  );
  const verfallen = useMemo(() => expiredTasks(scoped, today), [scoped, today]);
  const completed = useMemo(() => recentlyCompleted(scoped, today), [scoped, today]);
  const progress = useMemo(() => listProgress(scoped), [scoped]);
  const isProject = !!(list && (list.goal || list.deadline));
  // Ruht das Projekt (abgeschlossen oder alles erledigt), mahnt nichts mehr.
  const deadlineOverdue =
    !!list?.deadline && list.deadline < today && projectState(list, progress) === 'laeuft';
  const plannedGroups = useMemo(() => (id === 'geplant' ? groupPlanned(scoped, today) : []), [id, scoped, today]);

  const title = id === 'geplant' ? 'Geplant' : id === 'alle' ? 'Alle' : (list?.name ?? 'Liste');

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
      onLongPress={() => setQuickTask(t)}
    />
  );

  return (
    <View style={{ flex: 1 }}>
    <Screen withTabBar={false} contentContainerStyle={{ paddingBottom: insets.bottom + QUICK_ADD_CLEARANCE }}>
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
              <PressableScale
                accessibilityLabel="Liste teilen"
                onPress={() => {
                  hapticSelect();
                  void shareText(listToShareText(list, scoped, today), list.name);
                }}
                style={{ padding: Spacing.sm }}
              >
                <Share2 size={18} color={colors.text3} strokeWidth={2} />
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
          {list && <ListenIcon icon={list.icon} color={list.color} />}
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
                    {projectDeadlineLabel(list, progress, today)}
                  </Type>
                </View>
              )}
            </View>
            {progress.total > 0 && <ProgressLine ratio={progress.ratio} color={list.color} height={4} />}
            {/* Abschließen — ein Projekt darf zu Ende gehen. Danach ruht es:
                keine Deadline-Mahnung mehr, kein Punkt im Kalender. Bewusst
                eine Handlung des Nutzers, nicht automatisch bei 100 %: man
                fügt oft noch etwas hinzu. */}
            <PressableScale
              accessibilityLabel={list.completedAt ? 'Projekt wieder aufnehmen' : 'Projekt abschließen'}
              onPress={() => {
                hapticSuccess();
                if (list.completedAt) reopenList.mutate(list.id);
                else completeList.mutate(list.id);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.xs }}
            >
              {list.completedAt ? (
                <RotateCcw size={14} color={colors.text3} strokeWidth={2} />
              ) : (
                <CheckCheck size={14} color={colors.teal} strokeWidth={2} />
              )}
              <Type variant="label" tone={list.completedAt ? 'text3' : 'teal'}>
                {list.completedAt ? 'Wieder aufnehmen' : 'Projekt abschließen'}
              </Type>
            </PressableScale>
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

          {/* Spaeter: schlummernde Aufgaben. Sie sind nicht weg, sie sind nur
              noch nicht dran — deshalb sichtbar, aber eingeklappt und leise. */}
          {spaeter.length > 0 && (
            <>
              <Seam marginVertical={Spacing.md} />
              <PressableScale
                accessibilityLabel={showLater ? 'Später ausblenden' : 'Später anzeigen'}
                onPress={() => {
                  hapticSelect();
                  setShowLater((v) => !v);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Type variant="eyebrow" tone="text3">Später · {spaeter.length}</Type>
                <DisclosureChevron open={showLater} color={colors.text3} />
              </PressableScale>
              {showLater && <View style={{ marginTop: Spacing.xs }}>{spaeter.map((t) => renderRow(t, isSmartView))}</View>}
            </>
          )}

          {/* Anlass vorbei: nicht ueberfaellig, sondern gegenstandslos. Nur ein
              ruhiger Hinweis — weggeraeumt wird von Hand. */}
          {verfallen.length > 0 && (
            <>
              <Seam marginVertical={Spacing.md} />
              <PressableScale
                accessibilityLabel={showExpired ? 'Anlass vorbei ausblenden' : 'Anlass vorbei anzeigen'}
                onPress={() => {
                  hapticSelect();
                  setShowExpired((v) => !v);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Type variant="eyebrow" tone="text3">Anlass vorbei · {verfallen.length}</Type>
                <DisclosureChevron open={showExpired} color={colors.text3} />
              </PressableScale>
              {showExpired && <View style={{ marginTop: Spacing.xs }}>{verfallen.map((t) => renderRow(t, isSmartView))}</View>}
            </>
          )}

          {/* Erledigt — einklappbar, automatisch nur die letzten 30 Tage. */}
          {completed.length > 0 && (
            <>
              <Seam variant="ornament" marginVertical={Spacing.md} />
              <PressableScale
                accessibilityLabel={showCompleted ? 'Erledigte ausblenden' : 'Erledigte anzeigen'}
                onPress={() => {
                  hapticSelect();
                  setShowCompleted((v) => !v);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Type variant="eyebrow" tone="text3">Erledigt · {completed.length}</Type>
                <DisclosureChevron open={showCompleted} color={colors.text3} />
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
      {quickTask && (
        <TaskQuickSheet
          task={quickTask}
          onClose={() => setQuickTask(null)}
          onReschedule={() => setRescheduleTask(quickTask)}
        />
      )}
      {editList && list && <ListEditorSheet list={list} onClose={() => setEditList(false)} />}
      {reordering && <ReorderSheet tasks={open} onClose={() => setReordering(false)} />}
    </Screen>
    {/* Nur in ECHTEN Listen. Die Smart-Views („Geplant", „Alle", Filter) teilen
        sich diesen Bildschirm, haben aber keine Liste, in die etwas gehörte —
        eine Aufgabe landete dort in einer id, die es nicht gibt. */}
    {list && <QuickAdd listId={list.id} ueberTabBar={false} />}
    </View>
  );
}
