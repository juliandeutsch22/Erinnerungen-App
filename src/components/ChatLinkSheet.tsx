// ChatLinkSheet.tsx — „Zuweisen"-Sheet eines Chats: nachträglich an EINE
// Notiz, EINE Erinnerung und/oder EINEN Termin hängen (Tippen wählt/löst,
// Sheet bleibt offen). Termin-Zuweisung friert den Kontext-Snapshot ein;
// Notiz/Aufgabe werden ohnehin live gelesen.
import { Check } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { PressableScale } from '@/components/PressableScale';
import { Group, RowDivider } from '@/components/SheetParts';
import { Type } from '@/components/Type';
import { useDeviceEvents } from '@/data/calendarQueries';
import { useChats, useUpdateChat } from '@/data/chatQueries';
import { useNotes } from '@/data/noteQueries';
import { useTasks } from '@/data/queries';
import { buildEventContext } from '@/lib/assistant';
import { addDays, formatDueDate, todayStr } from '@/lib/dates';
import { hasCalendarPermission } from '@/lib/deviceCalendar';
import { hapticSelect } from '@/lib/haptics';
import { noteTitle } from '@/lib/noteLogic';
import { byTimeThenCreation, isOpen } from '@/lib/taskLogic';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export function ChatLinkSheet({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const colors = useColors();
  const today = todayStr();
  const { data: chats } = useChats();
  const { data: tasks } = useTasks();
  const { data: notes } = useNotes();
  const updateChat = useUpdateChat();

  const chat = (chats ?? []).find((c) => c.id === chatId);

  const [calGranted, setCalGranted] = useState(false);
  useEffect(() => {
    void hasCalendarPermission().then(setCalGranted);
  }, []);
  const { data: events } = useDeviceEvents(today, addDays(today, 14), calGranted);

  const openTasks = useMemo(
    () =>
      (tasks ?? [])
        .filter(isOpen)
        .sort((a, b) => {
          const ad = a.dueDate ?? '9999';
          const bd = b.dueDate ?? '9999';
          return ad === bd ? byTimeThenCreation(a, b) : ad < bd ? -1 : 1;
        })
        .slice(0, 30),
    [tasks],
  );
  const activeNotes = useMemo(
    () => (notes ?? []).filter((n) => n.deletedAt === null).slice(0, 30),
    [notes],
  );
  const upcomingEvents = useMemo(() => {
    const seen = new Set<string>();
    return (events ?? []).filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [events]);

  if (!chat) return null;

  const toggle = (patch: { taskId?: string | null; noteId?: string | null; eventId?: string | null; context?: string | null }) => {
    hapticSelect();
    updateChat.mutate({ id: chat.id, patch });
  };

  return (
    <BottomSheet visible title="Chat zuweisen" onClose={onClose}>
      <Type variant="eyebrow" tone="text3" style={{ marginBottom: Spacing.xs }}>Notizen</Type>
      {activeNotes.length === 0 && <Type variant="caption" tone="text3">Keine Notizen.</Type>}
      {activeNotes.length > 0 && (
        <Group>
          {activeNotes.map((n, i) => (
            <View key={n.id}>
              {i > 0 && <RowDivider />}
              <PressableScale
                accessibilityLabel={`Notiz ${noteTitle(n.body)} ${chat.noteId === n.id ? 'lösen' : 'zuweisen'}`}
                onPress={() => toggle({ noteId: chat.noteId === n.id ? null : n.id })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
              >
                <Type variant="body" numberOfLines={1} style={{ flex: 1 }}>{noteTitle(n.body)}</Type>
                {chat.noteId === n.id && <Check size={17} color={colors.teal} strokeWidth={2.4} />}
              </PressableScale>
            </View>
          ))}
        </Group>
      )}

      <Type variant="eyebrow" tone="text3" style={{ marginTop: Spacing.lg, marginBottom: Spacing.xs }}>Erinnerungen</Type>
      {openTasks.length === 0 && <Type variant="caption" tone="text3">Keine offenen Erinnerungen.</Type>}
      {openTasks.length > 0 && (
        <Group>
          {openTasks.map((t, i) => (
            <View key={t.id}>
              {i > 0 && <RowDivider />}
              <PressableScale
                accessibilityLabel={`Erinnerung ${t.title} ${chat.taskId === t.id ? 'lösen' : 'zuweisen'}`}
                onPress={() => toggle({ taskId: chat.taskId === t.id ? null : t.id })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
              >
                <View style={{ flex: 1 }}>
                  <Type variant="body" numberOfLines={1}>{t.title}</Type>
                  {t.dueDate && <Type variant="caption" tone="text3">{formatDueDate(t.dueDate, today)}</Type>}
                </View>
                {chat.taskId === t.id && <Check size={17} color={colors.teal} strokeWidth={2.4} />}
              </PressableScale>
            </View>
          ))}
        </Group>
      )}

      <Type variant="eyebrow" tone="text3" style={{ marginTop: Spacing.lg, marginBottom: Spacing.xs }}>Termine</Type>
      {upcomingEvents.length === 0 && (
        <Type variant="caption" tone="text3">
          {calGranted ? 'Keine Termine in den nächsten 14 Tagen.' : 'Kalender-Zugriff nicht erteilt.'}
        </Type>
      )}
      {upcomingEvents.length > 0 && (
        <Group>
          {upcomingEvents.map((ev, i) => (
            <View key={ev.id}>
              {i > 0 && <RowDivider />}
              <PressableScale
                accessibilityLabel={`Termin ${ev.title} ${chat.eventId === ev.id ? 'lösen' : 'zuweisen'}`}
                onPress={() =>
                  toggle(
                    chat.eventId === ev.id
                      ? { eventId: null, context: null }
                      : { eventId: ev.id, context: buildEventContext(ev) },
                  )
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
              >
                <View style={{ flex: 1 }}>
                  <Type variant="body" numberOfLines={1}>{ev.title}</Type>
                  <Type variant="caption" tone="text3">
                    {ev.start.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })}
                  </Type>
                </View>
                {chat.eventId === ev.id && <Check size={17} color={colors.teal} strokeWidth={2.4} />}
              </PressableScale>
            </View>
          ))}
        </Group>
      )}
    </BottomSheet>
  );
}
