// EventRow.tsx — kompakte Termin-Zeile (Kalender-Tab + Dashboard): Farbbalken
// des Quell-Kalenders, Titel, Zeit-Label; Tap öffnet den Termin-Editor.
import React from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { eventTimeLabel } from '@/lib/calendarLogic';
import type { DeviceCalendar, DeviceEvent } from '@/lib/deviceCalendar';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

export function EventRow({
  event,
  calendar,
  day,
  showCalendarName = true,
  onPress,
}: {
  event: DeviceEvent;
  calendar?: DeviceCalendar;
  /** Angezeigter Tag ('YYYY-MM-DD') — bestimmt das Zeit-Label bei mehrtägigen Terminen. */
  day: string;
  showCalendarName?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityLabel={`Termin ${event.title} bearbeiten`}
      onPress={onPress}
      pressedScale={0.99}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 }}
    >
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: R.pill, backgroundColor: calendar?.color ?? colors.indigo }} />
      <View style={{ flex: 1, gap: 1 }}>
        <Type variant="body" numberOfLines={2}>{event.title}</Type>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Type variant="caption" tone="text3">{eventTimeLabel(event, day)}</Type>
          {showCalendarName && calendar && (
            <Type variant="caption" tone="text3" numberOfLines={1}>{calendar.title}</Type>
          )}
        </View>
      </View>
    </PressableScale>
  );
}
