// RescheduleSheet.tsx — „Neu planen" (Swipe links): Heute Abend / Morgen /
// Wochenende / Datum wählen / Kein Datum. Eine Aktion pro Zeile, sofort wirksam.
import { CalendarDays, CalendarX2, Moon, Sun } from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { MiniCalendar } from '@/components/MiniCalendar';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useUpdateTask } from '@/data/queries';
import type { Task } from '@/data/types';
import { addDays, nextWeekend, todayStr } from '@/lib/dates';
import { hapticSelect } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

export function RescheduleSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const colors = useColors();
  const updateTask = useUpdateTask();
  const today = todayStr();
  const [showCalendar, setShowCalendar] = useState(false);

  const apply = (patch: { dueDate: string | null; dueTime?: string | null }) => {
    hapticSelect();
    updateTask.mutate({ id: task.id, patch });
    onClose();
  };

  const options = [
    { key: 'abend', label: 'Heute Abend', icon: Moon, onPress: () => apply({ dueDate: today, dueTime: '18:00' }) },
    { key: 'morgen', label: 'Morgen', icon: Sun, onPress: () => apply({ dueDate: addDays(today, 1) }) },
    { key: 'wochenende', label: 'Wochenende', icon: CalendarDays, onPress: () => apply({ dueDate: nextWeekend(today) }) },
    { key: 'kalender', label: 'Datum wählen…', icon: CalendarDays, onPress: () => setShowCalendar((v) => !v) },
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
      {showCalendar && (
        <View style={{ marginTop: Spacing.md }}>
          <MiniCalendar selected={task.dueDate} onSelect={(d) => apply({ dueDate: d })} />
        </View>
      )}
    </BottomSheet>
  );
}
