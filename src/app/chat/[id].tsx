// chat/[id].tsx — Vollbild-Chat mit dem Assistenten. Nachrichten-Verlauf auf
// der Schreibtafel, Eingabezeile unten, Antworten kommen von Gemini (eigener
// Schlüssel, direkt vom Gerät — kein Mittelsmann). URLs in Antworten sind
// tappbar (z. B. vorbefüllte Airbnb-/Booking-Suchen). Der Termin-Kontext
// steckt als Snapshot im Chat und wandert in die System-Instruction.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUp, CalendarDays, ChevronLeft, ListTodo, NotebookPen, Sparkles, Trash2 } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { keyboardDoneProps, KeyboardDoneBar } from '@/components/KeyboardDone';
import { PressableScale } from '@/components/PressableScale';
import { LoadingState } from '@/components/StateView';
import { Type } from '@/components/Type';
import { useAppendMessage, useChatMessages, useChats, useDeleteChat, useUpdateChat } from '@/data/chatQueries';
import { useNotes } from '@/data/noteQueries';
import { useTasks } from '@/data/queries';
import type { ChatMessage } from '@/data/types';
import { askAssistant, buildNoteContext, buildTaskContext } from '@/lib/assistant';
import { noteTitle } from '@/lib/noteLogic';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';
import { useSettings } from '@/theme/settings.store';

const URL_RE = /(https?:\/\/[^\s)\]}"']+)/g;

/** Markdown-light: **fett** innerhalb eines Textstücks rendern. */
function boldParts(text: string, keyPrefix: number): React.ReactNode[] {
  return text.split(/\*\*([^*]+)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <Text key={`${keyPrefix}-${i}`} style={{ fontWeight: '700' }}>
        {part}
      </Text>
    ) : (
      part
    ),
  );
}

