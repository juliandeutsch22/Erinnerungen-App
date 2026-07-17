// LinkedNotes.tsx — „Notizen"-Sektion in Aufgaben- und Termin-Editor:
// verknüpfte Notizen auflisten (Tippen öffnet den Vollbild-Editor) und
// direkt eine neue Notiz mit Verknüpfung anlegen.
import { useRouter } from 'expo-router';
import { ChevronRight, NotebookPen, Plus } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useCreateNote, useNotes } from '@/data/noteQueries';
import { hapticSuccess } from '@/lib/haptics';
import { noteTitle } from '@/lib/noteLogic';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export function LinkedNotes({
  taskId,
  eventId,
  onNavigate,
}: {
  taskId?: string;
  eventId?: string;
  /** Wird vor dem Navigieren gerufen (Sheet schließen). */
  onNavigate: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const { data: notes } = useNotes();
  const createNote = useCreateNote();

  const linked = useMemo(
    () =>
      (notes ?? []).filter(
        (n) => n.deletedAt === null && ((taskId ? n.taskId === taskId : false) || (eventId ? n.eventId === eventId : false)),
      ),
    [notes, taskId, eventId],
  );

  const openNote = (id: string) => {
    onNavigate();
    router.push(`/notiz/${id}`);
  };

  const addNote = () => {
    hapticSuccess();
    createNote.mutate(
      { taskId: taskId ?? null, eventId: eventId ?? null },
      { onSuccess: (note) => openNote(note.id) },
    );
  };

  return (
    <View style={{ gap: Spacing.xs }}>
      <Type variant="eyebrow" tone="text3">Notizen</Type>
      {linked.map((n) => (
        <PressableScale
          key={n.id}
          accessibilityLabel={`Notiz „${noteTitle(n.body)}" öffnen`}
          onPress={() => openNote(n.id)}
          pressedScale={0.99}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 }}
        >
          <NotebookPen size={16} color={colors.text3} strokeWidth={2} />
          <Type variant="body" numberOfLines={1} style={{ flex: 1 }}>{noteTitle(n.body)}</Type>
          <ChevronRight size={15} color={colors.text3} strokeWidth={2} />
        </PressableScale>
      ))}
      <PressableScale
        accessibilityLabel="Neue Notiz anlegen"
        onPress={addNote}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 }}
      >
        <View style={{ width: 16, alignItems: 'center' }}>
          <Plus size={16} color={colors.teal} strokeWidth={2.2} />
        </View>
        <Type variant="label" tone="teal">Neue Notiz</Type>
      </PressableScale>
    </View>
  );
}
