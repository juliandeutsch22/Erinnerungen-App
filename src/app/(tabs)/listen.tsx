// listen.tsx — Grid aus Glass-Karten (Icon, Name, offene Anzahl); Tap = Liste,
// Long-Press = bearbeiten; „Neue Liste" ist dieselbe Karte, nur leer.
// JEDE Kachel hier ist gleich gebaut: nacktes Zeichen auf der Platte, Zahl
// rechts, Beschriftung darunter — getoente Flaechen bedeuten in dieser App
// „aktiv" und haben unter einem Symbol nichts verloren (siehe unten).
// Darüber die Smart-Ansichten Geplant / Alle (Fahrplan §3.3).
import { useRouter } from 'expo-router';
import { CalendarClock, CalendarDays, ChevronRight, Filter as FilterIcon, Layers, PauseCircle, Plus, SlidersHorizontal, UserRound } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { DisclosureChevron } from '@/components/DisclosureChevron';
import { Glass } from '@/components/Glass';
import { GlassPanel } from '@/components/GlassPanel';
import { NeuLink } from '@/components/NeuKnopf';
import { PersonEditorSheet } from '@/components/PersonEditorSheet';
import { ListEditorSheet } from '@/components/ListEditorSheet';
import { listIcon } from '@/components/listMeta';
import { PressableScale } from '@/components/PressableScale';
import { ProgressLine } from '@/components/ProgressLine';
import { Reveal } from '@/components/Reveal';
import { QuickAdd } from '@/components/QuickAdd';
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
import type { List, Person, Task } from '@/data/types';
import { applyFilter } from '@/lib/taskFilters';
import { addDays, formatDueDate, toDateStr, todayStr } from '@/lib/dates';
import { usePeople } from '@/data/personQueries';
import { isCurrent, isOpen, isWaiting, listProgress, projectDeadlineLabel, projectState, waitingTasks } from '@/lib/taskLogic';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { useSettings } from '@/theme/settings.store';
import { QUICK_ADD_CLEARANCE, TAB_BAR_SAFE_BOTTOM } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Shadow, Spacing, T } from '@/theme/theme.tokens';

