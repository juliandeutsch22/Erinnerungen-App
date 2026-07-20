// chats.tsx — Liste der Assistenten-Chats (neueste Aktivität zuerst).
// Plus legt einen freien Chat an; Chats mit Termin-Verknüpfung tragen einen
// Kalender-Glyph. Swipe links = löschen. Ohne API-Schlüssel erklärt die
// Seite die Einrichtung (Feature ist strikt opt-in).
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft, ListTodo, NotebookPen, Plus, Sparkles } from 'lucide-react-native';
import React, { useRef } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState } from '@/components/StateView';
import { SwipeActionSlide } from '@/components/SwipeActionSlide';
import { Type } from '@/components/Type';
import { useChats, useCreateChat, useDeleteChat } from '@/data/chatQueries';
import type { Chat } from '@/data/types';
import { formatDueDate, toDateStr, todayStr } from '@/lib/dates';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { useSettings } from '@/theme/settings.store';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing, T } from '@/theme/theme.tokens';

export default function ChatsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: chats } = useChats();
  const createChat = useCreateChat();
  const apiKey = useSettings((s) => s.geminiApiKey);
  const today = todayStr();

  const openNew = () => {
    hapticSuccess();
    createChat.mutate({}, { onSuccess: (chat) => router.push(`/chat/${chat.id}`) });
  };

  return (
    <Screen withTabBar={false}>
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm, marginLeft: -Spacing.sm }}>
            <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
          </PressableScale>
          {apiKey.length > 0 && (
            <PressableScale accessibilityLabel="Neuer Chat" onPress={openNew} style={{ padding: Spacing.sm }}>
              <Plus size={22} color={colors.teal} strokeWidth={2.2} />
            </PressableScale>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
          <Sparkles size={24} color={colors.teal} strokeWidth={2} />
          <Type variant="title">Assistent</Type>
        </View>
        <Type variant="caption" tone="text3" style={{ marginTop: 2 }} tabular>
          {(chats ?? []).length === 1 ? '1 Chat' : `${(chats ?? []).length} Chats`}
        </Type>
      </Reveal>

      <Reveal delay={90}>
        <GlassPanel>
          {apiKey.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={20} color={colors.teal} strokeWidth={2} />}
              title="Assistent einrichten"
              body={
                'Der Assistent nutzt deinen eigenen Google-Gemini-Schlüssel (dauerhaft kostenloses Kontingent, keine Kreditkarte). ' +
                'Erstelle ihn auf aistudio.google.com/apikey und füge ihn in den Einstellungen unter „Assistent" ein. ' +
                'Ohne Schlüssel bleibt die App vollständig offline.'
              }
            />
          ) : (chats ?? []).length === 0 ? (
            <EmptyState
              icon={<Sparkles size={20} color={colors.teal} strokeWidth={2} />}
              title="Noch keine Chats"
              body="Starte mit dem Plus — oder aus einem Termin heraus, dann kennt der Assistent Ort und Daten gleich mit."
            />
          ) : (
            (chats ?? []).map((c, i) => (
              <View key={c.id}>
                {i > 0 && <Seam marginVertical={2} />}
                <ChatRow chat={c} today={today} onPress={() => router.push(`/chat/${c.id}`)} />
              </View>
            ))
          )}
        </GlassPanel>
      </Reveal>
    </Screen>
  );
}

function ChatRow({ chat, today, onPress }: { chat: Chat; today: string; onPress: () => void }) {
  const colors = useColors();
  const deleteChat = useDeleteChat();
  const swipeRef = useRef<SwipeableMethods>(null);
  const dateLabel = formatDueDate(toDateStr(new Date(chat.updatedAt)), today);

  const row = (
    <PressableScale
      accessibilityLabel={`Chat „${chat.title}" öffnen`}
      onPress={onPress}
      pressedScale={0.99}
      style={{ paddingVertical: Spacing.sm, gap: 2, backgroundColor: 'transparent' }}
    >
      <Type variant="heading" numberOfLines={1} style={{ fontSize: T.lg, lineHeight: T.lg * 1.3 }}>
        {chat.title}
      </Type>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        {chat.eventId && <CalendarDays size={12} color={colors.text3} strokeWidth={2} />}
        {chat.noteId && <NotebookPen size={12} color={colors.text3} strokeWidth={2} />}
        {chat.taskId && <ListTodo size={12} color={colors.text3} strokeWidth={2} />}
        <View style={{ flex: 1 }} />
        <Type variant="caption" tone="text3" tabular>{dateLabel}</Type>
      </View>
    </PressableScale>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={56}
      overshootRight={false}
      renderRightActions={(_progress, translation) => (
        <SwipeActionSlide side="right" width={96} translation={translation} color={colors.indigo}>
          <Type variant="label" style={{ color: '#FFFFFF', fontSize: T.sm }}>Löschen</Type>
        </SwipeActionSlide>
      )}
      onSwipeableWillOpen={() => {
        swipeRef.current?.close();
        hapticSelect();
        deleteChat.mutate(chat.id);
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}
