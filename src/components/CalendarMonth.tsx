// CalendarMonth.tsx — volle Monatsansicht für den Kalender-Tab: Wochen ab
// Montag, Punkt-Marker in Kalenderfarben (+ Teal für Erinnerungen), Monats-
// Navigation und „Heute"-Sprung. Auswahl steuert die Tages-Agenda darunter.
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { parseDateStr, toDateStr, todayStr } from '@/lib/dates';
import { hapticSelect } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export type MonthAnchor = { year: number; month: number };

/** Sichtbares Gitter eines Monats: Montag vor dem 1. bis Ende der letzten Woche. */
export function monthGridRange(anchor: MonthAnchor): { from: string; to: string } {
  const first = new Date(anchor.year, anchor.month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(anchor.year, anchor.month, 1 - offset);
  const daysInMonth = new Date(anchor.year, anchor.month + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + cells - 1);
  return { from: toDateStr(start), to: toDateStr(end) };
}

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

  const { from } = monthGridRange(anchor);
  const start = parseDateStr(from);
  const daysInMonth = new Date(anchor.year, anchor.month + 1, 0).getDate();
  const offset = (new Date(anchor.year, anchor.month, 1).getDay() + 6) % 7;
  const weeks = Math.ceil((offset + daysInMonth) / 7);

  return (
    <View style={{ gap: Spacing.sm }}>
      {/* Kopf: Monat + Navigation + Heute */}
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

      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={{ flex: 1, alignItems: 'center' }}>
            <Type variant="caption" tone="text3">{w}</Type>
          </View>
        ))}
      </View>

      {Array.from({ length: weeks }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {Array.from({ length: 7 }, (_, col) => {
            const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + row * 7 + col);
            const dateStr = toDateStr(d);
            const inMonth = d.getMonth() === anchor.month;
            const isSelected = dateStr === selected;
            const isToday = dateStr === today;
            const dots = (markers.get(dateStr) ?? []).slice(0, 3);
            return (
              <View key={col} style={{ flex: 1, alignItems: 'center' }}>
                <PressableScale
                  accessibilityLabel={`${d.getDate()}. ${MONTHS[d.getMonth()]} auswählen`}
                  onPress={() => onSelect(dateStr)}
                  style={{
                    width: 42,
                    height: 48,
                    borderRadius: R.md,
                    alignItems: 'center',
                    paddingTop: 6,
                    backgroundColor: isSelected ? colors.teal : 'transparent',
                    borderWidth: isToday && !isSelected ? 1 : 0,
                    borderColor: colors.teal,
                  }}
                >
                  <Type
                    variant="label"
                    tabular
                    style={{
                      color: isSelected ? '#FFFFFF' : isToday ? colors.teal : inMonth ? colors.text : colors.text3,
                    }}
                  >
                    {d.getDate()}
                  </Type>
                  <View style={{ flexDirection: 'row', gap: 3, marginTop: 4, height: 5 }}>
                    {dots.map((c, i) => (
                      <View
                        key={i}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.9)' : c,
                        }}
                      />
                    ))}
                  </View>
                </PressableScale>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
