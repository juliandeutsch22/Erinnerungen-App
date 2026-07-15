// CalendarMonth.tsx — Monatsansicht für den Kalender-Tab: Kopf (Monat + „Heute" +
// Navigation) über dem gemeinsamen MonthGrid. Zell-Optik und Überlappungs-Fix
// leben in DayCell/MonthGrid (calendar/); hier Navigation + Monatswechsel-Animation.
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MonthGrid } from '@/components/calendar/MonthGrid';
import { MONTHS, type MonthAnchor, monthGridRange } from '@/components/calendar/monthMatrix';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { parseDateStr, todayStr } from '@/lib/dates';
import { hapticSelect } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

// Wisch-Schwellen für den Monatswechsel.
const SWIPE_DISTANCE = 48;
const SWIPE_VELOCITY = 350;

// Weiterhin aus diesem Modul beziehbar (kalender.tsx importiert von hier).
export { monthGridRange };
export type { MonthAnchor };

export function CalendarMonth({
  anchor,
  onAnchorChange,
  selected,
  onSelect,
  markers,
  onDayLongPress,
}: {
  anchor: MonthAnchor;
  onAnchorChange: (a: MonthAnchor) => void;
  selected: string;
  onSelect: (date: string) => void;
  /** Punkt-Farben pro Tag (max. 3 werden gezeigt). */
  markers: Map<string, string[]>;
  /** Langes Drücken auf einen Tag (z. B. „Neuer Termin"). */
  onDayLongPress?: (date: string) => void;
}) {
  const colors = useColors();
  const today = todayStr();

  // Richtung des letzten Wechsels (für die Slide-Richtung der Animation).
  const dir = useRef(0);
  const tx = useSharedValue(0);
  const op = useSharedValue(1);

  // Bei jedem Monatswechsel: das neue Gitter gleitet sanft aus der Wisch-Richtung
  // herein und blendet auf. Kein haptisches Feedback beim Wischen — nur Animation.
  useEffect(() => {
    tx.value = dir.current * 22;
    op.value = 0.4;
    tx.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    op.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    dir.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.year, anchor.month]);

  const gridStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }], opacity: op.value }));

  // Monatswechsel selbst (Swipe): bewusst OHNE Haptik.
  const shift = (delta: number) => {
    dir.current = delta > 0 ? 1 : -1;
    const d = new Date(anchor.year, anchor.month + delta, 1);
    onAnchorChange({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Horizontal über das Gitter wischen = Monat vor/zurück. Richtungs-Aktivierung
  // (activeOffsetX + failOffsetY) lässt vertikales Scrollen der Seite unberührt;
  // bewusst KEINE Kopplung mit einer ScrollView (die stürzt auf dem Gerät ab).
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-16, 16])
    .onEnd((e) => {
      if (e.translationX <= -SWIPE_DISTANCE || e.velocityX <= -SWIPE_VELOCITY) runOnJS(shift)(1);
      else if (e.translationX >= SWIPE_DISTANCE || e.velocityX >= SWIPE_VELOCITY) runOnJS(shift)(-1);
    });

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
          {/* Chevrons behalten Haptik (Tastendruck) — nur das Wischen nicht. */}
          <PressableScale accessibilityLabel="Voriger Monat" onPress={() => { hapticSelect(); shift(-1); }} style={{ padding: Spacing.sm }}>
            <ChevronLeft size={20} color={colors.text2} strokeWidth={2} />
          </PressableScale>
          <PressableScale accessibilityLabel="Nächster Monat" onPress={() => { hapticSelect(); shift(1); }} style={{ padding: Spacing.sm }}>
            <ChevronRight size={20} color={colors.text2} strokeWidth={2} />
          </PressableScale>
        </View>
      </View>

      <GestureDetector gesture={swipe}>
        <Animated.View style={gridStyle}>
          <MonthGrid anchor={anchor} selected={selected} onSelect={onSelect} today={today} markers={markers} onDayLongPress={onDayLongPress} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
