// Appear.tsx — Ein-Auftritt für frisch gemountete Elemente: Opacity + optional
// leichtes Versetzen/Skalieren, mit den zentralen Ease/Dur-Tokens. Shared-Value-
// basiert (nicht deklaratives entering/exiting) → identisch robust auf Web und
// nativ, endet garantiert im sichtbaren Zustand. Reduced-Motion → sofort da.
//
// Läuft genau EINMAL pro Mount: bestehende Elemente animieren bei Re-Renders
// nicht erneut (nur wirklich neue Nachrichten/Karten treten auf).
import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Dur, Ease } from '@/theme/motion.tokens';
import { useReducedMotion } from '@/theme/ThemeProvider';

export function Appear({
  children,
  tx = 0,
  ty = 0,
  from = 1,
  duration = Dur.popover,
  skip = false,
  style,
}: {
  children: React.ReactNode;
  /** Start-Versatz X (px), läuft nach 0. */
  tx?: number;
  /** Start-Versatz Y (px), läuft nach 0. */
  ty?: number;
  /** Start-Skalierung (z. B. 0.96), läuft nach 1. */
  from?: number;
  duration?: number;
  /** true → sofort im Endzustand (z. B. beim Laden bestehenden Verlaufs). */
  skip?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const instant = reduced || skip;
  const p = useSharedValue(instant ? 1 : 0);

  useEffect(() => {
    p.value = instant ? 1 : withTiming(1, { duration, easing: Ease.out });
  }, [instant, duration, p]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [
      { translateX: (1 - p.value) * tx },
      { translateY: (1 - p.value) * ty },
      { scale: from + (1 - from) * p.value },
    ],
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}
