// DayCell.tsx — EINE Tageszelle für beide Kalender. Kern des Überlappungs-Fixes:
// die Auswahl-/Heute-Markierung ist ein Kreis mit `width: 88%` (gedeckelt per
// maxWidth) und `aspectRatio: 1` — sie kann die Spalte NIE überfüllen, es bleibt
// immer ein Abstand zum Nachbartag. Punkt-Marker sitzen unter dem Kreis.
import React from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useColors } from '@/theme/ThemeProvider';

export function DayCell({
  day,
  dateStr,
  monthLabel,
  inMonth,
  selected,
  today,
  disabled,
  dots,
  size,
  onSelect,
}: {
  day: number;
  dateStr: string;
  monthLabel: string;
  inMonth: boolean;
  selected: boolean;
  today: boolean;
  disabled: boolean;
  /** Punkt-Farben (max. 3). undefined = keine Marker-Zeile (kompakter Editor-Kalender). */
  dots?: string[];
  /** Maximaler Kreisdurchmesser in pt (responsiv nach unten). */
  size: number;
  onSelect: (date: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 3, gap: 3 }}>
      <PressableScale
        accessibilityLabel={`${day}. ${monthLabel} auswählen`}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={() => onSelect(dateStr)}
        pressedScale={0.9}
        style={{
          width: '88%',
          maxWidth: size,
          aspectRatio: 1,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.32 : 1,
          backgroundColor: selected ? colors.teal : 'transparent',
          borderWidth: today && !selected ? 1.5 : 0,
          borderColor: colors.teal,
        }}
      >
        <Type
          variant="label"
          tabular
          style={{ color: selected ? '#FFFFFF' : today ? colors.teal : inMonth ? colors.text : colors.text3 }}
        >
          {day}
        </Type>
      </PressableScale>
      {dots !== undefined && (
        <View style={{ flexDirection: 'row', gap: 3, height: 5 }}>
          {dots.slice(0, 3).map((c, i) => (
            <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }} />
          ))}
        </View>
      )}
    </View>
  );
}