/** Nachrichtentext mit tappbaren Links + **fett** rendern. */
function LinkedText({ content, color }: { content: string; color: string }) {
  const parts = content.split(URL_RE);
  return (
    <Type variant="body" style={{ lineHeight: T.md * 1.5 }}>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <Text
            key={i}
            style={{ color, textDecorationLine: 'underline' }}
            onPress={() => void Linking.openURL(part)}
          >
            {part.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}
          </Text>
        ) : (
          boldParts(part, i)
        ),
      )}
    </Type>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: chats } = useChats();
  const { data: messages } = useChatMessages(id);
  const appendMessage = useAppendMessage();
  const updateChat = useUpdateChat();
  const deleteChat = useDeleteChat();
  const apiKey = useSettings((s) => s.geminiApiKey);

  const chat = (chats ?? []).find((c) => c.id === id);

  // Live-Kontext: Notiz/Aufgabe werden bei JEDEM Senden frisch gelesen —
  // der Assistent arbeitet immer mit dem aktuellen Inhalt.
  const { data: notes } = useNotes();
  const { data: tasks } = useTasks();
  const linkedNote = chat?.noteId ? (notes ?? []).find((n) => n.id === chat.noteId) : undefined;
  const linkedTask = chat?.taskId ? (tasks ?? []).find((t) => t.id === chat.taskId) : undefined;
  const effectiveContext = linkedNote
    ? buildNoteContext(linkedNote)
    : linkedTask
      ? buildTaskContext(linkedTask)
      : (chat?.context ?? null);
  const contextLabel = linkedNote
    ? noteTitle(linkedNote.body)
    : linkedTask
      ? linkedTask.title
      : chat?.context
        ? chat.context.split('\n')[0].replace('Termin: ', '')
        : null;
  const ContextIcon = linkedNote ? NotebookPen : linkedTask ? ListTodo : CalendarDays;

  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Bei neuen Nachrichten ans Ende scrollen.
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages?.length, pending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !id || !chat || pending) return;
    setDraft('');
    setError(null);
    hapticSelect();
    const userMsg = await appendMessage.mutateAsync({ chatId: id, role: 'user', content: text });
    // Titel = erste Nutzer-Nachricht (gekürzt) — wie bei Notizen die erste Zeile.
    if ((messages ?? []).length === 0 && chat.title === 'Neuer Chat') {
      updateChat.mutate({ id, patch: { title: text.length > 60 ? `${text.slice(0, 59)}…` : text } });
    }
    setPending(true);
    try {
      const history: ChatMessage[] = [...(messages ?? []), userMsg];
      const answer = await askAssistant(apiKey, history, effectiveContext);
      await appendMessage.mutateAsync({ chatId: id, role: 'assistant', content: answer });
      hapticSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setPending(false);
    }
  };

  const remove = () => {
    hapticSelect();
    if (id) deleteChat.mutate(id);
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Kopf */}
        <View
          style={{
            paddingTop: insets.top + Spacing.sm,
            paddingHorizontal: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm }}>
            <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
          </PressableScale>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Type variant="label" numberOfLines={1}>{chat?.title ?? 'Chat'}</Type>
            {contextLabel && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ContextIcon size={11} color={colors.text3} strokeWidth={2} />
                <Type variant="caption" tone="text3" numberOfLines={1}>
                  {contextLabel}
                </Type>
              </View>
            )}
          </View>
          <PressableScale accessibilityLabel="Chat löschen" onPress={remove} style={{ padding: Spacing.sm }}>
            <Trash2 size={20} color={colors.text3} strokeWidth={2} />
          </PressableScale>
        </View>

        {/* Verlauf */}
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.md, gap: Spacing.sm }}
        >
          {(messages ?? []).length === 0 && !pending && (
            <View style={{ alignItems: 'center', paddingTop: Spacing.xxl, gap: Spacing.sm }}>
              <Sparkles size={22} color={colors.teal} strokeWidth={2} />
              <Type variant="caption" tone="text3" style={{ textAlign: 'center', paddingHorizontal: Spacing.lg }}>
                {linkedNote
                  ? 'Der Assistent liest die Notiz live mit — bitte ihn z. B. um Zusammenfassung, Struktur oder nächste Schritte.'
                  : linkedTask
                    ? 'Der Assistent kennt die Erinnerung samt Details — frag nach einem Plan, Teilschritten oder Formulierungen.'
                    : effectiveContext
                      ? 'Der Assistent kennt den Termin bereits — frag z. B. nach einer Unterkunft, Restaurants oder einer Packliste.'
                      : 'Frag den Assistenten — ohne Verknüpfung antwortet er allgemein.'}
              </Type>
            </View>
          )}
          {(messages ?? []).map((m) => (
            <View
              key={m.id}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                backgroundColor: m.role === 'user' ? `${colors.teal}1A` : colors.bg2,
                borderWidth: 1,
                borderColor: m.role === 'user' ? `${colors.teal}33` : colors.border,
                borderRadius: R.lg,
                paddingVertical: Spacing.sm,
                paddingHorizontal: Spacing.md,
              }}
            >
              <LinkedText content={m.content} color={colors.teal} />
            </View>
          ))}
          {pending && <LoadingState label="Assistent denkt…" />}
          {error && (
            <Type variant="caption" tone="indigo" style={{ paddingHorizontal: Spacing.sm }}>
              {error}
            </Type>
          )}
        </ScrollView>

        {/* Eingabe */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.md,
            paddingBottom: insets.bottom + Spacing.sm,
            paddingTop: Spacing.xs,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: colors.bg2,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: R.xl,
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={apiKey ? 'Frag den Assistenten…' : 'Erst Schlüssel in den Einstellungen hinterlegen'}
              placeholderTextColor={colors.text3}
              editable={apiKey.length > 0 && !pending}
              multiline
              accessibilityLabel="Nachricht an den Assistenten"
              {...keyboardDoneProps}
              style={[{ fontSize: T.md, color: colors.text, maxHeight: 110, paddingVertical: 2 }, webNoOutline]}
            />
          </View>
          <PressableScale
            accessibilityLabel="Senden"
            onPress={() => void send()}
            disabled={draft.trim().length === 0 || pending || apiKey.length === 0}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: draft.trim().length > 0 && !pending && apiKey ? colors.teal : colors.bg3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowUp size={20} color={draft.trim().length > 0 && !pending && apiKey ? '#FFFFFF' : colors.text3} strokeWidth={2.4} />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
      <KeyboardDoneBar />
    </View>
  );
}
