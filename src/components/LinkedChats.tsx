// LinkedChats.tsx — „Chats"-Sektion in Notiz-/Aufgaben-/Termin-Editoren:
// verknüpfte Assistenten-Chats auflisten (Tippen öffnet den Chat) und direkt
// einen neuen mit Verknüpfung starten. Ohne API-Schlüssel unsichtbar (opt-in).
import { useRouter } from 'expo-router';
import { ChevronRight, Plus, Sparkles } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useChats, useCreateChat } from '@/data/chatQueries';
import { hapticSuccess } from '@/lib/haptics';
import { useSettings } from '@/theme/settings.store';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export function LinkedChats({
  noteId,
  taskId,
  eventId,
  title,
  context,
  onNavigate,
}: {
  noteId?: string;
  taskId?: string;
  eventId?: string;
  /** Titel für einen NEUEN Chat (z. B. Aufgaben-/Termin-Titel). */
  title?: string;
  /** Kontext-Snapshot für neue Chats (nur Termine; Notizen/Aufgaben lesen live). */
  context?: string | null;
  /** Wird vor dem Navigieren gerufen (Sheet schließen / Editor sichern). */
  onNavigate: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const { data: chats } = useChats();
  const createChat = useCreateChat();
  const hasKey = useSettings((s) => s.geminiApiKey.length > 0);

  const linked = useMemo(
    () =>
      (chats ?? []).filter(
        (c) =>
          (noteId ? c.noteId === noteId : false) ||
          (taskId ? c.taskId === taskId : false) ||
          (eventId ? c.eventId === eventId : false),
      ),
    [chats, noteId, taskId, eventId],
  );

  if (!hasKey) return null;

  const openChat = (id: string) => {
    onNavigate();
    router.push(`/chat/${id}`);
  };

  const startChat = () => {
    hapticSuccess();
    createChat.mutate(
      { title, noteId: noteId ?? null, taskId: taskId ?? null, eventId: eventId ?? null, context: context ?? null },
      { onSuccess: (c) => openChat(c.id) },
    );
  };

  return (
    <View style={{ gap: Spacing.xs }}>
      <Type variant="eyebrow" tone="text3">Assistent</Type>
      {linked.map((c) => (
        <PressableScale
          key={c.id}
          accessibilityLabel={`Chat „${c.title}" öffnen`}
          onPress={() => openChat(c.id)}
          pressedScale={0.99}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 }}
        >
          <Sparkles size={16} color={colors.text3} strokeWidth={2} />
          <Type variant="body" numberOfLines={1} style={{ flex: 1 }}>{c.title}</Type>
          <ChevronRight size={15} color={colors.text3} strokeWidth={2} />
        </PressableScale>
      ))}
      <PressableScale
        accessibilityLabel="Neuen Chat mit dem Assistenten starten"
        onPress={startChat}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 }}
      >
        <View style={{ width: 16, alignItems: 'center' }}>
          <Plus size={16} color={colors.teal} strokeWidth={2.2} />
        </View>
        <Type variant="label" tone="teal">Assistent fragen</Type>
      </PressableScale>
    </View>
  );
}
