// notizen.tsx — Notizen-Tab: Liste aller Notizen in Datumsgruppen wie iOS Notes
// (Angeheftet · Heute · Gestern · Letzte 7 Tage · Letzte 30 Tage · Älter).
// Titel = erste Zeile, Vorschau darunter, Tippen öffnet den Vollbild-Editor,
// Plus legt sofort eine leere Notiz an und springt hinein.
// Swipe rechts = anheften/lösen, Swipe links = in den Papierkorb.
// „Zuletzt gelöscht" (30 Tage) unten: Tippen stellt wieder her,
// Swipe links löscht endgültig; Abgelaufenes wird beim Öffnen entfernt.
import { useRouter } from 'expo-router';
import { ListChecks, NotebookPen, Pin } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { DisclosureChevron } from '@/components/DisclosureChevron';
import { GlassPanel } from '@/components/GlassPanel';
import { NeuKnopf, ScreenKopf } from '@/components/NeuKnopf';
import { useZeileDraft } from '@/lib/zeileDraft';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { QuickAdd } from '@/components/QuickAdd';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState, LoadingState } from '@/components/StateView';
import { SwipeActionSlide } from '@/components/SwipeActionSlide';
import { Type } from '@/components/Type';
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from '@/data/noteQueries';
import { useLists } from '@/data/queries';
import type { Note } from '@/data/types';
import { formatDueDate, toDateStr, todayStr } from '@/lib/dates';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { activeNotes, checklistProgress, expiredTrash, groupNotes, notePreview, noteTitle, trashedNotes } from '@/lib/noteLogic';
import { QUICK_ADD_CLEARANCE, TAB_BAR_SAFE_BOTTOM } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing, T } from '@/theme/theme.tokens';

