// chat/[id].tsx — Vollbild-Chat mit dem Assistenten. Der Verlauf liegt wie ein
// Briefwechsel direkt auf der Schreibtafel: Nutzer-Nachrichten als randlose
// tonale Teal-Fläche, Antworten als frei gesetzter Text (Markdown-Licht über
// MarkdownText — Listen, Überschriften, fett, tappbare Links). Antworten
// streamen Wort für Wort (SSE); während des Wartens atmen drei stille Punkte.
// Der Termin-Kontext steckt als Snapshot im Chat und wandert in die
// System-Instruction; Notiz/Aufgabe werden live mitgelesen.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUp, CalendarDays, Check, ChevronLeft, Link2, ListTodo, NotebookPen, Pencil, Sparkles, Trash2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { BottomSheet } from '@/components/BottomSheet';
import { ChatLinkSheet } from '@/components/ChatLinkSheet';
import { GlassButton } from '@/components/GlassButton';
import { keyboardDoneProps, KeyboardDoneBar } from '@/components/KeyboardDone';
import { Appear } from '@/components/Appear';
import { MarkdownText } from '@/components/MarkdownText';
import { MicButton } from '@/components/MicButton';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import * as Clipboard from 'expo-clipboard';

import { useDeviceEvents } from '@/data/calendarQueries';
import { useAppendMessage, useChatMessages, useChats, useUpdateChat } from '@/data/chatQueries';
import { useCreateNote, useNotes, useUpdateNote } from '@/data/noteQueries';
import { useCreateTask, useLists, useTasks } from '@/data/queries';
import type { Chat, ChatMessage } from '@/data/types';
import { askAssistant, type AssistantAction, buildAppContext, buildNoteContext, buildTaskContext, type ChatLink, extractActions, generateChatTitle, promptChips } from '@/lib/assistant';
import { addDays, formatDueDate, toDateStr, todayStr } from '@/lib/dates';
import { hasCalendarPermission } from '@/lib/deviceCalendar';
import { noteTitle } from '@/lib/noteLogic';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors, useReducedMotion } from '@/theme/ThemeProvider';
import { Dur } from '@/theme/motion.tokens';
import { R, Spacing, T } from '@/theme/theme.tokens';
import { useSettings } from '@/theme/settings.store';

const URL_RE = /(https?:\/\/[^\s)\]}"']+)/g;

/** Nutzer-Nachricht: schlichter, rechtsbündiger Text (editorialer Dialog),
 *  URLs bleiben tappbar. */
function UserText({ content, color }: { content: string; color: string }) {
  const parts = content.split(URL_RE);
  return (
    <Type variant="body" style={{ fontSize: T.md + 1, lineHeight: (T.md + 1) * 1.5, textAlign: 'right' }}>
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
          part
        ),
      )}
    </Type>
  );
}

/** Ein Punkt des Denk-Indikators — die Phase versetzt die Atmung. */
function ThinkingDot({ progress, phase, color }: { progress: SharedValue<number>; phase: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const v = (progress.value + phase) % 1;
    return { opacity: 0.2 + 0.55 * Math.sin(v * Math.PI) };
  });
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]} />;
}

/** Drei still atmende Punkte statt Spinner — der Assistent denkt nach. */
function ThinkingDots() {
  const colors = useColors();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    progress.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.linear }), -1, false);
  }, [reduced, progress]);

  if (reduced) {
    return (
      <View style={{ flexDirection: 'row', gap: 5, paddingVertical: Spacing.sm, paddingLeft: 2 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text3, opacity: 0.5 }} />
        ))}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: Spacing.sm, paddingLeft: 2 }}>
      {[0, 1, 2].map((i) => (
        <ThinkingDot key={i} progress={progress} phase={i * 0.18} color={colors.text2} />
      ))}
    </View>
  );
}

