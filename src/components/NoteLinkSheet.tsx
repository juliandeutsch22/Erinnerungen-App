// NoteLinkSheet.tsx — „Zuweisen"-Sheet einer Notiz: an EINE Erinnerung
// und/oder EINEN Termin hängen (Tippen wählt/löst, Sheet bleibt offen —
// man sieht sofort, was verknüpft ist).
import { Check } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { PressableScale } from '@/components/PressableScale';
import { Group, RowDivider } from '@/components/SheetParts';
import { Type } from '@/components/Type';
import { useDeviceEvents } from '@/data/calendarQueries';
import { useNotes, useUpdateNote } from '@/data/noteQueries';
import type { Note } from '@/data/types';
import { useTasks } from '@/data/queries';
import { addDays, formatDueDate, toDateStr, todayStr } from '@/lib/dates';
import { hasCalendarPermission } from '@/lib/deviceCalendar';
import { hapticSelect } from '@/lib/haptics';
import { byTimeThenCreation, isOpen } from '@/lib/taskLogic';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export function NoteLinkSheet({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const colors = useColors();
  const today = todayStr();
  const { data: notes } = useNotes();
  const { data: tasks } = useTasks();
  const updateNote = useUpdateNote();

  const note: Note | undefined = (notes ?? []).find((n) => n.id === noteId);

  const [calGranted, setCalGranted] = useState(false);
  useEffect(() => {
    void hasCalendarPermission().then(setCalGranted);
  }, []);
  const { data: events } = useDeviceEvents(today, addDays(today, 14), calGranted);

  // Offene Erinnerungen: fällige zuerst, dann nach Uhrzeit/Anlage.
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

  // Termine der nächsten 14 Tage — Serien-Instanzen auf die erste reduziert.
  const upcomingEvents = useMemo(() => {
    const seen = new Set<string>();
    return (events ?? []).filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [events]);

  if (!note) return null;

  const toggleTask = (taskId: string) => {
    hapticSelect();
    updateNote.mutate({ id: note.id, patch: { taskId: note.taskId === taskId ? null : taskId } });
  };
  const toggleEvent = (eventId: string) => {
    hapticSelect();
    updateNote.mutate({ id: note.id, patch: { eventId: note.eventId === eventId ? null : eventId } });
  };

  return (
    <BottomSheet visible title="Notiz zuweisen" onClose={onClose}>
      <Type variant="eyebrow" tone="text3" style={{ marginBottom: Spacing.xs }}>Erinnerungen</Type>
      {openTasks.length === 0 ? (
        <Type variant="caption" tone="text3">Keine offenen Erinnerungen.</Type>
      ) : (
        <Group>
          {openTasks.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && <RowDivider />}
              <PressableScale
                accessibilityLabel={note.taskId === t.id ? `„${t.title}" lösen` : `An „${t.title}" hängen`}
                onPress={() => toggleTask(t.id)}
                pressedScale={0.99}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md }}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Type variant="body" numberOfLines={1}>{t.title}</Type>
                  {t.dueDate && (
                    <Type variant="caption" tone="text3">
                      {formatDueDate(t.dueDate, today)}
                      {t.dueTime ? `, ${t.dueTime}` : ''}
                    </Type>
                  )}
                </View>
                {note.taskId === t.id && <Check size={18} color={colors.teal} strokeWidth={2.4} />}
              </PressableScale>
            </React.Fragment>
          ))}
        </Group>
      )}

      <Type variant="eyebrow" tone="text3" style={{ marginTop: Spacing.lg, marginBottom: Spacing.xs }}>Termine</Type>
      {!calGranted ? (
        <Type variant="caption" tone="text3">Kalender-Zugriff nicht erteilt.</Type>
      ) : upcomingEvents.length === 0 ? (
        <Type variant="caption" tone="text3">Keine Termine in den nächsten zwei Wochen.</Type>
      ) : (
        <Group>
          {upcomingEvents.map((ev, i) => (
            <React.Fragment key={ev.key}>
              {i > 0 && <RowDivider />}
              <PressableScale
                accessibilityLabel={note.eventId === ev.id ? `„${ev.title}" lösen` : `An „${ev.title}" hängen`}
                onPress={() => toggleEvent(ev.id)}
                pressedScale={0.99}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md }}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Type variant="body" numberOfLines={1}>{ev.title}</Type>
                  <Type variant="caption" tone="text3">
                    {formatDueDate(toDateStr(ev.start), today)}
                    {ev.allDay ? '' : `, ${String(ev.start.getHours()).padStart(2, '0')}:${String(ev.start.getMinutes()).padStart(2, '0')}`}
                  </Type>
                </View>
                {note.eventId === ev.id && <Check size={18} color={colors.teal} strokeWidth={2.4} />}
              </PressableScale>
            </React.Fragment>
          ))}
        </Group>
      )}
    </BottomSheet>
  );
}
