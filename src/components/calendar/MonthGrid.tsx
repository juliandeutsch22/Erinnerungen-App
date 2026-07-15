// MonthGrid.tsx — Wochentagszeile + Wochen aus DayCell. Gemeinsamer Gitter-Kern
// für den Kalender-Tab (mit Markern) und den Editor-MiniCalendar (kompakt,
// optional minDate). Navigation bleibt in den jeweiligen Wrappern.
import React from 'react';
import { View } from 'react-native';

import { Type } from '@/components/Type';
import { toDateStr } from '@/lib/dates';

import { DayCell } from './DayCell';
import { MONTHS, type MonthAnchor, monthWeeks, WEEKDAYS } from './monthMatrix';

export function MonthGrid({
  anchor,
  selected,
  onSelect,
  today,
  markers,
  minDate,
  compact = false,
}: {
  anchor: MonthAnchor;
  selected: string | null;
  onSelect: (date: string) => void;
  today: string;
  /** Punkt-Farben pro Tag; fehlt = keine Marker (Editor-Kalender). */
  markers?: Map<string, string[]>;
  /** Tage davor sind nicht wählbar (ausgegraut). */
  minDate?: string;
  /** kleinere Zellen für den Editor. */
  compact?: boolean;
}) {
  const weeks = monthWeeks(anchor);
  const size = compact ? 36 : 44;
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 2 }}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={{ flex: 1, alignItems: 'center' }}>
            <Type variant="caption" tone="text3">{w}</Type>
          </View>
        ))}
      </View>
      {weeks.map((week, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {week.map((d, ci) => {
            const dateStr = toDateStr(d);
            return (
              <DayCell
                key={ci}
                day={d.getDate()}
                dateStr={dateStr}
                monthLabel={MONTHS[d.getMonth()]}
                inMonth={d.getMonth() === anchor.month}
                selected={selected === dateStr}
                today={today === dateStr}
                disabled={minDate !== undefined && dateStr < minDate}
                dots={markers ? (markers.get(dateStr) ?? []) : undefined}
                size={size}
                onSelect={onSelect}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
