// MiniCalendar.tsx — kompakter Monats-Kalender für die Datums-Wahl im Editor.
// Kopf (Monat + Navigation) über dem gemeinsamen MonthGrid (compact) — gleiche
// Zell-Optik wie der Kalender-Tab, nur kleiner und ohne Marker.
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';

import { MonthGrid } from '@/components/calendar/MonthGrid';
import { MONTHS } from '@/components/calendar/monthMatrix';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { parseDateStr, todayStr } from '@/lib/dates';
import { hapticSelect } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export function MiniCalendar({
  selected,
  onSelect,
  minDate,
}: {
  selected: string | null;
  onSelect: (date: string) => void;
  /** Tage vor diesem Datum ('YYYY-MM-DD') sind nicht wählbar (ausgegraut). */
  minDate?: string;
}) {
  const colors = useColors();
  const today = todayStr();
  const anchorDate = selected ? parseDateStr(selected) : parseDateStr(today);
  const [year, setYear] = useState(anchorDate.getFullYear());
  const [month, setMonth] = useState(anchorDate.getMonth());

  const shift = (delta: number) => {
    hapticSelect();
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <PressableScale accessibilityLabel="Voriger Monat" onPress={() => shift(-1)} style={{ padding: Spacing.sm }}>
          <ChevronLeft size={18} color={colors.text2} strokeWidth={2} />
        </PressableScale>
        <Type variant="label">{MONTHS[month]} {year}</Type>
        <PressableScale accessibilityLabel="Nächster Monat" onPress={() => shift(1)} style={{ padding: Spacing.sm }}>
          <ChevronRight size={18} color={colors.text2} strokeWidth={2} />
        </PressableScale>
      </View>
      <MonthGrid anchor={{ year, month }} selected={selected} onSelect={onSelect} today={today} minDate={minDate} compact />
    </View>
  );
}
