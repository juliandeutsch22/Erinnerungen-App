// notizen.tsx — Notizen-Tab: Liste aller Notizen (neueste Bearbeitung zuerst),
// iOS-Notizen-Muster: Titel = erste Zeile, Vorschau darunter, Tippen öffnet
// den Vollbild-Editor, Plus legt sofort eine leere Notiz an und springt hinein.
// Swipe links = löschen (zweistufig über Bestätigen im Editor unnötig — die
// Geste ist explizit genug, wie in iOS Notes).
import { useRouter } from 'expo-router';
import { NotebookPen, Plus } from 'lucide-react-native';
import React, { useRef } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState, LoadingState } from '@/components/StateView';
import { Type } from '@/components/Type';
import { useCreateNote, useDeleteNote, useNotes } from '@/data/noteQueries';
import type { Note } from '@/data/types';
import { formatDueDate, toDateStr, todayStr } from '@/lib/dates';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { notePreview, noteTitle } from '@/lib/noteLogic';
import { TAB_BAR_SAFE_BOTTOM } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing, T } from '@/theme/theme.tokens';

export default function NotizenScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: notes, isLoading } = useNotes();
  const createNote = useCreateNote();
  const today = todayStr();

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
              {(notes ?? []).length === 1 ? '1 Notiz' : `${(notes ?? []).length} Notizen`}
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
          ) : (notes ?? []).length === 0 ? (
            <EmptyState
              icon={<NotebookPen size={20} color={colors.teal} strokeWidth={2} />}
              title="Noch keine Notizen"
              body="Gedanken, Ideen, Mitschriften — alles, was keine Aufgabe ist. Tippe auf das Plus."
            />
          ) : (
            (notes ?? []).map((n, i) => (
              <View key={n.id}>
                {i > 0 && <Seam marginVertical={Spacing.sm} />}
                <NoteRow note={n} today={today} onPress={() => router.push(`/notiz/${n.id}`)} />
              </View>
            ))
          )}
        </GlassPanel>
      </Reveal>
    </Screen>
  );
}

/** Eine Notiz-Zeile: Titel (Antiqua) + Datum · Vorschau. Swipe links = löschen. */
function NoteRow({ note, today, onPress }: { note: Note; today: string; onPress: () => void }) {
  const colors = useColors();
  const deleteNote = useDeleteNote();
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
      <Type variant="heading" numberOfLines={1} style={{ fontSize: T.lg, lineHeight: T.lg * 1.3 }}>
        {noteTitle(note.body)}
      </Type>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <Type variant="caption" tone="text3" tabular>{dateLabel}</Type>
        {preview ? (
          <Type variant="caption" tone="text2" numberOfLines={1} style={{ flexShrink: 1 }}>
            {preview}
          </Type>
        ) : null}
      </View>
    </PressableScale>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={56}
      overshootRight={false}
      renderRightActions={() => (
        <View style={{ justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: Spacing.md, minWidth: 96 }}>
          <Type variant="label" tone="indigo">Löschen</Type>
        </View>
      )}
      onSwipeableWillOpen={(direction) => {
        swipeRef.current?.close();
        if (direction === 'right') {
          hapticSelect();
          deleteNote.mutate(note.id);
        }
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}
