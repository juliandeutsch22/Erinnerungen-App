// RescheduleSheet.tsx — „Neu planen" (Swipe links): Heute Abend / Morgen /
// Wochenende / In freie Zeit einplanen / Datum wählen / Kein Datum. Eine Aktion
// pro Zeile, sofort wirksam.
//
// „In freie Zeit einplanen" (Timeboxing): liest den Gerätekalender, findet freie
// Lücken heute/morgen und schlägt konkrete Blöcke vor — ein Tipp gibt der
// Aufgabe eine Uhrzeit in echter freier Zeit. Ohne Kalenderzugriff werden
// sinnvolle Standardzeiten vorgeschlagen.
import { CalendarClock, CalendarDays, CalendarX2, Clock, Moon, Sun } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { MiniCalendar } from '@/components/MiniCalendar';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useDeviceEvents } from '@/data/calendarQueries';
import { useUpdateTask } from '@/data/queries';
import type { Task } from '@/data/types';
import { addDays, nextWeekend, todayStr } from '@/lib/dates';
import { hasCalendarPermission } from '@/lib/deviceCalendar';
import { hapticSelect } from '@/lib/haptics';
import { findFreeSlots } from '@/lib/timeboxing';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

export function RescheduleSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const colors = useColors();
  const updateTask = useUpdateTask();
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSlots, setShowSlots] = useState(false);

  // Kalender nur lesen, wenn der Zugriff bereits gewährt wurde (Prompt gehört
  // in den Kalender-Tab). Ohne Zugriff wird von einem leeren Tag ausgegangen.
  const [calGranted, setCalGranted] = useState(false);
  useEffect(() => {
    void hasCalendarPermission().then(setCalGranted);
  }, []);
  const { data: events } = useDeviceEvents(today, tomorrow, calGranted && showSlots);

  const now = new Date();
  const slotDays = useMemo(
    () => [
      { key: today, label: 'Heute', slots: findFreeSlots(events ?? [], today, { now, maxSlots: 3 }) },
      { key: tomorrow, label: 'Morgen', slots: findFreeSlots(events ?? [], tomorrow, { maxSlots: 3 }) },
    ],
    // events-Referenz + Tage genügen; now bewusst nur beim Öffnen berechnet.
    [events, today, tomorrow], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const noSlots = slotDays.every((d) => d.slots.length === 0);

  const apply = (patch: { dueDate: string | null; dueTime?: string | null }) => {
    hapticSelect();
    updateTask.mutate({ id: task.id, patch });
    onClose();
  };

  const options = [
    { key: 'abend', label: 'Heute Abend', icon: Moon, onPress: () => apply({ dueDate: today, dueTime: '18:00' }) },
    { key: 'morgen', label: 'Morgen', icon: Sun, onPress: () => apply({ dueDate: tomorrow }) },
    { key: 'wochenende', label: 'Wochenende', icon: CalendarDays, onPress: () => apply({ dueDate: nextWeekend(today) }) },
    { key: 'einplanen', label: 'In freie Zeit einplanen…', icon: Clock, onPress: () => { hapticSelect(); setShowSlots((v) => !v); setShowCalendar(false); } },
    { key: 'kalender', label: 'Datum wählen…', icon: CalendarClock, onPress: () => { setShowCalendar((v) => !v); setShowSlots(false); } },
    { key: 'kein', label: 'Kein Datum', icon: CalendarX2, onPress: () => apply({ dueDate: null, dueTime: null }) },
  ];

  return (
    <BottomSheet visible title="Neu planen" onClose={onClose}>
      <Type variant="caption" tone="text3" style={{ marginBottom: Spacing.md }} numberOfLines={1}>
        {task.title}
      </Type>
      <View style={{ gap: Spacing.xs }}>
        {options.map((o) => (
          <PressableScale
            key={o.key}
            accessibilityLabel={o.label}
            onPress={o.onPress}
            pressedScale={0.98}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.md,
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.md,
              borderRadius: R.md,
              backgroundColor: colors.chip,
              borderWidth: 1,
              borderColor: colors.chipBorder,
            }}
          >
            <o.icon size={18} color={o.key === 'kein' ? colors.text3 : colors.teal} strokeWidth={2} />
            <Type variant="body">{o.label}</Type>
          </PressableScale>
        ))}
      </View>

      {/* Timeboxing: freie Blöcke heute/morgen. */}
      {showSlots && (
        <View style={{ marginTop: Spacing.md, gap: Spacing.md }}>
          {noSlots ? (
            <Type variant="caption" tone="text3">Kein freier Block bis 21 Uhr gefunden.</Type>
          ) : (
            slotDays.map((d) =>
              d.slots.length === 0 ? null : (
                <View key={d.key} style={{ gap: Spacing.xs }}>
                  <Type variant="eyebrow" tone="text3">{d.label}</Type>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                    {d.slots.map((s) => (
                      <PressableScale
                        key={s.start}
                        accessibilityLabel={`${d.label} ${s.start} bis ${s.end} einplanen`}
                        onPress={() => apply({ dueDate: d.key, dueTime: s.start })}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: R.pill, backgroundColor: `${colors.teal}1F`, borderWidth: 1, borderColor: colors.teal }}
                      >
                        <Clock size={13} color={colors.teal} strokeWidth={2} />
                        <Type variant="label" tabular>{s.start}–{s.end}</Type>
                      </PressableScale>
                    ))}
                  </View>
                </View>
              ),
            )
          )}
        </View>
      )}

      {showCalendar && (
        <View style={{ marginTop: Spacing.md }}>
          <MiniCalendar selected={task.dueDate} onSelect={(d) => apply({ dueDate: d })} />
        </View>
      )}
    </BottomSheet>
  );
}
