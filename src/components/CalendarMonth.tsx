// CalendarMonth.tsx — Monatsansicht für den Kalender-Tab: Kopf (Monat + „Heute" +
// Navigation) über dem gemeinsamen MonthGrid. Zell-Optik und Überlappungs-Fix
// leben in DayCell/MonthGrid (calendar/); hier nur die Navigation.
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { MonthGrid } from '@/components/calendar/MonthGrid';
import { MONTHS, type MonthAnchor, monthGridRange } from '@/components/calendar/monthMatrix';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { parseDateStr, todayStr } from '@/lib/dates';
import { hapticSelect } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

// Weiterhin aus diesem Modul beziehbar (kalender.tsx importiert von hier).
export { monthGridRange };
export type { MonthAnchor };

export function CalendarMonth({
  anchor,
  onAnchorChange,
  selected,
  onSelect,
  markers,
}: {
  anchor: MonthAnchor;
  onAnchorChange: (a: MonthAnchor) => void;
  selected: string;
  onSelect: (date: string) => void;
  /** Punkt-Farben pro Tag (max. 3 werden gezeigt). */
  markers: Map<string, string[]>;
}) {
  const colors = useColors();
  const today = todayStr();

  const shift = (delta: number) => {
    hapticSelect();
    const d = new Date(anchor.year, anchor.month + delta, 1);
    onAnchorChange({ year: d.getFullYear(), month: d.getMonth() });
  };

  const jumpToday = () => {
    hapticSelect();
    const t = parseDateStr(today);
    onAnchorChange({ year: t.getFullYear(), month: t.getMonth() });
    onSelect(today);
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Type variant="heading">{MONTHS[anchor.month]} {anchor.year}</Type>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PressableScale accessibilityLabel="Zu heute springen" onPress={jumpToday} style={{ paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm }}>
            <Type variant="label" tone="teal">Heute</Type>
          </PressableScale>
          <PressableScale accessibilityLabel="Voriger Monat" onPress={() => shift(-1)} style={{ padding: Spacing.sm }}>
            <ChevronLeft size={20} color={colors.text2} strokeWidth={2} />
          </PressableScale>
          <PressableScale accessibilityLabel="Nächster Monat" onPress={() => shift(1)} style={{ padding: Spacing.sm }}>
            <ChevronRight size={20} color={colors.text2} strokeWidth={2} />
          </PressableScale>
        </View>
      </View>

      <MonthGrid anchor={anchor} selected={selected} onSelect={onSelect} today={today} markers={markers} />
    </View>
  );
}
