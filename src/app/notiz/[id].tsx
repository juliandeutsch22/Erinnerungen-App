// notiz/[id].tsx — Vollbild-Notiz-Editor nach iOS-Notizen-Muster:
// KEIN Speichern-Button — Autosave beim Tippen (debounced) und beim Verlassen.
// Die erste Zeile ist der Titel (Antiqua), darunter freier Text, darunter die
// Checkliste als EIGENER editierbarer Block (keine rohen „- [ ]"-Marker im
// Textfeld). Gespeichert wird weiterhin EIN body-String: Titel + Text +
// „- [ ]"-Zeilen am Ende — Suche/Backup/Import bleiben Plain Text.
// Tastatur: Wisch nach unten (interactive) oder „Fertig"-Leiste.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft, Link2, ListChecks, ListTodo, Pin, Plus, Share2, Sparkles, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { KeyboardDoneBar, keyboardDoneProps } from '@/components/KeyboardDone';
import { LinkedChats } from '@/components/LinkedChats';
import { NoteLinkSheet } from '@/components/NoteLinkSheet';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useDeviceEvents } from '@/data/calendarQueries';
import { useCreateChat } from '@/data/chatQueries';
import { useDeleteNote, useNotes, useUpdateNote } from '@/data/noteQueries';
import { useSettings } from '@/theme/settings.store';
import { useTasks } from '@/data/queries';
import { addDays, todayStr } from '@/lib/dates';
import { hasCalendarPermission } from '@/lib/deviceCalendar';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { shareText } from '@/lib/share';
import { noteShareTitle, noteToShareText } from '@/lib/shareText';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

const AUTOSAVE_MS = 600;
const TITLE_FONT = 'CormorantGaramond_700Bold';
const CHECK_RE = /^\s*- (?:\[( |x)\] )?(.*)$/;

type Item = { text: string; done: boolean };

/** body → Titel, freier Text (ohne Checkzeilen) und Checklisten-Items. */
function splitBody(body: string): { title: string; free: string; items: Item[] } {
  const lines = body.split('\n');
  const title = lines[0] ?? '';
  const freeLines: string[] = [];
  const items: Item[] = [];
  for (const line of lines.slice(1)) {
    const m = CHECK_RE.exec(line);
    if (m && m[2].trim().length > 0) items.push({ text: m[2].trim(), done: m[1] === 'x' });
    else freeLines.push(line);
  }
  // Leere Restzeilen am Ende (durch herausgelöste Checkzeilen) abschneiden.
  while (freeLines.length > 0 && freeLines[freeLines.length - 1].trim() === '') freeLines.pop();
  return { title, free: freeLines.join('\n'), items };
}

/** Titel + Text + Checkliste wieder zu EINEM body-String zusammensetzen. */
function composeBody(title: string, free: string, items: Item[]): string {
  const parts = [title];
  if (free.length > 0) parts.push(free);
  for (const it of items) parts.push(`- [${it.done ? 'x' : ' '}] ${it.text}`);
  return parts.join('\n');
}

