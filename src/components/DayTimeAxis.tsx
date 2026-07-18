// DayTimeAxis.tsx — Stundenachse eines Tages (Wochenansicht): Terminblöcke in
// Kalenderfarbe (Höhe ∝ Dauer), Aufgaben mit Uhrzeit als Marker auf der Achse.
// Fenster: volle Stunden um die Einträge (mindestens 08–20 Uhr). Tippen öffnet
// den jeweiligen Editor — Timeboxing-freundlich: freie Lücken sind sichtbar.
import React from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import type { DeviceCalendar } from '@/lib/deviceCalendar';
import type { TimelineEntry } from '@/lib/dayTimeline';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

const PX_PER_MIN = 0.8; // 48 px pro Stunde
const AXIS_LEFT = 44; // Platz für Stunden-Labels

function hhmmToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function DayTimeAxis({
  entries,
  calendarById,
  onPressEvent,
  onPressTask,
}: {
  entries: TimelineEntry[];
  calendarById: Map<string, DeviceCalendar>;
  onPressEvent: (e: TimelineEntry & { kind: 'event' }) => void;
  onPressTask: (e: TimelineEntry & { kind: 'task' }) => void;
}) {
  const colors = useColors();

  // Fenster: volle Stunden um die Einträge, mindestens 08–20 Uhr.
  let startMin = 8 * 60;
  let endMin = 20 * 60;
  for (const e of entries) {
    startMin = Math.min(startMin, Math.floor(e.sortMin / 60) * 60);
    const end = e.kind === 'event' && e.end ? hhmmToMin(e.end) : e.sortMin + 30;
    endMin = Math.max(endMin, Math.ceil(end / 60) * 60);
  }
  const height = (endMin - startMin) * PX_PER_MIN;
  const hours: number[] = [];
  for (let h = startMin / 60; h <= endMin / 60; h += 1) hours.push(h);

  return (
    <View style={{ height, marginTop: Spacing.sm }}>
      {/* Stundenraster */}
      {hours.map((h) => (
        <View key={h} style={{ position: 'absolute', left: 0, right: 0, top: (h * 60 - startMin) * PX_PER_MIN }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Type variant="caption" tone="text3" tabular style={{ width: AXIS_LEFT - Spacing.sm, textAlign: 'right', fontSize: T.xs }}>
              {String(h).padStart(2, '0')}:00
            </Type>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
        </View>
      ))}

      {/* Terminblöcke */}
      {entries.map((e) => {
        if (e.kind !== 'event') return null;
        const s = e.sortMin;
        const end = e.end ? hhmmToMin(e.end) : s + 30;
        const top = (s - startMin) * PX_PER_MIN + 7;
        const blockHeight = Math.max((end - s) * PX_PER_MIN, 26);
        const cal = calendarById.get(e.event.calendarId);
        const color = cal?.color ?? colors.indigo;
        return (
          <PressableScale
            key={e.key}
            accessibilityLabel={`Termin ${e.event.title} bearbeiten`}
            onPress={() => onPressEvent(e)}
            pressedScale={0.99}
            style={{
              position: 'absolute',
              left: AXIS_LEFT + Spacing.sm,
              right: 0,
              top,
              height: blockHeight,
              borderRadius: R.sm,
              backgroundColor: `${color}22`,
              borderLeftWidth: 3,
              borderLeftColor: color,
              paddingHorizontal: Spacing.sm,
              paddingVertical: 3,
              overflow: 'hidden',
            }}
          >
            <Type variant="caption" numberOfLines={1} style={{ fontWeight: '600' }}>{e.event.title}</Type>
            {blockHeight >= 40 && (
              <Type variant="caption" tone="text3" tabular>{e.time}{e.end ? `–${e.end}` : ''}</Type>
            )}
          </PressableScale>
        );
      })}

      {/* Aufgaben mit Uhrzeit: schmale Chips auf der Achse */}
      {entries.map((e) => {
        if (e.kind !== 'task') return null;
        const top = (e.sortMin - startMin) * PX_PER_MIN + 7;
        return (
          <PressableScale
            key={e.key}
            accessibilityLabel={`${e.task.title} bearbeiten`}
            onPress={() => onPressTask(e)}
            pressedScale={0.99}
            style={{
              position: 'absolute',
              left: AXIS_LEFT + Spacing.sm,
              right: Spacing.xl,
              top,
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.xs,
              backgroundColor: colors.bg2,
              borderRadius: R.pill,
              borderWidth: 1,
              borderColor: colors.chipBorder,
              paddingVertical: 2,
              paddingHorizontal: Spacing.sm,
              alignSelf: 'flex-start',
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal }} />
            <Type variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>{e.task.title}</Type>
            <Type variant="caption" tone="text3" tabular>{e.time}</Type>
          </PressableScale>
        );
      })}
    </View>
  );
}
