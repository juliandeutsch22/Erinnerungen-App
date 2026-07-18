// WeekStrip.tsx — Wochenleiste der Wochenansicht: Mo–So um den gewählten Tag,
// Pfeile blättern wochenweise, Marker-Punkte wie im Monatsgitter. Der gewählte
// Tag steuert die Zeitachse darunter (gleiches Muster wie Monat → Agenda).
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { addDays, parseDateStr } from '@/lib/dates';
import { hapticSelect } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Montag der Woche, in der `day` liegt. */
export function weekStart(day: string): string {
  const dow = parseDateStr(day).getDay(); // So=0
  return addDays(day, -((dow + 6) % 7));
}

export function WeekStrip({
  selected,
  today,
  markers,
  onSelect,
}: {
  selected: string;
  today: string;
  /** Tag → Markerfarben (wie CalendarMonth). */
  markers: Map<string, string[]>;
  onSelect: (day: string) => void;
}) {
  const colors = useColors();
  const start = weekStart(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const monthLabel = parseDateStr(selected).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <PressableScale
          accessibilityLabel="Vorherige Woche"
          onPress={() => {
            hapticSelect();
            onSelect(addDays(start, -7));
          }}
          style={{ padding: Spacing.sm }}
        >
          <ChevronLeft size={18} color={colors.text3} strokeWidth={2} />
        </PressableScale>
        <Type variant="label" tone="text2">{monthLabel}</Type>
        <PressableScale
          accessibilityLabel="Nächste Woche"
          onPress={() => {
            hapticSelect();
            onSelect(addDays(start, 7));
          }}
          style={{ padding: Spacing.sm }}
        >
          <ChevronRight size={18} color={colors.text3} strokeWidth={2} />
        </PressableScale>
      </View>
      <View style={{ flexDirection: 'row', marginTop: Spacing.xs }}>
        {days.map((day, i) => {
          const isSelected = day === selected;
          const isToday = day === today;
          const dayMarkers = (markers.get(day) ?? []).slice(0, 3);
          return (
            <PressableScale
              key={day}
              accessibilityLabel={`Tag ${day} wählen`}
              onPress={() => {
                hapticSelect();
                onSelect(day);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: Spacing.sm,
                borderRadius: R.md,
                backgroundColor: isSelected ? `${colors.teal}1A` : 'transparent',
              }}
            >
              <Type variant="caption" tone={isToday ? 'teal' : 'text3'}>{DAY_LABELS[i]}</Type>
              <Type variant="label" tone={isSelected ? 'teal' : isToday ? 'teal' : 'text'} tabular>
                {String(parseDateStr(day).getDate())}
              </Type>
              <View style={{ flexDirection: 'row', gap: 2, height: 4, marginTop: 2 }}>
                {dayMarkers.map((c, mi) => (
                  <View key={mi} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c }} />
                ))}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