/** Aktionskarte: Vorschläge des Assistenten — einzeln abwählbar, ein Tipp übernimmt. */
function ActionCard({
  actions,
  applied,
  today,
  hasLinkedNote,
  onApply,
}: {
  actions: AssistantAction;
  applied: boolean;
  today: string;
  /** Ob der Chat an eine Notiz gehängt ist — sonst wird die Checkliste eine neue Notiz. */
  hasLinkedNote: boolean;
  onApply: (selected: AssistantAction) => void;
}) {
  const colors = useColors();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const included = (key: string) => !excluded.has(key);
  const toggle = (key: string) => {
    hapticSelect();
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selected: AssistantAction = {
    aufgaben: actions.aufgaben.filter((_, i) => included(`a${i}`)),
    checkliste: actions.checkliste.filter((_, i) => included(`c${i}`)),
    notizen: actions.notizen.filter((_, i) => included(`n${i}`)),
  };
  const count = selected.aufgaben.length + selected.checkliste.length + selected.notizen.length;

  const row = (key: string, label: string, sub: string | null) => {
    const on = included(key);
    return (
      <PressableScale
        key={key}
        accessibilityLabel={on ? `„${label}" abwählen` : `„${label}" auswählen`}
        disabled={applied}
        onPress={() => toggle(key)}
        pressedScale={0.99}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 4 }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            marginTop: 1,
            borderWidth: 1.5,
            borderColor: on ? colors.teal : colors.border2,
            backgroundColor: on ? colors.teal : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {on && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
        </View>
        <View style={{ flex: 1, opacity: on || applied ? 1 : 0.45 }}>
          <Type variant="body" style={{ fontSize: T.sm, lineHeight: T.sm * 1.4 }}>{label}</Type>
          {sub && (
            <Type variant="caption" tone="text3" style={{ marginTop: 1 }}>{sub}</Type>
          )}
        </View>
      </PressableScale>
    );
  };

  return (
    <View
      style={{
        marginTop: Spacing.sm,
        backgroundColor: `${colors.teal}12`,
        borderRadius: R.lg,
        padding: Spacing.md,
        gap: 2,
        alignSelf: 'stretch',
      }}
    >
      <Type variant="eyebrow" tone="text3" style={{ marginBottom: Spacing.xs }}>Vorschläge</Type>
      {actions.aufgaben.map((a, i) =>
        row(
          `a${i}`,
          a.titel,
          a.datum ? `${formatDueDate(a.datum, today)}${a.zeit ? ` · ${a.zeit} Uhr` : ''}` : a.zeit ? `${a.zeit} Uhr` : null,
        ),
      )}
      {actions.checkliste.map((c, i) => row(`c${i}`, c, hasLinkedNote ? 'Checkliste der Notiz' : 'Neue Notiz-Checkliste'))}
      {actions.notizen.map((n, i) => row(`n${i}`, n.split('\n')[0], 'Notiz'))}
      {applied ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: Spacing.xs }}>
          <Check size={13} color={colors.teal} strokeWidth={2.6} />
          <Type variant="label" tone="teal">Übernommen</Type>
        </View>
      ) : (
        <GlassButton
          accessibilityLabel="Ausgewählte Vorschläge übernehmen"
          size="sm"
          onPress={() => onApply(selected)}
          disabled={count === 0}
          style={{ marginTop: Spacing.sm }}
        >
          <Type variant="label" style={{ color: '#FFFFFF' }}>
            {count === 1 ? '1 Vorschlag übernehmen' : `${count} Vorschläge übernehmen`}
          </Type>
        </GlassButton>
      )}
    </View>
  );
}

