// chats.tsx — Liste der Assistenten-Chats (neueste Aktivität zuerst).
// Plus legt einen freien Chat an; Chats mit Termin-Verknüpfung tragen einen
// Kalender-Glyph. Swipe links = löschen. Ohne API-Schlüssel erklärt die
// Seite die Einrichtung (Feature ist strikt opt-in).
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft, ListTodo, NotebookPen, Plus, Sparkles } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { DisclosureChevron } from '@/components/DisclosureChevron';
import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState } from '@/components/StateView';
import { SwipeActionSlide } from '@/components/SwipeActionSlide';
import { Type } from '@/components/Type';
import { useDeviceEvents } from '@/data/calendarQueries';
import { useChats, useCreateChat, useDeleteChat, useUpdateChat } from '@/data/chatQueries';
import { useTasks } from '@/data/queries';
import type { Chat } from '@/data/types';
import { addDays, formatDueDate, parseDateStr, toDateStr, todayStr } from '@/lib/dates';
import { hasCalendarPermission } from '@/lib/deviceCalendar';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { isOpen } from '@/lib/taskLogic';
import { useSettings } from '@/theme/settings.store';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing, T } from '@/theme/theme.tokens';

export default function ChatsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: chats } = useChats();
  const createChat = useCreateChat();
  const deleteChat = useDeleteChat();
  const apiKey = useSettings((s) => s.geminiApiKey);
  const today = todayStr();

  // Papierkorb (30 Tage, wie bei Notizen): aktiv / kürzlich gelöscht / abgelaufen.
  const cutoff = addDays(today, -30);
  const active = useMemo(() => (chats ?? []).filter((c) => c.deletedAt === null), [chats]);
  const trash = useMemo(
    () => (chats ?? []).filter((c) => c.deletedAt !== null && toDateStr(new Date(c.deletedAt)) >= cutoff),
    [chats, cutoff],
  );
  const [showTrash, setShowTrash] = useState(false);
  const purged = useRef(false);
  useEffect(() => {
    if (purged.current || !chats) return;
    const expired = chats.filter((c) => c.deletedAt !== null && toDateStr(new Date(c.deletedAt)) < cutoff);
    if (expired.length === 0) return;
    purged.current = true;
    for (const c of expired) deleteChat.mutate(c.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, cutoff]);

  const openNew = () => {
    hapticSuccess();
    createChat.mutate({}, { onSuccess: (chat) => router.push(`/chat/${chat.id}`) });
  };

  // „Plane meinen Tag": Chat mit den heutigen Aufgaben + Terminen als Kontext.
  const { data: tasks } = useTasks();
  const [calGranted, setCalGranted] = useState(false);
  useEffect(() => {
    void hasCalendarPermission().then(setCalGranted);
  }, []);
  const { data: todayEvents } = useDeviceEvents(today, addDays(today, 1), calGranted);

  const planMyDay = () => {
    hapticSuccess();
    const openToday = (tasks ?? []).filter((t) => isOpen(t) && t.dueDate === today);
    const dateLabel = parseDateStr(today).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const lines = [`Heute ist ${dateLabel}.`];
    const events = (todayEvents ?? []).filter((e) => toDateStr(e.start) === today && !e.allDay);
    if (events.length > 0) {
      lines.push('Feste Termine heute:');
      for (const e of events) {
        const t = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        lines.push(`- ${t(e.start)}–${t(e.end)}: ${e.title}`);
      }
    }
    if (openToday.length > 0) {
      lines.push('Offene Aufgaben für heute:');
      for (const t of openToday) lines.push(`- ${t.title}${t.dueTime ? ` (geplant ${t.dueTime})` : ''}`);
    }
    if (events.length === 0 && openToday.length === 0) lines.push('Es sind keine Termine oder Aufgaben eingetragen.');
    createChat.mutate(
      { title: `Tagesplan · ${dateLabel}`, context: lines.join('\n') },
      {
        onSuccess: (chat) =>
          router.push(
            `/chat/${chat.id}?ask=${encodeURIComponent('Erstelle mir einen realistischen Tagesplan mit Uhrzeiten. Termine sind Fixpunkte, plane Pausen ein und schlage vor, welche Aufgabe in welche Lücke passt.')}`,
          ),
      },
    );
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
          {active.length === 1 ? '1 Chat' : `${active.length} Chats`}
        </Type>
      </Reveal>

      {apiKey.length > 0 && (
        <Reveal delay={60}>
          <GlassPanel>
            <PressableScale
              accessibilityLabel="Plane meinen Tag"
              onPress={planMyDay}
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}
            >
              <Sparkles size={18} color={colors.teal} strokeWidth={2.2} />
              <View style={{ flex: 1 }}>
                <Type variant="label" tone="teal">Plane meinen Tag</Type>
                <Type variant="caption" tone="text3">
                  Der Assistent kennt deine heutigen Termine und Aufgaben und schlägt eine Reihenfolge vor.
                </Type>
              </View>
            </PressableScale>
          </GlassPanel>
        </Reveal>
      )}

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
          ) : active.length === 0 && trash.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={20} color={colors.teal} strokeWidth={2} />}
              title="Noch keine Chats"
              body="Starte mit dem Plus — oder aus einem Termin heraus, dann kennt der Assistent Ort und Daten gleich mit."
            />
          ) : (
            <>
              {active.map((c, i) => (
                <View key={c.id}>
                  {i > 0 && <Seam marginVertical={2} />}
                  <ChatRow chat={c} today={today} onPress={() => router.push(`/chat/${c.id}`)} />
                </View>
              ))}
              {trash.length > 0 && (
                <>
                  {active.length > 0 && <Seam variant="ornament" marginVertical={Spacing.md} />}
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
                      {trash.map((c) => (
                        <TrashChatRow key={c.id} chat={c} today={today} />
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

function ChatRow({ chat, today, onPress }: { chat: Chat; today: string; onPress: () => void }) {
  const colors = useColors();
  const updateChat = useUpdateChat();
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
        updateChat.mutate({ id: chat.id, patch: { deletedAt: new Date().toISOString() } });
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

/** Papierkorb-Zeile: Tippen stellt wieder her, Swipe links löscht endgültig. */
function TrashChatRow({ chat, today }: { chat: Chat; today: string }) {
  const colors = useColors();
  const updateChat = useUpdateChat();
  const deleteChat = useDeleteChat();
  const swipeRef = useRef<SwipeableMethods>(null);
  const deletedLabel = chat.deletedAt ? formatDueDate(toDateStr(new Date(chat.deletedAt)), today) : '';

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
        deleteChat.mutate(chat.id);
      }}
    >
      <PressableScale
        accessibilityLabel={`Chat „${chat.title}" wiederherstellen`}
        onPress={() => {
          hapticSuccess();
          updateChat.mutate({ id: chat.id, patch: { deletedAt: null } });
        }}
        pressedScale={0.99}
        style={{ paddingVertical: Spacing.sm, gap: 2, backgroundColor: 'transparent' }}
      >
        <Type variant="body" tone="text2" numberOfLines={1}>{chat.title}</Type>
        <Type variant="caption" tone="text3" tabular>Gelöscht: {deletedLabel}</Type>
      </PressableScale>
    </ReanimatedSwipeable>
  );
}
