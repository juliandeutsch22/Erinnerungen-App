// notiz/[id].tsx — Vollbild-Notiz-Editor nach iOS-Notizen-Muster:
// KEIN Speichern-Button — Autosave beim Tippen (debounced) und beim Verlassen.
// Erste Zeile = Titel (erscheint in der Liste), „Zuletzt bearbeitet" oben.
// Schreiben braucht Platz: eigene Route statt Sheet.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft, Link2, ListTodo, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { NoteLinkSheet } from '@/components/NoteLinkSheet';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useDeviceEvents } from '@/data/calendarQueries';
import { useDeleteNote, useNotes, useUpdateNote } from '@/data/noteQueries';
import { useTasks } from '@/data/queries';
import { addDays, todayStr } from '@/lib/dates';
import { hasCalendarPermission } from '@/lib/deviceCalendar';
import { hapticSelect } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

const AUTOSAVE_MS = 600;

export default function NotizScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: notes } = useNotes();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const note = (notes ?? []).find((n) => n.id === id);

  // Lokaler Text — einmal aus der Notiz geladen, danach führt der Editor.
  const [body, setBody] = useState<string | null>(null);
  const loaded = body !== null;
  useEffect(() => {
    if (!loaded && note) setBody(note.body);
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
  const onChange = (text: string) => {
    setBody(text);
    latest.current = text;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
  };
  useEffect(() => {
    if (note && saved.current === null) saved.current = note.body;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => flush(), []);

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

  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = () => {
    if (!confirmDelete) {
      hapticSelect();
      setConfirmDelete(true);
      return;
    }
    latest.current = null; // nichts mehr speichern
    if (id) deleteNote.mutate(id);
    router.back();
  };

  const updatedLabel = note
    ? new Date(note.updatedAt).toLocaleString('de-DE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Kopf: zurück · Zuletzt bearbeitet · löschen */}
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
          <PressableScale
            accessibilityLabel={confirmDelete ? 'Endgültig löschen' : 'Notiz löschen'}
            onPress={remove}
            style={{ padding: Spacing.sm }}
          >
            <Trash2 size={20} color={confirmDelete ? colors.indigo : colors.text3} strokeWidth={2} />
          </PressableScale>
        </View>

        {/* Zuweisen: Notiz an Erinnerung/Termin hängen — Chips zeigen den Stand. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs }}>
          <PressableScale
            accessibilityLabel="Notiz zuweisen"
            onPress={() => {
              flush();
              hapticSelect();
              setLinkSheet(true);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: Spacing.sm, borderRadius: R.pill, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.chipBorder }}
          >
            <Link2 size={13} color={colors.teal} strokeWidth={2.2} />
            <Type variant="caption" tone="teal">Zuweisen</Type>
          </PressableScale>
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

        {/* Der Text — ein großes Feld, die erste Zeile wird zum Titel. */}
        <TextInput
          value={body ?? ''}
          onChangeText={onChange}
          multiline
          autoFocus={loaded && (body ?? '').length === 0}
          placeholder="Notiz…"
          placeholderTextColor={colors.text3}
          textAlignVertical="top"
          accessibilityLabel="Notiztext"
          scrollEnabled
          style={[
            {
              flex: 1,
              fontSize: T.md + 1,
              lineHeight: (T.md + 1) * 1.5,
              color: colors.text,
              paddingHorizontal: Spacing.lg,
              paddingTop: Spacing.md,
              paddingBottom: insets.bottom + Spacing.lg,
            },
            webNoOutline,
          ]}
        />
      </KeyboardAvoidingView>
      {linkSheet && id && <NoteLinkSheet noteId={id} onClose={() => setLinkSheet(false)} />}
    </View>
  );
}