/** Umbenennen-Sheet: der Titel gehört dem Nutzer, nicht der ersten Nachricht. */
function RenameSheet({ chat, onClose, onRenamed }: { chat: Chat; onClose: () => void; onRenamed: () => void }) {
  const colors = useColors();
  const updateChat = useUpdateChat();
  const [title, setTitle] = useState(chat.title);
  const save = () => {
    const t = title.trim();
    if (t.length > 0 && t !== chat.title) {
      hapticSuccess();
      onRenamed();
      updateChat.mutate({ id: chat.id, patch: { title: t } });
    }
    onClose();
  };
  return (
    <BottomSheet
      visible
      title="Chat umbenennen"
      onClose={onClose}
      footer={
        <GlassButton accessibilityLabel="Titel sichern" onPress={save} disabled={title.trim().length === 0}>
          <Type variant="label" style={{ color: '#FFFFFF' }}>Sichern</Type>
        </GlassButton>
      }
    >
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Titel des Chats"
        placeholderTextColor={colors.text3}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="Titel des Chats"
        style={[
          { fontSize: T.xl, fontWeight: '600', color: colors.text, paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
          webNoOutline,
        ]}
      />
    </BottomSheet>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, ask, dictate } = useLocalSearchParams<{ id: string; ask?: string; dictate?: string }>();
  const { data: chats } = useChats();
  const { data: messages } = useChatMessages(id);
  const appendMessage = useAppendMessage();
  const updateChat = useUpdateChat();
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
  const chatLink: ChatLink = linkedNote ? 'note' : linkedTask ? 'task' : effectiveContext ? 'event' : 'none';

  const [draft, setDraft] = useState('');
  // Diktat: der Feldstand vor dem Sprechen, an den das Transkript angehängt wird.
  const dictBaseRef = useRef('');
  const [dictating, setDictating] = useState(false);
  const [linkSheet, setLinkSheet] = useState(false);
  const [renameSheet, setRenameSheet] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNoteIds, setSavedNoteIds] = useState<Set<string>>(new Set());
  const [appliedActionIds, setAppliedActionIds] = useState<Set<string>>(new Set());
  const createNote = useCreateNote();
  const createTask = useCreateTask();
  const updateNote = useUpdateNote();
  const scrollRef = useRef<ScrollView>(null);
  const listHeight = useRef(0);

  // Nachrichten aus dem GELADENEN Verlauf treten NICHT auf — nur neue, die
  // während der Sitzung dazukommen. Merke die IDs, sobald der Verlauf zum
  // ersten Mal da ist (bei neuem Chat: leere Menge → alles Weitere ist neu).
  const historyIdsRef = useRef<Set<string> | null>(null);
  if (historyIdsRef.current === null && messages !== undefined) {
    historyIdsRef.current = new Set(messages.map((m) => m.id));
  }
  const isNewMessage = (mid: string) => historyIdsRef.current !== null && !historyIdsRef.current.has(mid);

  // Streaming: der wachsende Antwort-Text. Er bleibt sichtbar, bis die
  // persistierte Nachricht im Verlauf angekommen ist — sonst blinkt der Übergang.
  const [streamText, setStreamText] = useState<string | null>(null);
  const streamRef = useRef('');
  // Sobald der Nutzer selbst umbenennt, hält der Auto-Titel für immer still.
  const userRenamedRef = useRef(false);
  const clearOnMessageId = useRef<string | null>(null);
  useEffect(() => {
    if (clearOnMessageId.current && (messages ?? []).some((m) => m.id === clearOnMessageId.current)) {
      clearOnMessageId.current = null;
      streamRef.current = '';
      setStreamText(null);
    }
  }, [messages]);

  // Die „Löschen?"-Rückfrage verfällt still nach ein paar Sekunden.
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3500);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  /** Aktions-Auswahl übernehmen: Aufgaben anlegen, Checkliste an die verknüpfte
   *  Notiz hängen — oder, wenn keine verknüpft ist, als NEUE Notiz-Checkliste
   *  anlegen (nichts geht verloren). */
  const applyActions = async (m: ChatMessage, selected: AssistantAction) => {
    hapticSuccess();
    for (const a of selected.aufgaben) {
      await createTask.mutateAsync({
        listId: 'default',
        title: a.titel,
        dueDate: a.datum ?? null,
        dueTime: a.zeit ?? null,
        eventId: chat?.eventId ?? null,
      });
    }
    if (selected.checkliste.length > 0) {
      const lines = selected.checkliste.map((c) => `- [ ] ${c}`).join('\n');
      if (linkedNote) {
        updateNote.mutate({ id: linkedNote.id, patch: { body: `${linkedNote.body}\n${lines}` } });
      } else {
        // Keine verknüpfte Notiz → eigene Notiz mit der Checkliste (erste Zeile = Titel).
        await createNote.mutateAsync({ body: `Checkliste\n${lines}`, taskId: chat?.taskId ?? null, eventId: chat?.eventId ?? null });
      }
    }
    for (const n of selected.notizen) {
      await createNote.mutateAsync({ body: n, taskId: chat?.taskId ?? null, eventId: chat?.eventId ?? null });
    }
    setAppliedActionIds((prev) => new Set(prev).add(m.id));
  };

  /** Antwort holen für einen gegebenen Verlauf (send + retry teilen sich das). */
  const requestAnswer = async (history: ChatMessage[]) => {
    if (!id) return;
    setPending(true);
    setError(null);
    streamRef.current = '';
    try {
      const appContext = assistantContextEnabled
        ? buildAppContext({
            events: events ?? [],
            tasks: tasks ?? [],
            lists: lists ?? [],
            notes: notes ?? [],
            today,
            calendarDenied: !calGranted,
          })
        : null;
      const combined = [effectiveContext, appContext].filter(Boolean).join('\n\n') || null;
      const answer = await askAssistant(apiKey, history, combined, (delta) => {
        streamRef.current += delta;
        setStreamText(streamRef.current);
        scrollRef.current?.scrollToEnd({ animated: false });
      });
      const saved = await appendMessage.mutateAsync({ chatId: id, role: 'assistant', content: answer });
      clearOnMessageId.current = saved.id;
      hapticSuccess();

      // Auto-Titel nach dem ERSTEN Austausch — es sei denn, der Nutzer hat schon
      // selbst umbenannt (seine Wahl gewinnt immer). Still im Hintergrund.
      const firstUser = history[history.length - 1];
      if (history.length === 1 && !userRenamedRef.current && firstUser) {
        void generateChatTitle(apiKey, firstUser.content, answer).then((title) => {
          if (title && !userRenamedRef.current) updateChat.mutate({ id, patch: { title } });
        });
      }
    } catch (e) {
      streamRef.current = '';
      setStreamText(null);
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
    // Titel = erste Nutzer-Nachricht (gekürzt) — bis der Nutzer selbst umbenennt.
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

  /** Zweistufig: erst „Löschen?", dann in den Papierkorb (30 Tage, wie die Liste). */
  const remove = () => {
    hapticSelect();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (id) updateChat.mutate({ id, patch: { deletedAt: new Date().toISOString() } });
    router.back();
  };

  // Tages-Trenner nur, wenn der Chat über mehrere Tage geht.
  const showDayLabels = useMemo(() => {
    const days = new Set((messages ?? []).map((m) => toDateStr(new Date(m.createdAt))));
    return days.size > 1;
  }, [messages]);

  // Während des Streamens den (noch unvollständigen) Aktions-Block verbergen.
  const streamVisible = streamText !== null ? streamText.split('```')[0] : null;

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
            <PressableScale
              accessibilityLabel="Chat umbenennen"
              disabled={!chat}
              onPress={() => {
                hapticSelect();
                setRenameSheet(true);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' }}
            >
              <Type variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>{chat?.title ?? 'Chat'}</Type>
              <Pencil size={11} color={colors.text3} strokeWidth={2} />
            </PressableScale>
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
            <PressableScale
              accessibilityLabel={confirmDelete ? 'Löschen bestätigen' : 'Chat löschen'}
              onPress={remove}
              style={{ padding: Spacing.sm }}
            >
              {confirmDelete ? (
                <Type variant="label" tone="indigo">Löschen?</Type>
              ) : (
                <Trash2 size={20} color={colors.text3} strokeWidth={2} />
              )}
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
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.md, gap: Spacing.md }}
        >
          {(messages ?? []).length === 0 && !pending && (
            <View style={{ alignItems: 'center', paddingTop: Spacing.xxl, gap: Spacing.md }}>
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
              {/* Prompt-Chips: ein Tipp genügt statt zu tippen. Nur mit Schlüssel. */}
              {apiKey.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md }}>
                  {promptChips(chatLink).map((chip) => (
                    <PressableScale
                      key={chip}
                      accessibilityLabel={`Vorschlag senden: ${chip}`}
                      onPress={() => void sendText(chip)}
                      style={{
                        backgroundColor: colors.chip,
                        borderRadius: R.pill,
                        paddingVertical: Spacing.sm,
                        paddingHorizontal: Spacing.md,
                      }}
                    >
                      <Type variant="label" tone="teal">{chip}</Type>
                    </PressableScale>
                  ))}
                </View>
              )}
            </View>
          )}
          {(messages ?? []).map((m, i, arr) => {
            const day = toDateStr(new Date(m.createdAt));
            const prevDay = i > 0 ? toDateStr(new Date(arr[i - 1].createdAt)) : null;
            const separator = showDayLabels && day !== prevDay ? formatDueDate(day, today) : null;
            const { clean, actions } = m.role === 'assistant' ? extractActions(m.content) : { clean: m.content, actions: null };
            return (
              <View key={m.id}>
                {separator && (
                  <Type variant="eyebrow" tone="text3" style={{ textAlign: 'center', marginBottom: Spacing.md, marginTop: i > 0 ? Spacing.sm : 0 }}>
                    {separator}
                  </Type>
                )}
                {m.role === 'user' ? (
                  // Nutzer: editorialer Dialog — rechtsbündiger Text an einem
                  // schmalen Teal-Rand, keine Blase (Manuskript statt Messenger).
                  // Tritt leicht von rechts auf (kommt aus der Eingabezeile).
                  <Appear tx={12} skip={!isNewMessage(m.id)} style={{ alignSelf: 'flex-end', maxWidth: '86%' }}>
                    <PressableScale
                      accessibilityLabel="Nachricht kopieren"
                      onLongPress={() => void copyMessage(clean)}
                      pressedScale={0.99}
                      style={{
                        borderRightWidth: 2,
                        borderRightColor: colors.teal,
                        paddingRight: Spacing.md,
                        paddingVertical: 2,
                      }}
                    >
                      <UserText content={clean} color={colors.teal} />
                    </PressableScale>
                  </Appear>
                ) : (
                  // Assistent: frei gesetzter Text direkt auf der Tafel — ein Brief, keine SMS.
                  <View style={{ alignSelf: 'stretch', paddingRight: Spacing.sm }}>
                    <PressableScale
                      accessibilityLabel="Antwort kopieren"
                      onLongPress={() => void copyMessage(clean)}
                      pressedScale={0.995}
                    >
                      <MarkdownText markdown={clean} />
                    </PressableScale>
                    {/* Aktionskarte: strukturierte Vorschläge, einzeln abwählbar.
                        Blendet aus scale 0.96 ein — selten gesehen, darf auftreten. */}
                    {actions && (
                      <Appear from={0.96} ty={4} duration={Dur.card} skip={!isNewMessage(m.id)}>
                        <ActionCard
                          actions={actions}
                          applied={appliedActionIds.has(m.id)}
                          today={today}
                          hasLinkedNote={!!linkedNote}
                          onApply={(selected) => void applyActions(m, selected)}
                        />
                      </Appear>
                    )}
                    {/* Antworten lassen sich mit einem Tipp als Notiz ablegen —
                        inklusive der Verknüpfung des Chats (Aufgabe/Termin). */}
                    <PressableScale
                      accessibilityLabel="Antwort als Notiz speichern"
                      onPress={() => saveAsNote(m)}
                      disabled={savedNoteIds.has(m.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: Spacing.sm, alignSelf: 'flex-start' }}
                    >
                      <NotebookPen size={12} color={savedNoteIds.has(m.id) ? colors.text3 : colors.teal} strokeWidth={2} />
                      <Type variant="caption" tone={savedNoteIds.has(m.id) ? 'text3' : 'teal'}>
                        {savedNoteIds.has(m.id) ? 'Als Notiz gespeichert ✓' : 'Als Notiz speichern'}
                      </Type>
                    </PressableScale>
                  </View>
                )}
              </View>
            );
          })}
          {/* Streaming: die Antwort wächst Wort für Wort auf der Tafel — der
              erste Text tritt sanft auf, wo eben noch die Denk-Punkte waren. */}
          {streamVisible !== null && streamVisible.length > 0 && (
            <Appear ty={6} style={{ alignSelf: 'stretch', paddingRight: Spacing.sm }}>
              <MarkdownText markdown={streamVisible} />
            </Appear>
          )}
          {pending && (streamVisible === null || streamVisible.length === 0) && <ThinkingDots />}
          {error && (
            <View style={{ gap: Spacing.xs, paddingHorizontal: Spacing.sm }}>
              <Type variant="caption" tone="indigo">{error}</Type>
              <PressableScale accessibilityLabel="Erneut versuchen" onPress={retry} style={{ alignSelf: 'flex-start' }}>
                <Type variant="label" tone="teal">Erneut versuchen</Type>
              </PressableScale>
            </View>
          )}
        </ScrollView>

        {/* Eingabe — bleibt während des Wartens tippbar, nur Senden pausiert. */}
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
              borderRadius: R.xl,
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={
                dictating ? 'Ich höre zu …' : apiKey ? 'Frag den Assistenten…' : 'Erst Schlüssel in den Einstellungen hinterlegen'
              }
              placeholderTextColor={colors.text3}
              editable={apiKey.length > 0}
              multiline
              accessibilityLabel="Nachricht an den Assistenten"
              {...keyboardDoneProps}
              style={[{ fontSize: T.md, color: colors.text, maxHeight: 110, paddingVertical: 2 }, webNoOutline]}
            />
          </View>
          {/* Diktat: füllt das Feld mit gesprochenem Text (On-Device). */}
          {apiKey.length > 0 && (
            <MicButton
              autoStart={dictate === '1'}
              onStart={() => {
                dictBaseRef.current = draft;
              }}
              onText={(transcript) =>
                setDraft((dictBaseRef.current ? `${dictBaseRef.current.trimEnd()} ` : '') + transcript)
              }
              onListeningChange={setDictating}
            />
          )}
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
      {renameSheet && chat && (
        <RenameSheet chat={chat} onClose={() => setRenameSheet(false)} onRenamed={() => (userRenamedRef.current = true)} />
      )}
    </View>
  );
}