export default function NotizenScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: notes, isLoading } = useNotes();
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const today = todayStr();

  // Nur die FARBE je Liste — mehr braucht die Zeile nicht, und eine gelöschte
  // Liste steht nicht in `lists`, also verschwindet ihr Punkt von selbst.
  const { data: lists } = useLists();
  const listFarbe = useMemo(() => new Map((lists ?? []).map((l) => [l.id, l.color])), [lists]);

  const active = useMemo(() => activeNotes(notes ?? []), [notes]);
  const groups = useMemo(() => groupNotes(active, today), [active, today]);
  const trash = useMemo(() => trashedNotes(notes ?? [], today), [notes, today]);
  const [showTrash, setShowTrash] = useState(false);

  // Housekeeping: abgelaufener Papierkorb (> 30 Tage) wird endgültig entfernt.
  const purged = useRef(false);
  useEffect(() => {
    if (purged.current || !notes) return;
    const expired = expiredTrash(notes, today);
    if (expired.length === 0) return;
    purged.current = true;
    for (const n of expired) deleteNote.mutate(n.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, today]);

  // „+" erbt, was in der EINEN Zeile steht: eine Notiz entsteht sofort, also
  // wandert der Entwurf mit hinein und die Zeile wird geleert. Anders als bei
  // Aufgabe und Termin gibt es hier kein „abbrechen" — die Notiz ist da.
  const zeileText = useZeileDraft((s) => s.text);
  const zeileLeeren = useZeileDraft((s) => s.leeren);
  const openNew = () => {
    hapticSuccess();
    const anfang = zeileText.trim();
    createNote.mutate(
      anfang.length > 0 ? { body: anfang } : {},
      { onSuccess: (note) => router.push(`/notiz/${note.id}`) },
    );
    if (anfang.length > 0) zeileLeeren();
  };

  return (
    <View style={{ flex: 1 }}>
    <Screen contentContainerStyle={{ paddingBottom: TAB_BAR_SAFE_BOTTOM + QUICK_ADD_CLEARANCE }}>
      <Reveal>
        <ScreenKopf
          titel={<Type variant="title">Notizen</Type>}
          /* Ruhige Zähl-Zeile — dieselbe Stimme wie die anderen Tabs. */
          unter={
            <Type variant="caption" tone="text3" style={{ marginTop: Spacing.xs }} tabular>
              {active.length === 1 ? '1 Notiz' : `${active.length} Notizen`}
            </Type>
          }
          aktionen={<NeuKnopf label="Neue Notiz" onPress={openNew} />}
        />
      </Reveal>

      <Reveal delay={90}>
        <GlassPanel>
          {isLoading && (notes ?? []).length === 0 ? (
            <LoadingState />
          ) : active.length === 0 && trash.length === 0 ? (
            <EmptyState
              icon={<NotebookPen size={20} color={colors.teal} strokeWidth={2} />}
              title="Noch keine Notizen"
              body="Gedanken, Ideen, Mitschriften — alles, was keine Aufgabe ist. Schreib unten in die Zeile oder tippe oben auf das Plus."
            />
          ) : (
            <>
              {groups.map((g, gi) => (
                <View key={g.key}>
                  {gi > 0 && <Seam marginVertical={Spacing.md} />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                    {g.key === 'pinned' && <Pin size={11} color={colors.teal} strokeWidth={2.2} />}
                    <Type variant="eyebrow" tone={g.key === 'pinned' ? 'teal' : 'text3'}>{g.title}</Type>
                  </View>
                  <View style={{ marginTop: Spacing.xs }}>
                    {g.notes.map((n, i) => (
                      <View key={n.id}>
                        {i > 0 && <Seam marginVertical={2} />}
                        <NoteRow
                          note={n}
                          today={today}
                          listColor={n.listId ? listFarbe.get(n.listId) : undefined}
                          onPress={() => router.push(`/notiz/${n.id}`)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}

              {/* Zuletzt gelöscht — einklappbar, 30-Tage-Fenster wie Erledigt. */}
              {trash.length > 0 && (
                <>
                  {groups.length > 0 && <Seam variant="ornament" marginVertical={Spacing.md} />}
                  <PressableScale
                    accessibilityLabel={showTrash ? 'Zuletzt gelöschte ausblenden' : 'Zuletzt gelöschte anzeigen'}
                    onPress={() => {
                      hapticSelect();
                      setShowTrash((v) => !v);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Type variant="eyebrow" tone="text3">Zuletzt gelöscht · {trash.length}</Type>
                    <DisclosureChevron open={showTrash} color={colors.text3} />
                  </PressableScale>
                  {showTrash && (
                    <View style={{ marginTop: Spacing.xs }}>
                      <Type variant="caption" tone="text3" style={{ marginBottom: Spacing.xs }}>
                        Tippen stellt wieder her · nach 30 Tagen endgültig gelöscht.
                      </Type>
                      {trash.map((n) => (
                        <TrashRow key={n.id} note={n} today={today} />
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </GlassPanel>
      </Reveal>
    </Screen>
    <QuickAdd />
    </View>
  );
}

/** Eine Notiz-Zeile: Titel (Antiqua) + Datum · Vorschau.
 *  Swipe rechts = anheften/lösen, Swipe links = Papierkorb.
 *
 *  `listColor` ist der Punkt vor dem Titel: gehört die Notiz zu einer Liste,
 *  sieht man es hier — sonst hätte das Zuordnen an ihrem eigenen Ort gar keine
 *  sichtbare Folge. Kein Name, nur die Farbe; der Stapel bleibt ruhig. */
function NoteRow({ note, today, listColor, onPress }: { note: Note; today: string; listColor?: string; onPress: () => void }) {
  const colors = useColors();
  const updateNote = useUpdateNote();
  const swipeRef = useRef<SwipeableMethods>(null);

  const dateLabel = formatDueDate(toDateStr(new Date(note.updatedAt)), today);
  const preview = notePreview(note.body);

  const row = (
    <PressableScale
      accessibilityLabel={`Notiz „${noteTitle(note.body)}" öffnen`}
      onPress={onPress}
      pressedScale={0.99}
      style={{ paddingVertical: Spacing.sm, gap: 2, backgroundColor: 'transparent' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
        {listColor && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: listColor }} />}
        <Type variant="heading" numberOfLines={1} style={{ flex: 1, fontSize: T.lg, lineHeight: T.lg * 1.3 }}>
          {noteTitle(note.body)}
        </Type>
      </View>
      {/* Vorschau links in voller Breite, Checklisten-Stand + Datum rechts. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <Type variant="caption" tone="text2" numberOfLines={1} style={{ flex: 1 }}>
          {preview || ' '}
        </Type>
        {(() => {
          const p = checklistProgress(note.body);
          if (p.total === 0) return null;
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <ListChecks size={11} color={p.done === p.total ? colors.teal : colors.text3} strokeWidth={2} />
              <Type variant="caption" tone={p.done === p.total ? 'teal' : 'text3'} tabular>{p.done}/{p.total}</Type>
            </View>
          );
        })()}
        <Type variant="caption" tone="text3" tabular>{dateLabel}</Type>
      </View>
    </PressableScale>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={56}
      rightThreshold={56}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(_progress, translation) => (
        <SwipeActionSlide side="left" width={100} translation={translation} color={colors.teal}>
          <Pin size={17} color="#FFFFFF" strokeWidth={2.2} />
          <Type variant="label" style={{ color: '#FFFFFF', fontSize: T.sm }}>{note.pinned ? 'Lösen' : 'Anheften'}</Type>
        </SwipeActionSlide>
      )}
      renderRightActions={(_progress, translation) => (
        <SwipeActionSlide side="right" width={96} translation={translation} color={colors.indigo}>
          <Type variant="label" style={{ color: '#FFFFFF', fontSize: T.sm }}>Löschen</Type>
        </SwipeActionSlide>
      )}
      onSwipeableWillOpen={(direction) => {
        swipeRef.current?.close();
        hapticSelect();
        // direction = Bewegungsrichtung der Zeile (ReanimatedSwipeable):
        // 'right' = nach rechts gewischt → LINKE Aktion (Anheften) offen.
        if (direction === 'right') {
          updateNote.mutate({ id: note.id, patch: { pinned: !note.pinned } });
        } else {
          updateNote.mutate({ id: note.id, patch: { deletedAt: new Date().toISOString() } });
        }
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

/** Papierkorb-Zeile: Tippen stellt wieder her, Swipe links löscht endgültig. */
function TrashRow({ note, today }: { note: Note; today: string }) {
  const colors = useColors();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const swipeRef = useRef<SwipeableMethods>(null);

  const deletedLabel = note.deletedAt ? formatDueDate(toDateStr(new Date(note.deletedAt)), today) : '';

  const row = (
    <PressableScale
      accessibilityLabel={`Notiz „${noteTitle(note.body)}" wiederherstellen`}
      onPress={() => {
        hapticSuccess();
        updateNote.mutate({ id: note.id, patch: { deletedAt: null } });
      }}
      pressedScale={0.99}
      style={{ paddingVertical: Spacing.sm, gap: 2, backgroundColor: 'transparent' }}
    >
      <Type variant="body" tone="text2" numberOfLines={1}>{noteTitle(note.body)}</Type>
      <Type variant="caption" tone="text3" tabular>Gelöscht: {deletedLabel}</Type>
    </PressableScale>
  );

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
        // Nur eine Aktionsseite — jede Öffnung IST das endgültige Löschen.
        swipeRef.current?.close();
        hapticSelect();
        deleteNote.mutate(note.id);
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}
