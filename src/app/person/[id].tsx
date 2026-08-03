// person/[id].tsx — alles zu einem Menschen an einem Ort.
//
// Der Moment, in dem dieser Bildschirm trägt, ist der, in dem man jemanden
// zufällig trifft: „Ach, da war doch was" — und dann steht es hier, statt auf
// drei Bildschirme verteilt zu sein (Aufgabe im Projekt, Notiz im Datumsstapel,
// Chat in der Chat-Liste).
//
// Reihenfolge nach Dringlichkeit der Frage: Worauf warte ich bei ihr/ihm?
// Was habe ich mit ihr/ihm vor? Was weiß ich? Worüber habe ich nachgedacht?
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft, ChevronRight, Mail, NotebookPen, Pencil, Phone, Sparkles, UserRound } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassPanel } from '@/components/GlassPanel';
import { PersonEditorSheet } from '@/components/PersonEditorSheet';
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
import { useDeviceEvents } from '@/data/calendarQueries';
import { useChats } from '@/data/chatQueries';
import { useEventPeople } from '@/data/eventPersonQueries';
import { useNotes } from '@/data/noteQueries';
import { usePeople } from '@/data/personQueries';
import { useCompleteTask, useLists, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { addDays, formatDueDate, toDateStr, todayStr } from '@/lib/dates';
import { hasCalendarPermission } from '@/lib/deviceCalendar';
import { hapticSelect } from '@/lib/haptics';
import { noteTitle } from '@/lib/noteLogic';
import { isOpen, isWaiting, recentlyCompleted } from '@/lib/taskLogic';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = todayStr();

  const { data: people } = usePeople();
  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const { data: notes } = useNotes();
  const { data: chats } = useChats();
  const complete = useCompleteTask();
  const reopen = useReopenTask();

  const [editorTask, setEditorTask] = useState<Task | null | undefined>(undefined);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [quickTask, setQuickTask] = useState<Task | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);

  const person = useMemo(() => (people ?? []).find((p) => p.id === id), [people, id]);
  const listById = useMemo(() => new Map((lists ?? []).map((l) => [l.id, l])), [lists]);

  const meine = useMemo(() => (tasks ?? []).filter((t) => t.personId === id), [tasks, id]);
  const wartend = useMemo(() => meine.filter((t) => isWaiting(t)), [meine]);
  const offen = useMemo(() => meine.filter((t) => isOpen(t) && !isWaiting(t)), [meine]);
  const erledigt = useMemo(() => recentlyCompleted(meine, today), [meine, today]);
  const meineNotizen = useMemo(
    () => (notes ?? []).filter((n) => n.personId === id && n.deletedAt === null),
    [notes, id],
  );
  const meineChats = useMemo(
    () => (chats ?? []).filter((c) => c.personId === id && c.deletedAt === null),
    [chats, id],
  );

  // Termine: die Verknüpfung gehört uns, der Termin dem Gerätekalender.
  // Gezeigt wird das Fenster, das die App ohnehin lädt (~5 Wochen) — was
  // länger her oder weiter weg ist, holt niemand hier.
  const [calGranted, setCalGranted] = useState(false);
  useEffect(() => {
    void hasCalendarPermission().then(setCalGranted);
  }, []);
  const { data: events } = useDeviceEvents(addDays(today, -14), addDays(today, 35), calGranted);
  const { data: eventLinks } = useEventPeople();
  const meineTermine = useMemo(() => {
    const ids = new Set((eventLinks ?? []).filter((l) => l.personId === id).map((l) => l.eventId));
    const gesehen = new Set<string>();
    return (events ?? []).filter((e) => {
      if (!ids.has(e.id) || gesehen.has(e.id)) return false;
      gesehen.add(e.id);
      return true;
    });
  }, [events, eventLinks, id]);

  const toggle = (task: Task) => (next: boolean) => {
    if (next) complete.mutate(task);
    else reopen.mutate(task.id);
  };

  const zurueck = (
    <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm, marginLeft: -Spacing.sm, alignSelf: 'flex-start' }}>
      <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
    </PressableScale>
  );

  if (!person) {
    return (
      <Screen withTabBar={false} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
        <Reveal>
          {zurueck}
          <EmptyState title="Diesen Menschen gibt es nicht mehr" body="Vielleicht wurde er gelöscht — was an ihm hing, ist geblieben." />
        </Reveal>
      </Screen>
    );
  }

  const renderRow = (t: Task) => (
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
  );

  const leer =
    wartend.length === 0 &&
    offen.length === 0 &&
    erledigt.length === 0 &&
    meineNotizen.length === 0 &&
    meineChats.length === 0 &&
    meineTermine.length === 0;

  return (
    <Screen withTabBar={false} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {zurueck}
          {/* Bearbeiten läuft seit v1.75.0 über dasselbe Sheet wie das Anlegen
              (`PersonEditorSheet`) statt über einen zweiten Inline-Editor, den
              es nur hier gab — mit Telefon, E-Mail und dem Weg ins Adressbuch
              wären das sonst zwei Formulare gewesen, die auseinanderlaufen. */}
          <PressableScale
            accessibilityLabel="Menschen bearbeiten"
            onPress={() => {
              hapticSelect();
              setBearbeiten(true);
            }}
            style={{ padding: Spacing.sm }}
          >
            <Pencil size={18} color={colors.text3} strokeWidth={2} />
          </PressableScale>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
          <UserRound size={26} color={colors.teal} strokeWidth={2.2} />
          <Type variant="title">{person.name}</Type>
        </View>
        {person.note && <Type variant="body" tone="text2" style={{ marginTop: Spacing.xs }}>{person.note}</Type>}

        {/* Nummer und E-Mail sind ANTIPPBAR — das ist der eigentliche Ertrag
            des Imports. „Angebot vom Dachdecker" wartet, man tippt den
            Menschen an, tippt die Nummer an, und telefoniert. Ohne das wäre
            eine gespeicherte Nummer nur Text zum Abschreiben. */}
        {(person.phone || person.email) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm }}>
            {person.phone && (
              <PressableScale
                accessibilityLabel={`${person.name} anrufen`}
                onPress={() => {
                  hapticSelect();
                  void Linking.openURL(`tel:${person.phone!.replace(/\s+/g, '')}`);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: R.pill, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.chipBorder }}
              >
                <Phone size={14} color={colors.teal} strokeWidth={2} />
                <Type variant="label" tone="teal" tabular>{person.phone}</Type>
              </PressableScale>
            )}
            {person.email && (
              <PressableScale
                accessibilityLabel={`${person.name} eine E-Mail schreiben`}
                onPress={() => {
                  hapticSelect();
                  void Linking.openURL(`mailto:${person.email}`);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: R.pill, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.chipBorder }}
              >
                <Mail size={14} color={colors.teal} strokeWidth={2} />
                <Type variant="label" tone="teal" numberOfLines={1} style={{ maxWidth: 200 }}>{person.email}</Type>
              </PressableScale>
            )}
          </View>
        )}
      </Reveal>

      <Reveal delay={90}>
        <GlassPanel>
          {leer ? (
            <EmptyState
              icon={<UserRound size={20} color={colors.teal} strokeWidth={2} />}
              title="Noch nichts zugeordnet"
              body="Hänge eine Aufgabe, eine Notiz oder einen Chat an diesen Menschen — hier läuft danach alles zusammen."
            />
          ) : (
            <>
              {wartend.length > 0 && (
                <View>
                  <Type variant="eyebrow" tone="teal">Warten auf · {wartend.length}</Type>
                  <View style={{ marginTop: Spacing.xs }}>{wartend.map(renderRow)}</View>
                </View>
              )}

              {offen.length > 0 && (
                <View>
                  {wartend.length > 0 && <Seam marginVertical={Spacing.md} />}
                  <Type variant="eyebrow" tone="text3">Offen · {offen.length}</Type>
                  <View style={{ marginTop: Spacing.xs }}>{offen.map(renderRow)}</View>
                </View>
              )}

              {/* Termine stehen zwischen dem, was zu TUN ist, und dem, was man
                  WEISS — sie sind beides ein bisschen. */}
              {meineTermine.length > 0 && (
                <View>
                  {(wartend.length > 0 || offen.length > 0) && <Seam marginVertical={Spacing.md} />}
                  <Type variant="eyebrow" tone="text3">Termine · {meineTermine.length}</Type>
                  <View style={{ marginTop: Spacing.xs }}>
                    {meineTermine.map((e) => (
                      <View
                        key={e.key}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 }}
                      >
                        <CalendarDays size={16} color={colors.text3} strokeWidth={2} />
                        <View style={{ flex: 1 }}>
                          <Type variant="body" numberOfLines={1}>{e.title}</Type>
                          <Type variant="caption" tone="text3" tabular>
                            {formatDueDate(toDateStr(e.start), today)}
                            {e.allDay ? '' : `, ${String(e.start.getHours()).padStart(2, '0')}:${String(e.start.getMinutes()).padStart(2, '0')}`}
                            {e.location ? ` · ${e.location}` : ''}
                          </Type>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {meineNotizen.length > 0 && (
                <View>
                  {(wartend.length > 0 || offen.length > 0 || meineTermine.length > 0) && <Seam marginVertical={Spacing.md} />}
                  <Type variant="eyebrow" tone="text3">Notizen · {meineNotizen.length}</Type>
                  <View style={{ marginTop: Spacing.xs }}>
                    {meineNotizen.map((n) => (
                      <PressableScale
                        key={n.id}
                        accessibilityLabel={`Notiz „${noteTitle(n.body)}" öffnen`}
                        onPress={() => router.push(`/notiz/${n.id}`)}
                        pressedScale={0.99}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 }}
                      >
                        <NotebookPen size={16} color={colors.text3} strokeWidth={2} />
                        <Type variant="body" numberOfLines={1} style={{ flex: 1 }}>{noteTitle(n.body)}</Type>
                        <ChevronRight size={15} color={colors.text3} strokeWidth={2} />
                      </PressableScale>
                    ))}
                  </View>
                </View>
              )}

              {meineChats.length > 0 && (
                <View>
                  <Seam marginVertical={Spacing.md} />
                  <Type variant="eyebrow" tone="text3">Chats · {meineChats.length}</Type>
                  <View style={{ marginTop: Spacing.xs }}>
                    {meineChats.map((c) => (
                      <PressableScale
                        key={c.id}
                        accessibilityLabel={`Chat „${c.title}" öffnen`}
                        onPress={() => router.push(`/chat/${c.id}`)}
                        pressedScale={0.99}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 }}
                      >
                        <Sparkles size={16} color={colors.text3} strokeWidth={2} />
                        <Type variant="body" numberOfLines={1} style={{ flex: 1 }}>{c.title}</Type>
                        <ChevronRight size={15} color={colors.text3} strokeWidth={2} />
                      </PressableScale>
                    ))}
                  </View>
                </View>
              )}

              {erledigt.length > 0 && (
                <View>
                  <Seam variant="ornament" marginVertical={Spacing.md} />
                  <Type variant="eyebrow" tone="text3">Erledigt · {erledigt.length}</Type>
                  <View style={{ marginTop: Spacing.xs }}>{erledigt.map(renderRow)}</View>
                </View>
              )}
            </>
          )}
        </GlassPanel>
      </Reveal>

      {bearbeiten && <PersonEditorSheet person={person} onClose={() => setBearbeiten(false)} />}
      {editorTask !== undefined && <TaskEditorSheet task={editorTask} onClose={() => setEditorTask(undefined)} />}
      {rescheduleTask && <RescheduleSheet task={rescheduleTask} onClose={() => setRescheduleTask(null)} />}
      {quickTask && (
        <TaskQuickSheet task={quickTask} onClose={() => setQuickTask(null)} onReschedule={() => setRescheduleTask(quickTask)} />
      )}
    </Screen>
  );
}
