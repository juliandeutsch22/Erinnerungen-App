// ProgressLine.tsx — die dünne Fortschrittslinie als roter Faden der App
// (Tages-Bilanz auf Heute, Projekt-Karten, Projekt-Kopf). Die Füllung gleitet
// animiert zum Zielwert statt hart zu springen. Reduced-Motion → sofort da.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useColors, useReducedMotion } from '@/theme/ThemeProvider';

export function ProgressLine({ ratio, color, height = 3 }: {
  /** Füllstand 0–1. */
  ratio: number;
  /** Füllfarbe (Default: Teal). */
  color?: string;
  height?: number;
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  // Sichtbarer Mindest-Anteil, sobald überhaupt etwas geschafft ist.
  const target = ratio <= 0 ? 0 : Math.max(0.04, Math.min(1, ratio));
  const p = useSharedValue(reduced ? target : 0);

  useEffect(() => {
    p.value = reduced ? target : withTiming(target, { duration: 640, easing: Easing.out(Easing.cubic) });
  }, [target, reduced, p]);

  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));

  return (
    <View style={{ height, borderRadius: 999, backgroundColor: colors.chip, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: 999, backgroundColor: color ?? colors.teal }, fill]} />
    </View>
  );
}
