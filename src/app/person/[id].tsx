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
import { ChevronLeft, ChevronRight, NotebookPen, Pencil, Sparkles, Trash2, UserRound } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
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
import { useChats } from '@/data/chatQueries';
import { useNotes } from '@/data/noteQueries';
import { useDeletePerson, usePeople, useUpdatePerson } from '@/data/personQueries';
import { useCompleteTask, useLists, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { todayStr } from '@/lib/dates';
import { hapticSelect } from '@/lib/haptics';
import { noteTitle } from '@/lib/noteLogic';
import { isOpen, isWaiting, recentlyCompleted } from '@/lib/taskLogic';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

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
  const updatePerson = useUpdatePerson();
  const deletePerson = useDeletePerson();
  const complete = useCompleteTask();
  const reopen = useReopenTask();

  const [editorTask, setEditorTask] = useState<Task | null | undefined>(undefined);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [quickTask, setQuickTask] = useState<Task | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [namensEntwurf, setNamensEntwurf] = useState('');
  const [notizEntwurf, setNotizEntwurf] = useState('');
  const [loeschBestaetigt, setLoeschBestaetigt] = useState(false);

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

  const sichern = () => {
    const name = namensEntwurf.trim();
    updatePerson.mutate({
      id: person.id,
      patch: { ...(name ? { name } : {}), note: notizEntwurf.trim() ? notizEntwurf.trim() : null },
    });
    setBearbeiten(false);
  };

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

  const leer = wartend.length === 0 && offen.length === 0 && erledigt.length === 0 && meineNotizen.length === 0 && meineChats.length === 0;

  return (
    <Screen withTabBar={false} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {zurueck}
          <PressableScale
            accessibilityLabel={bearbeiten ? 'Änderungen sichern' : 'Menschen bearbeiten'}
            onPress={() => {
              hapticSelect();
              if (bearbeiten) {
                sichern();
              } else {
                setNamensEntwurf(person.name);
                setNotizEntwurf(person.note ?? '');
                setLoeschBestaetigt(false);
                setBearbeiten(true);
              }
            }}
            style={{ padding: Spacing.sm }}
          >
            <Pencil size={18} color={bearbeiten ? colors.teal : colors.text3} strokeWidth={2} />
          </PressableScale>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
          <UserRound size={26} color={colors.teal} strokeWidth={2.2} />
          <Type variant="title">{person.name}</Type>
        </View>
        {!bearbeiten && person.note && (
          <Type variant="body" tone="text2" style={{ marginTop: Spacing.xs }}>{person.note}</Type>
        )}
      </Reveal>

      {bearbeiten && (
        <Reveal delay={60}>
          <GlassPanel>
            <View style={{ gap: Spacing.sm }}>
              <TextInput
                accessibilityLabel="Name"
                value={namensEntwurf}
                onChangeText={setNamensEntwurf}
                placeholder="Name"
                placeholderTextColor={colors.text3}
                style={[{ fontSize: T.md, color: colors.text, borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.bg2, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 }, webNoOutline]}
              />
              <TextInput
                accessibilityLabel="Notiz zum Menschen"
                value={notizEntwurf}
                onChangeText={setNotizEntwurf}
                placeholder="Notiz (z. B. Dachdecker, über Kollegin)"
                placeholderTextColor={colors.text3}
                style={[{ fontSize: T.md, color: colors.text, borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.bg2, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 }, webNoOutline]}
              />
              {/* Löschen zweistufig — und ehrlich darüber, was dabei passiert:
                  Aufgaben und Notizen bleiben, nur die Zuordnung geht. */}
              <PressableScale
                accessibilityLabel={loeschBestaetigt ? 'Löschen bestätigen' : 'Menschen löschen'}
                onPress={() => {
                  if (!loeschBestaetigt) {
                    setLoeschBestaetigt(true);
                    return;
                  }
                  deletePerson.mutate(person.id);
                  router.back();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm }}
              >
                <Trash2 size={16} color={colors.indigo} strokeWidth={2} />
                <Type variant="label" tone="indigo">
                  {loeschBestaetigt ? 'Wirklich löschen? Tippe erneut.' : 'Löschen — Aufgaben und Notizen bleiben'}
                </Type>
              </PressableScale>
            </View>
          </GlassPanel>
        </Reveal>
      )}

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

              {meineNotizen.length > 0 && (
                <View>
                  {(wartend.length > 0 || offen.length > 0) && <Seam marginVertical={Spacing.md} />}
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

      {editorTask !== undefined && <TaskEditorSheet task={editorTask} onClose={() => setEditorTask(undefined)} />}
      {rescheduleTask && <RescheduleSheet task={rescheduleTask} onClose={() => setRescheduleTask(null)} />}
      {quickTask && (
        <TaskQuickSheet task={quickTask} onClose={() => setQuickTask(null)} onReschedule={() => setRescheduleTask(quickTask)} />
      )}
    </Screen>
  );
}