export default function ListenScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: lists } = useLists();
  const { data: tasks } = useTasks();

  // undefined = Sheet zu, null = neue Liste, List = bearbeiten.
  const [editorList, setEditorList] = useState<List | null | undefined>(undefined);
  // undefined = Sheet zu, null = neuer Person, Person = bearbeiten.
  const [editorPerson, setEditorPerson] = useState<Person | null | undefined>(undefined);
  const savedFilters = useSettings((s) => s.savedFilters);
  const today = todayStr();

  const openByList = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks ?? []) {
      // Schlummerndes und Verfallenes zaehlt nicht mit - es ist da, aber nicht jetzt.
      if (isOpen(t) && isCurrent(t, today)) map.set(t.listId, (map.get(t.listId) ?? 0) + 1);
    }
    return map;
    // `today` MUSS mit hinein: die Zaehlung haengt an der Lebensspanne. Ohne
    // das blieben die Zahlen stehen, wenn die App ueber Mitternacht offen ist.
  }, [tasks, today]);
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
  // Personen und Wartendes — beides zaehlt bewusst NICHT in die offenen
  // Aufgaben oben hinein: was bei anderen liegt, ist keine Zahl, die man
  // abarbeitet.
  const { data: people } = usePeople();
  const wartend = useMemo(() => waitingTasks(tasks ?? []), [tasks]);
  const wartendProPerson = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of wartend) if (t.personId) map.set(t.personId, (map.get(t.personId) ?? 0) + 1);
    return map;
  }, [wartend]);
  const offenProPerson = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks ?? []) {
      if (t.personId && isOpen(t) && !isWaiting(t)) map.set(t.personId, (map.get(t.personId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);
  const openTotal = useMemo(() => (tasks ?? []).filter((t) => isOpen(t) && isCurrent(t, today)).length, [tasks, today]);
  const openPlanned = useMemo(() => (tasks ?? []).filter((t) => isOpen(t) && isCurrent(t, today) && t.dueDate !== null).length, [tasks, today]);

  return (
    <View style={{ flex: 1 }}>
    <Screen contentContainerStyle={{ paddingBottom: TAB_BAR_SAFE_BOTTOM + QUICK_ADD_CLEARANCE }}>
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
            {/* Gehört zum ABSCHNITT „Filter", nicht zum Bildschirm — deshalb
                ein Link neben der Eyebrow und kein Plus in der Kopfzeile. */}
            <NeuLink label="Neuer Filter" icon={SlidersHorizontal} onPress={() => router.push('/filter')} />
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

      {/* Personen — der Ort, an dem „was liegt bei wem?" beantwortet wird.
          Der Zugang zu „Warten auf" steht bewusst HIER und nicht als eigene
          Smart-Karte oben: es ist keine Sicht auf den Kalender, sondern die
          Gegenfrage zu allem, was man selbst tut.

          Der Abschnitt steht IMMER da — genau wie „Filter" darüber, das seine
          Überschrift und seinen Link auch ohne gespeicherte Filter zeigt. Bis
          v1.74 erschien er erst, WENN es Personen gab; angelegt werden konnten
          sie aber nur nebenbei in einer Aufgabe. Wer nie eine Aufgabe jemandem
          zuordnete, hatte keinen Weg zu diesem Teil der App. */}
      <Reveal delay={105}>
          <View style={{ gap: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Type variant="eyebrow" tone="text3">Personen</Type>
              <NeuLink label="Neue Person" icon={UserRound} onPress={() => setEditorPerson(null)} />
            </View>
            {((people ?? []).length > 0 || wartend.length > 0) && (
            <GlassPanel>
              <PressableScale
                accessibilityLabel="Warten auf öffnen"
                onPress={() => router.push('/liste/warten')}
                pressedScale={0.99}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm }}
              >
                <PauseCircle size={18} color={colors.teal} strokeWidth={2} />
                <Type variant="body" style={{ flex: 1 }}>Warten auf</Type>
                <Type variant="caption" tone="text3" tabular>{wartend.length}</Type>
                <ChevronRight size={15} color={colors.text3} strokeWidth={2} />
              </PressableScale>
              {(people ?? []).map((p) => {
                const w = wartendProPerson.get(p.id) ?? 0;
                const o = offenProPerson.get(p.id) ?? 0;
                return (
                  <View key={p.id}>
                    <Seam marginVertical={2} />
                    <PressableScale
                      accessibilityLabel={`Alles zu ${p.name} ansehen`}
                      onPress={() => router.push(`/person/${p.id}`)}
                      onLongPress={() => {
                        hapticSelect();
                        setEditorPerson(p);
                      }}
                      pressedScale={0.99}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm }}
                    >
                      <UserRound size={18} color={colors.text3} strokeWidth={2} />
                      <View style={{ flex: 1 }}>
                        <Type variant="body" numberOfLines={1}>{p.name}</Type>
                        {p.note && <Type variant="caption" tone="text3" numberOfLines={1}>{p.note}</Type>}
                      </View>
                      {/* Zwei Zahlen, zwei Bedeutungen: was bei ihm liegt und
                          was bei mir. Nur die, die es gibt. */}
                      {w > 0 && <Type variant="caption" tone="teal" tabular>{w} wartet</Type>}
                      {o > 0 && <Type variant="caption" tone="text3" tabular>{o} offen</Type>}
                      <ChevronRight size={15} color={colors.text3} strokeWidth={2} />
                    </PressableScale>
                  </View>
                );
              })}
            </GlassPanel>
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
            // Ein ruhendes Projekt ist nie überfällig — zentrale Regel, siehe taskLogic.
            const deadlineOverdue = !!l.deadline && l.deadline < today && projectState(l, prog ?? { done: 0, total: 0 }) === 'laeuft';
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
                <Glass variant="card" radius={R.xl} style={Shadow.md} contentStyle={{ padding: Spacing.md, gap: Spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Das Zeichen liegt auf der Platte — ohne getönte Fläche.
                        Bis v1.74.3 saß es in einem 38er-Quadrat in der
                        Listenfarbe. Das war aus zwei Gründen falsch:
                        · Auf DIESEM Bildschirm hatten damit nur die echten
                          Listen eine Fläche, „Geplant" und „Alle" nicht —
                          zwei Bauweisen für dieselbe Kachel.
                        · Schwerer wiegt: in der GANZEN übrigen App bedeutet
                          eine getönte Fläche hinter einem Zeichen „an /
                          gewählt / aktiv" (MicButton beim Zuhören, WeekStrip
                          am gewählten Tag, ListEditorSheet beim gewählten
                          Symbol, RescheduleSheet an der gewählten Option).
                          Hier bedeutete sie gar nichts — sie war das einzige
                          rein schmückende Vorkommen und hat damit ein Signal
                          verbraucht, das woanders etwas sagt.
                        Die Listenfarbe trägt jetzt das Zeichen selbst, genau
                        wie bei Geplant (Blau) und Alle (Oliv). */}
                    <Icon size={20} color={l.color} strokeWidth={2} />
                    <Type variant="heading" tabular tone="text2">{openByList.get(l.id) ?? 0}</Type>
                  </View>
                  <Type variant="label" numberOfLines={1}>{l.name}</Type>
                  {/* Projekt: dünne Fortschrittslinie + Deadline-Hinweis. */}
                  {isProject && (
                    <View style={{ gap: 4 }}>
                      {/* Nur zeigen, wenn die Linie etwas SAGT: bei 0 % ist noch
                          nichts geschehen, bei 100 % steht „Alles erledigt"
                          ohnehin darunter — ein voller Balken wiederholt es nur
                          und ist der lauteste Fleck des Bildschirms. */}
                      {prog && prog.total > 0 && prog.ratio > 0 && prog.ratio < 1 && (
                        <ProgressLine ratio={prog.ratio} color={l.color} />
                      )}
                      {l.deadline && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <CalendarClock size={11} color={deadlineOverdue ? colors.indigo : colors.text3} strokeWidth={2} />
                          <Type variant="caption" tone={deadlineOverdue ? 'indigo' : 'text3'} numberOfLines={1}>
                            {projectDeadlineLabel(l, prog ?? { done: 0, total: 0 }, today)}
                          </Type>
                        </View>
                      )}
                    </View>
                  )}
                </Glass>
              </PressableScale>
            );
          })}

          {/* „Neue Liste" — dieselbe Karte, nur leer.
              Bis v1.74 war das eine flache, mittig gesetzte Well: kein Marmor,
              kein Schatten, keine Fase, und als einzige Kachel des Gitters
              zentriert. Danach drei Runden Feinschliff (v1.74.1–.3), in denen
              ich die Kachel immer nur gegen ihre direkten NACHBARN gehalten
              habe. Der richtige Vergleich war die ganze Seite: jede Kachel
              hier trägt jetzt ein nacktes Zeichen auf der Platte, rechts die
              Zahl (wo es eine gibt) und darunter die Beschriftung. Die leere
              unterscheidet sich nur noch durch das, was ihr FEHLT — die Zahl —
              und durch den leiseren Schatten und die graue Schrift. */}
          <PressableScale
            accessibilityLabel="Neue Liste anlegen"
            onPress={() => setEditorList(null)}
            style={{ width: '47%', flexGrow: 1 }}
          >
            <Glass variant="card" radius={R.xl} style={Shadow.sm} contentStyle={{ padding: Spacing.md, gap: Spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Teal, wie JEDES „lege etwas an" in dieser App. Eine Spur
                    größer als die Listen-Symbole: das Plus sind zwei Striche
                    ohne Umriss und wirkt bei gleicher Zahl kleiner. */}
                <Plus size={22} color={colors.teal} strokeWidth={2.2} />
              </View>
              {/* Text3, weil die Zeile im NAMENS-Feld sitzt und dort noch kein
                  Name steht. */}
              <Type variant="label" tone="text3" numberOfLines={1}>Neue Liste</Type>
            </Glass>
          </PressableScale>
        </View>
      </Reveal>

      <TrashSection />

      {editorList !== undefined && <ListEditorSheet list={editorList} onClose={() => setEditorList(undefined)} />}
      {editorPerson !== undefined && (
        <PersonEditorSheet person={editorPerson} onClose={() => setEditorPerson(undefined)} />
      )}
    </Screen>
    <QuickAdd />
    </View>
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
