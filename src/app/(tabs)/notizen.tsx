// notizen.tsx — Notizen-Tab: Liste aller Notizen in Datumsgruppen wie iOS Notes
// (Angeheftet · Heute · Gestern · Letzte 7 Tage · Letzte 30 Tage · Älter).
// Titel = erste Zeile, Vorschau darunter, Tippen öffnet den Vollbild-Editor,
// Plus legt sofort eine leere Notiz an und springt hinein.
// Swipe rechts = anheften/lösen, Swipe links = in den Papierkorb.
// „Zuletzt gelöscht" (30 Tage) unten: Tippen stellt wieder her,
// Swipe links löscht endgültig; Abgelaufenes wird beim Öffnen entfernt.
import { useRouter } from 'expo-router';
import { NotebookPen, Pin, Plus } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { DisclosureChevron } from '@/components/DisclosureChevron';
import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState, LoadingState } from '@/components/StateView';
import { Type } from '@/components/Type';
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from '@/data/noteQueries';
import type { Note } from '@/data/types';
import { formatDueDate, toDateStr, todayStr } from '@/lib/dates';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { activeNotes, expiredTrash, groupNotes, notePreview, noteTitle, trashedNotes } from '@/lib/noteLogic';
import { TAB_BAR_SAFE_BOTTOM } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing, T } from '@/theme/theme.tokens';

export default function NotizenScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: notes, isLoading } = useNotes();
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const today = todayStr();

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

  const openNew = () => {
    hapticSuccess();
    createNote.mutate(
      {},
      { onSuccess: (note) => router.push(`/notiz/${note.id}`) },
    );
  };

  return (
    <Screen contentContainerStyle={{ paddingBottom: TAB_BAR_SAFE_BOTTOM }}>
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: Spacing.xs, flex: 1 }}>
            <Type variant="title">Notizen</Type>
            {/* Ruhige Zähl-Zeile — dieselbe Stimme wie die anderen Tabs. */}
            <Type variant="caption" tone="text3" tabular>
              {active.length === 1 ? '1 Notiz' : `${active.length} Notizen`}
            </Type>
          </View>
          <PressableScale accessibilityLabel="Neue Notiz" onPress={openNew} style={{ padding: Spacing.sm }}>
            <Plus size={22} color={colors.teal} strokeWidth={2.2} />
          </PressableScale>
        </View>
      </Reveal>

      <Reveal delay={90}>
        <GlassPanel>
          {isLoading && (notes ?? []).length === 0 ? (
            <LoadingState />
          ) : active.length === 0 && trash.length === 0 ? (
            <EmptyState
              icon={<NotebookPen size={20} color={colors.teal} strokeWidth={2} />}
              title="Noch keine Notizen"
              body="Gedanken, Ideen, Mitschriften — alles, was keine Aufgabe ist. Tippe auf das Plus."
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
                        <NoteRow note={n} today={today} onPress={() => router.push(`/notiz/${n.id}`)} />
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
  );
}

/** Eine Notiz-Zeile: Titel (Antiqua) + Datum · Vorschau.
 *  Swipe rechts = anheften/lösen, Swipe links = Papierkorb. */
function NoteRow({ note, today, onPress }: { note: Note; today: string; onPress: () => void }) {
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
      style={{ paddingVertical: Spacing.sm, gap: 2, backgroundColor: colors.bg2 }}
    >
      <Type variant="heading" numberOfLines={1} style={{ fontSize: T.lg, lineHeight: T.lg * 1.3 }}>
        {noteTitle(note.body)}
      </Type>
      {/* Vorschau links in voller Breite, Datum ruhig rechts außen. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <Type variant="caption" tone="text2" numberOfLines={1} style={{ flex: 1 }}>
          {preview || ' '}
        </Type>
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
      renderLeftActions={() => (
        <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: Spacing.md, minWidth: 96 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <Pin size={15} color={colors.teal} strokeWidth={2.2} />
            <Type variant="label" tone="teal">{note.pinned ? 'Lösen' : 'Anheften'}</Type>
          </View>
        </View>
      )}
      renderRightActions={() => (
        <View style={{ justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: Spacing.md, minWidth: 96 }}>
          <Type variant="label" tone="indigo">Löschen</Type>
        </View>
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
      style={{ paddingVertical: Spacing.sm, gap: 2, backgroundColor: colors.bg2 }}
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
      renderRightActions={() => (
        <View style={{ justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: Spacing.md, minWidth: 120 }}>
          <Type variant="label" tone="indigo">Endgültig löschen</Type>
        </View>
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