export default function NotizScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: notes } = useNotes();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const note = (notes ?? []).find((n) => n.id === id);

  // Lokaler Zustand — einmal aus der Notiz geladen, danach führt der Editor.
  const [title, setTitle] = useState<string | null>(null);
  const [free, setFree] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const loaded = title !== null;
  useEffect(() => {
    if (!loaded && note) {
      const s = splitBody(note.body);
      setTitle(s.title);
      setFree(s.free);
      setItems(s.items);
      if (s.items.length > 0) setShowChecklist(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, loaded]);

  // Autosave: debounced beim Tippen + garantiert beim Verlassen (Unmount).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<string | null>(null);
  const saved = useRef<string | null>(null);
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (latest.current !== null && latest.current !== saved.current && id) {
      saved.current = latest.current;
      updateNote.mutate({ id, patch: { body: latest.current } });
    }
  };
  const schedule = (t: string, f: string, its: Item[]) => {
    latest.current = composeBody(t, f, its);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
  };
  useEffect(() => {
    if (note && saved.current === null) saved.current = note.body;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => flush(), []);

  const onChangeTitle = (text: string) => {
    // Zeilenumbrüche (Einfügen mehrzeiligen Texts) wandern in den Text.
    if (text.includes('\n')) {
      const idx = text.indexOf('\n');
      const head = text.slice(0, idx);
      const tail = text.slice(idx + 1);
      const nextFree = tail.length > 0 ? (free.length > 0 ? `${tail}\n${free}` : tail) : free;
      setTitle(head);
      setFree(nextFree);
      schedule(head, nextFree, items);
      bodyRef.current?.focus();
      return;
    }
    setTitle(text);
    schedule(text, free, items);
  };
  const onChangeFree = (text: string) => {
    setFree(text);
    schedule(title ?? '', text, items);
  };

  // Checklisten-Aktionen: direkt am Block, kein Marker-Tippen nötig.
  const setItemsAnd = (next: Item[], immediate = false) => {
    setItems(next);
    if (immediate) {
      latest.current = composeBody(title ?? '', free, next);
      flush();
    } else {
      schedule(title ?? '', free, next);
    }
  };
  const toggleItem = (i: number) => {
    hapticSuccess();
    setItemsAnd(items.map((it, k) => (k === i ? { ...it, done: !it.done } : it)), true);
  };
  const editItem = (i: number, text: string) => {
    setItemsAnd(items.map((it, k) => (k === i ? { ...it, text } : it)));
  };
  const removeItem = (i: number) => {
    hapticSelect();
    setItemsAnd(items.filter((_, k) => k !== i), true);
  };
  const addDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setItemsAnd([...items, { text, done: false }], true);
    setDraft('');
    // Fokus sicher im Feld halten (Web verliert ihn beim Re-Render) — zügig weiter tippen.
    setTimeout(() => draftRef.current?.focus(), 30);
  };

  const bodyRef = useRef<TextInput>(null);
  const draftRef = useRef<TextInput>(null);
  const createChat = useCreateChat();
  const hasAssistantKey = useSettings((s) => s.geminiApiKey.length > 0);

  // Tastatur offen? → prominenter „Fertig"-Knopf oben rechts (Apple-Muster).
  const [kbVisible, setKbVisible] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, () => setKbVisible(true));
    const h = Keyboard.addListener(hideEvt, () => setKbVisible(false));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  // Zuweisung: Chips zeigen die verknüpfte Erinnerung / den Termin.
  const [linkSheet, setLinkSheet] = useState(false);
  const { data: tasks } = useTasks();
  const today = todayStr();
  const [calGranted, setCalGranted] = useState(false);
  useEffect(() => {
    void hasCalendarPermission().then(setCalGranted);
  }, []);
  const { data: events } = useDeviceEvents(today, addDays(today, 14), calGranted);
  const linkedTask = useMemo(
    () => (note?.taskId ? (tasks ?? []).find((t) => t.id === note.taskId) : undefined),
    [tasks, note?.taskId],
  );
  const linkedEventTitle = useMemo(() => {
    if (!note?.eventId) return null;
    return (events ?? []).find((e) => e.id === note.eventId)?.title ?? 'Termin';
  }, [events, note?.eventId]);

  // Löschen = Papierkorb (30 Tage, im Tab wiederherstellbar) — kein Bestätigen nötig.
  const remove = () => {
    hapticSelect();
    latest.current = null; // nichts mehr speichern
    if (id) updateNote.mutate({ id, patch: { deletedAt: new Date().toISOString() } });
    router.back();
  };

  const togglePin = () => {
    if (!note) return;
    hapticSelect();
    updateNote.mutate({ id: note.id, patch: { pinned: !note.pinned } });
  };

  const updatedLabel = note
    ? new Date(note.updatedAt).toLocaleString('de-DE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : '';
  const doneCount = items.filter((i) => i.done).length;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Kopf: zurück · Zuletzt bearbeitet · Checkliste · zuweisen · anheften · löschen */}
        <View
          style={{
            paddingTop: insets.top + Spacing.sm,
            paddingHorizontal: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <PressableScale
            accessibilityLabel="Zurück"
            onPress={() => {
              flush();
              router.back();
            }}
            style={{ padding: Spacing.sm }}
          >
            <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
          </PressableScale>
          <Type variant="caption" tone="text3" tabular>
            {updatedLabel}
          </Type>
          {kbVisible ? (
            <PressableScale
              accessibilityLabel="Fertig — Tastatur schließen"
              onPress={() => {
                flush();
                Keyboard.dismiss();
              }}
              style={{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md }}
            >
              <Type variant="label" tone="teal">Fertig</Type>
            </PressableScale>
          ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Assistent mit LIVE-Zugriff auf diese Notiz (nur mit Schlüssel). */}
            {hasAssistantKey && (
              <PressableScale
                accessibilityLabel="Assistent zu dieser Notiz fragen"
                onPress={() => {
                  flush();
                  hapticSelect();
                  createChat.mutate(
                    { title: (title ?? '').trim() || 'Notiz', noteId: id ?? null },
                    { onSuccess: (c) => router.push(`/chat/${c.id}`) },
                  );
                }}
                style={{ padding: Spacing.sm }}
              >
                <Sparkles size={20} color={colors.text3} strokeWidth={2} />
              </PressableScale>
            )}
            <PressableScale
              accessibilityLabel="Checkliste öffnen"
              onPress={() => {
                hapticSelect();
                setShowChecklist(true);
                setTimeout(() => draftRef.current?.focus(), 80);
              }}
              style={{ padding: Spacing.sm }}
            >
              <ListChecks size={20} color={showChecklist ? colors.teal : colors.text3} strokeWidth={2} />
            </PressableScale>
            <PressableScale
              accessibilityLabel="Notiz teilen"
              onPress={() => {
                flush();
                hapticSelect();
                // Der frisch komponierte Body (title+free+items) ist die Quelle,
                // note?.body als Fallback, falls noch nichts getippt wurde.
                const body = composeBody(title ?? '', free, items).trim() || (note?.body ?? '').trim();
                if (body) void shareText(noteToShareText(body), noteShareTitle(body));
              }}
              style={{ padding: Spacing.sm }}
            >
              <Share2 size={20} color={colors.text3} strokeWidth={2} />
            </PressableScale>
            <PressableScale
              accessibilityLabel="Notiz zuweisen"
              onPress={() => {
                flush();
                hapticSelect();
                setLinkSheet(true);
              }}
              style={{ padding: Spacing.sm }}
            >
              <Link2 size={20} color={colors.text3} strokeWidth={2} />
            </PressableScale>
            <PressableScale
              accessibilityLabel={note?.pinned ? 'Notiz lösen' : 'Notiz anheften'}
              onPress={togglePin}
              style={{ padding: Spacing.sm }}
            >
              <Pin
                size={20}
                color={note?.pinned ? colors.teal : colors.text3}
                fill={note?.pinned ? colors.teal : 'none'}
                strokeWidth={2}
              />
            </PressableScale>
            <PressableScale accessibilityLabel="Notiz löschen" onPress={remove} style={{ padding: Spacing.sm }}>
              <Trash2 size={20} color={colors.text3} strokeWidth={2} />
            </PressableScale>
          </View>
          )}
        </View>

        {/* Verknüpfungs-Chips nur, wenn tatsächlich etwas verknüpft ist. */}
        {(linkedTask || linkedEventTitle) && note && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs }}>
          {linkedTask && note && (
            <PressableScale
              accessibilityLabel={`Verknüpfung mit „${linkedTask.title}" lösen`}
              onPress={() => {
                hapticSelect();
                updateNote.mutate({ id: note.id, patch: { taskId: null } });
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: Spacing.sm, borderRadius: R.pill, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.chipBorder }}
            >
              <ListTodo size={13} color={colors.text2} strokeWidth={2} />
              <Type variant="caption" tone="text2" numberOfLines={1} style={{ maxWidth: 140 }}>{linkedTask.title}</Type>
              <X size={11} color={colors.text3} strokeWidth={2.2} />
            </PressableScale>
          )}
          {linkedEventTitle && note && (
            <PressableScale
              accessibilityLabel={`Verknüpfung mit „${linkedEventTitle}" lösen`}
              onPress={() => {
                hapticSelect();
                updateNote.mutate({ id: note.id, patch: { eventId: null } });
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: Spacing.sm, borderRadius: R.pill, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.chipBorder }}
            >
              <CalendarDays size={13} color={colors.text2} strokeWidth={2} />
              <Type variant="caption" tone="text2" numberOfLines={1} style={{ maxWidth: 140 }}>{linkedEventTitle}</Type>
              <X size={11} color={colors.text3} strokeWidth={2.2} />
            </PressableScale>
          )}
        </View>
        )}

        {/* Schreibfläche: Titel + Text + Checklisten-Block in einer Scroll-Fläche.
            Wisch nach unten schließt die Tastatur (interactive). */}
        <View
          style={{
            flex: 1,
            marginTop: Spacing.sm,
            marginHorizontal: Spacing.md,
            marginBottom: insets.bottom + Spacing.md,
            borderRadius: R.lg,
            backgroundColor: colors.bg2,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            // 'on-drag' statt 'interactive': das halb-offene Ziehen ließ das
            // Feld fokussiert → iOS holte die Tastatur zurück und sprang zum
            // Cursor ans Notiz-Ende (Refokus-Schleife bei langen Notizen).
            keyboardDismissMode="on-drag"
            // Immer scroll-/bouncefähig — sonst greift der Wisch-Dismiss
            // bei kurzen Notizen nie (nichts zu scrollen = keine Geste).
            alwaysBounceVertical
            contentContainerStyle={{ paddingBottom: Spacing.lg }}
          >
          <TextInput
            value={title ?? ''}
            onChangeText={onChangeTitle}
            autoFocus={loaded && (title ?? '').length === 0 && free.length === 0 && items.length === 0}
            placeholder="Titel"
            placeholderTextColor={colors.text3}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => bodyRef.current?.focus()}
            accessibilityLabel="Titel der Notiz"
            {...keyboardDoneProps}
            style={[
              {
                fontFamily: TITLE_FONT,
                fontSize: T.xl + 5,
                lineHeight: (T.xl + 5) * 1.25,
                letterSpacing: 0.3,
                color: colors.text,
                paddingHorizontal: Spacing.lg,
                paddingTop: Spacing.md,
                paddingBottom: 0,
              },
              webNoOutline,
            ]}
          />

          {/* Freier Text — ohne Checklisten-Marker, wächst mit dem Inhalt. */}
          <TextInput
            ref={bodyRef}
            value={free}
            onChangeText={onChangeFree}
            multiline
            placeholder="Notiz…"
            placeholderTextColor={colors.text3}
            textAlignVertical="top"
            accessibilityLabel="Notiztext"
            scrollEnabled={false}
            // Scroll-Berührungen auf dem Text gehen an die Scroll-Fläche —
            // sonst fokussiert ein Wisch das Feld und öffnet die Tastatur.
            rejectResponderTermination={false}
            {...keyboardDoneProps}
            style={[
              {
                minHeight: showChecklist ? 90 : 180,
                fontSize: T.md + 1,
                lineHeight: (T.md + 1) * 1.5,
                color: colors.text,
                paddingHorizontal: Spacing.lg,
                paddingTop: Spacing.xs,
                paddingBottom: Spacing.md,
              },
              webNoOutline,
            ]}
          />

          {/* Checklisten-Block: direkt editierbar — abhaken, umbenennen,
              entfernen, unten zügig neue Punkte anfügen. */}
          {(showChecklist || items.length > 0) && (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm }}>
              <Type variant="eyebrow" tone="text3">
                Checkliste{items.length > 0 ? ` · ${doneCount}/${items.length}` : ''}
              </Type>
              {items.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs }}>
                  <PressableScale
                    accessibilityLabel={`${item.text || 'Punkt'} ${item.done ? 'wieder öffnen' : 'abhaken'}`}
                    onPress={() => toggleItem(i)}
                    style={{ padding: 2 }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: item.done ? colors.teal : colors.border3,
                        backgroundColor: item.done ? colors.teal : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {item.done && <Type variant="caption" style={{ color: '#FFFFFF', fontSize: 12, lineHeight: 14 }}>✓</Type>}
                    </View>
                  </PressableScale>
                  <TextInput
                    value={item.text}
                    onChangeText={(t) => editItem(i, t)}
                    accessibilityLabel={`Punkt ${i + 1} bearbeiten`}
                    {...keyboardDoneProps}
                    style={[
                      {
                        flex: 1,
                        fontSize: T.md,
                        color: item.done ? colors.text3 : colors.text,
                        textDecorationLine: item.done ? 'line-through' : 'none',
                        paddingVertical: 2,
                      },
                      webNoOutline,
                    ]}
                  />
                  <PressableScale accessibilityLabel={`Punkt ${item.text} entfernen`} onPress={() => removeItem(i)} style={{ padding: Spacing.xs }}>
                    <X size={14} color={colors.text3} strokeWidth={2} />
                  </PressableScale>
                </View>
              ))}
              {/* Neuer Punkt — Enter fügt an und bleibt im Feld. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs }}>
                <Plus size={18} color={colors.teal} strokeWidth={2.2} />
                <TextInput
                  ref={draftRef}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Neuer Punkt"
                  placeholderTextColor={colors.text3}
                  returnKeyType="done"
                  submitBehavior="submit"
                  onSubmitEditing={addDraft}
                  onBlur={addDraft}
                  accessibilityLabel="Neuer Checklisten-Punkt"
                  {...keyboardDoneProps}
                  style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: 2 }, webNoOutline]}
                />
              </View>
            </View>
          )}

          {/* Assistenten-Chats zu dieser Notiz (nur mit Schlüssel sichtbar). */}
          {id && hasAssistantKey && (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm }}>
              <LinkedChats noteId={id} title={(title ?? '').trim() || 'Notiz'} onNavigate={flush} />
            </View>
          )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <KeyboardDoneBar />
      {linkSheet && id && <NoteLinkSheet noteId={id} onClose={() => setLinkSheet(false)} />}
    </View>
  );
}
