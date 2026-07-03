// MiniCalendar.tsx — kompakter Monats-Kalender für die Datums-Wahl im Editor
// (bewusst ohne Fremdbibliothek). Wochen beginnen bei Montag.
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { parseDateStr, toDateStr, todayStr } from '@/lib/dates';
import { hapticSelect } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const CELL = 36;

export function MiniCalendar({ selected, onSelect }: { selected: string | null; onSelect: (date: string) => void }) {
  const colors = useColors();
  const today = todayStr();
  const anchor = selected ? parseDateStr(selected) : parseDateStr(today);
  const [year, setYear] = useState(anchor.getFullYear());
  const [month, setMonth] = useState(anchor.getMonth());

  const shift = (delta: number) => {
    hapticSelect();
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Mo = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

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
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={{ flex: 1, alignItems: 'center' }}>
            <Type variant="caption" tone="text3">{w}</Type>
          </View>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
            if (day === null) return <View key={i} style={{ flex: 1, height: CELL }} />;
            const dateStr = toDateStr(new Date(year, month, day));
            const isSelected = dateStr === selected;
            const isToday = dateStr === today;
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <PressableScale
                  accessibilityLabel={`${day}. ${MONTHS[month]} wählen`}
                  onPress={() => onSelect(dateStr)}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: R.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? colors.teal : 'transparent',
                    borderWidth: isToday && !isSelected ? 1 : 0,
                    borderColor: colors.teal,
                  }}
                >
                  <Type variant="label" tabular style={{ color: isSelected ? '#FFFFFF' : isToday ? colors.teal : colors.text }}>
                    {day}
                  </Type>
                </PressableScale>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
