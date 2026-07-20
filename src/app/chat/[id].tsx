// chat/[id].tsx — Vollbild-Chat mit dem Assistenten. Nachrichten-Verlauf auf
// der Schreibtafel, Eingabezeile unten, Antworten kommen von Gemini (eigener
// Schlüssel, direkt vom Gerät — kein Mittelsmann). URLs in Antworten sind
// tappbar (z. B. vorbefüllte Airbnb-/Booking-Suchen). Der Termin-Kontext
// steckt als Snapshot im Chat und wandert in die System-Instruction.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUp, CalendarDays, ChevronLeft, Link2, ListTodo, NotebookPen, Sparkles, Trash2 } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { ChatLinkSheet } from '@/components/ChatLinkSheet';
import { keyboardDoneProps, KeyboardDoneBar } from '@/components/KeyboardDone';
import { PressableScale } from '@/components/PressableScale';
import { LoadingState } from '@/components/StateView';
import { Type } from '@/components/Type';
import * as Clipboard from 'expo-clipboard';

import { useDeviceEvents } from '@/data/calendarQueries';
import { useAppendMessage, useChatMessages, useChats, useDeleteChat, useUpdateChat } from '@/data/chatQueries';
import { useCreateNote, useNotes, useUpdateNote } from '@/data/noteQueries';
import { useCreateTask, useLists, useTasks } from '@/data/queries';
import type { ChatMessage } from '@/data/types';
import { askAssistant, buildAppContext, buildNoteContext, buildTaskContext, extractActions } from '@/lib/assistant';
import { addDays, todayStr } from '@/lib/dates';
import { hasCalendarPermission } from '@/lib/deviceCalendar';
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
  const { id, ask } = useLocalSearchParams<{ id: string; ask?: string }>();
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
  const { data: lists } = useLists();

  // App-Schnappschuss (abschaltbar in den Einstellungen): Termine der
  // nächsten ~5 Wochen + offene Aufgaben + Listen + Notiz-Titel. Das Journal
  // bleibt bewusst außen vor.
  const assistantContextEnabled = useSettings((s) => s.assistantContextEnabled);
  const [calGranted, setCalGranted] = useState(false);
  useEffect(() => {
    void hasCalendarPermission().then(setCalGranted);
  }, []);
  const today = todayStr();
  const { data: events } = useDeviceEvents(today, addDays(today, 35), calGranted && assistantContextEnabled);
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
  const [linkSheet, setLinkSheet] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNoteIds, setSavedNoteIds] = useState<Set<string>>(new Set());
  const [appliedActionIds, setAppliedActionIds] = useState<Set<string>>(new Set());
  const createNote = useCreateNote();
  const createTask = useCreateTask();
  const updateNote = useUpdateNote();
  const scrollRef = useRef<ScrollView>(null);
  const listHeight = useRef(0);

  /** Aktions-Block übernehmen: Aufgaben anlegen, Checkliste an die Notiz anhängen. */
  const applyActions = async (m: ChatMessage) => {
    const { actions } = extractActions(m.content);
    if (!actions) return;
    hapticSuccess();
    for (const a of actions.aufgaben) {
      await createTask.mutateAsync({
        listId: 'default',
        title: a.titel,
        dueDate: a.datum ?? null,
        dueTime: a.zeit ?? null,
        eventId: chat?.eventId ?? null,
      });
    }
    if (actions.checkliste.length > 0 && linkedNote) {
      const lines = actions.checkliste.map((c) => `- [ ] ${c}`).join('\n');
      updateNote.mutate({ id: linkedNote.id, patch: { body: `${linkedNote.body}\n${lines}` } });
    }
    for (const n of actions.notizen) {
      await createNote.mutateAsync({ body: n, taskId: chat?.taskId ?? null, eventId: chat?.eventId ?? null });
    }
    setAppliedActionIds((prev) => new Set(prev).add(m.id));
  };

  /** Antwort holen für einen gegebenen Verlauf (send + retry teilen sich das). */
  const requestAnswer = async (history: ChatMessage[]) => {
    if (!id) return;
    setPending(true);
    setError(null);
    try {
      const appContext = assistantContextEnabled
        ? buildAppContext({ events: events ?? [], tasks: tasks ?? [], lists: lists ?? [], notes: notes ?? [], today })
        : null;
      const combined = [effectiveContext, appContext].filter(Boolean).join('\n\n') || null;
      const answer = await askAssistant(apiKey, history, combined);
      await appendMessage.mutateAsync({ chatId: id, role: 'assistant', content: answer });
      hapticSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setPending(false);
    }
  };

  /** Erneut versuchen: der Verlauf endet bereits mit der Nutzer-Nachricht. */
  const retry = () => {
    if ((messages ?? []).length === 0 || pending) return;
    void requestAnswer(messages ?? []);
  };

  const copyMessage = async (content: string) => {
    await Clipboard.setStringAsync(content);
    hapticSelect();
  };

  const saveAsNote = (m: ChatMessage) => {
    hapticSuccess();
    createNote.mutate(
      { body: extractActions(m.content).clean, taskId: chat?.taskId ?? null, eventId: chat?.eventId ?? null },
      { onSuccess: () => setSavedNoteIds((prev) => new Set(prev).add(m.id)) },
    );
  };

  // Bei neuen Nachrichten ans Ende scrollen.
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages?.length, pending]);

  // Tastatur klappt auf → der Verlauf schrumpft, die letzten Nachrichten dürfen
  // nicht dahinter verschwinden: beim Öffnen mitscrollen, nach der Animation
  // (didShow) einmal exakt ans Ende korrigieren.
  useEffect(() => {
    const subs = [
      ...(Platform.OS === 'ios'
        ? [Keyboard.addListener('keyboardWillShow', () => scrollRef.current?.scrollToEnd({ animated: true }))]
        : []),
      Keyboard.addListener('keyboardDidShow', () => scrollRef.current?.scrollToEnd({ animated: false })),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || !id || !chat || pending) return;
    setDraft('');
    setError(null);
    hapticSelect();
    const userMsg = await appendMessage.mutateAsync({ chatId: id, role: 'user', content: text });
    // Titel = erste Nutzer-Nachricht (gekürzt) — wie bei Notizen die erste Zeile.
    if ((messages ?? []).length === 0 && chat.title === 'Neuer Chat') {
      updateChat.mutate({ id, patch: { title: text.length > 60 ? `${text.slice(0, 59)}…` : text } });
    }
    await requestAnswer([...(messages ?? []), userMsg]);
  };
  const send = () => sendText(draft);

  // „Plane meinen Tag" & Co.: mitgegebene Frage einmalig automatisch senden.
  const autoAsked = useRef(false);
  useEffect(() => {
    if (!ask || autoAsked.current || !chat || !messages || messages.length > 0 || pending) return;
    autoAsked.current = true;
    void sendText(ask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask, chat?.id, messages?.length]);

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
              <PressableScale
                accessibilityLabel={`Verknüpfte Quelle ${contextLabel} öffnen`}
                disabled={!linkedNote && !linkedTask}
                onPress={() => {
                  if (linkedNote) router.push(`/notiz/${linkedNote.id}`);
                  else if (linkedTask) router.push(`/aufgabe/${linkedTask.id}`);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <ContextIcon size={11} color={colors.text3} strokeWidth={2} />
                <Type variant="caption" tone={linkedNote || linkedTask ? 'teal' : 'text3'} numberOfLines={1}>
                  {contextLabel}
                </Type>
              </PressableScale>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PressableScale
              accessibilityLabel="Chat zuweisen"
              onPress={() => {
                hapticSelect();
                setLinkSheet(true);
              }}
              style={{ padding: Spacing.sm }}
            >
              <Link2 size={20} color={colors.text3} strokeWidth={2} />
            </PressableScale>
            <PressableScale accessibilityLabel="Chat löschen" onPress={remove} style={{ padding: Spacing.sm }}>
              <Trash2 size={20} color={colors.text3} strokeWidth={2} />
            </PressableScale>
          </View>
        </View>

        {/* Verlauf */}
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // Schrumpft die Fläche (Tastatur, wachsende Eingabezeile), ans Ende
          // nachziehen — nichts darf hinter der Tastatur liegen bleiben.
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h < listHeight.current) scrollRef.current?.scrollToEnd({ animated: false });
            listHeight.current = h;
          }}
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
          {(messages ?? []).map((m) => {
            const { clean, actions } = m.role === 'assistant' ? extractActions(m.content) : { clean: m.content, actions: null };
            return (
            <View key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
              <PressableScale
                accessibilityLabel={`Nachricht kopieren`}
                onLongPress={() => void copyMessage(clean)}
                pressedScale={0.99}
                style={{
                  backgroundColor: m.role === 'user' ? `${colors.teal}1A` : colors.bg2,
                  borderWidth: 1,
                  borderColor: m.role === 'user' ? `${colors.teal}33` : colors.border,
                  borderRadius: R.lg,
                  paddingVertical: Spacing.sm,
                  paddingHorizontal: Spacing.md,
                }}
              >
                <LinkedText content={clean} color={colors.teal} />
              </PressableScale>
              {/* Aktions-Karte: strukturierte Vorschläge mit einem Tipp übernehmen. */}
              {actions && (
                <View
                  style={{
                    marginTop: Spacing.xs,
                    borderWidth: 1,
                    borderColor: `${colors.teal}44`,
                    backgroundColor: `${colors.teal}0D`,
                    borderRadius: R.md,
                    padding: Spacing.sm,
                    gap: 3,
                  }}
                >
                  {actions.aufgaben.map((a, i) => (
                    <Type key={`a${i}`} variant="caption" tone="text2" numberOfLines={1}>
                      ☐ {a.titel}{a.datum ? ` · ${a.datum}` : ''}{a.zeit ? ` ${a.zeit}` : ''}
                    </Type>
                  ))}
                  {actions.checkliste.map((c, i) => (
                    <Type key={`c${i}`} variant="caption" tone="text2" numberOfLines={1}>
                      ☐ {c} <Type variant="caption" tone="text3">(Notiz-Checkliste)</Type>
                    </Type>
                  ))}
                  {actions.notizen.map((n, i) => (
                    <Type key={`n${i}`} variant="caption" tone="text2" numberOfLines={1}>
                      ✎ {n.split('\n')[0]} <Type variant="caption" tone="text3">(Notiz)</Type>
                    </Type>
                  ))}
                  <PressableScale
                    accessibilityLabel="Vorschläge übernehmen"
                    onPress={() => void applyActions(m)}
                    disabled={appliedActionIds.has(m.id)}
                    style={{ paddingTop: 4 }}
                  >
                    <Type variant="label" tone={appliedActionIds.has(m.id) ? 'text3' : 'teal'}>
                      {appliedActionIds.has(m.id)
                        ? 'Übernommen ✓'
                        : actions.aufgaben.length > 0
                          ? `${actions.aufgaben.length + actions.checkliste.length} ${actions.aufgaben.length + actions.checkliste.length === 1 ? 'Vorschlag' : 'Vorschläge'} übernehmen`
                          : 'In die Notiz-Checkliste übernehmen'}
                    </Type>
                  </PressableScale>
                </View>
              )}
              {/* Antworten lassen sich mit einem Tipp als Notiz ablegen —
                  inklusive der Verknüpfung des Chats (Aufgabe/Termin). */}
              {m.role === 'assistant' && (
                <PressableScale
                  accessibilityLabel="Antwort als Notiz speichern"
                  onPress={() => saveAsNote(m)}
                  disabled={savedNoteIds.has(m.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4, paddingLeft: Spacing.xs }}
                >
                  <NotebookPen size={12} color={savedNoteIds.has(m.id) ? colors.text3 : colors.teal} strokeWidth={2} />
                  <Type variant="caption" tone={savedNoteIds.has(m.id) ? 'text3' : 'teal'}>
                    {savedNoteIds.has(m.id) ? 'Als Notiz gespeichert ✓' : 'Als Notiz speichern'}
                  </Type>
                </PressableScale>
              )}
            </View>
            );
          })}
          {pending && <LoadingState label="Assistent denkt…" />}
          {error && (
            <View style={{ gap: Spacing.xs, paddingHorizontal: Spacing.sm }}>
              <Type variant="caption" tone="indigo">{error}</Type>
              <PressableScale accessibilityLabel="Erneut versuchen" onPress={retry} style={{ alignSelf: 'flex-start' }}>
                <Type variant="label" tone="teal">Erneut versuchen</Type>
              </PressableScale>
            </View>
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
      {linkSheet && id && <ChatLinkSheet chatId={id} onClose={() => setLinkSheet(false)} />}
    </View>
  );
}
