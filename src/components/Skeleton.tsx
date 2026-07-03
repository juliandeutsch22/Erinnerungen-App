// Skeleton.tsx — ruhiger Lade-Platzhalter statt Spinner. Sanftes Opacity-Pulsen
// (reanimated), hinter useReducedMotion gegated → dann statisch gedämpft.
import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useColors, useReducedMotion } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

const SHIMMER_MS = 900;

export function Skeleton({ width = '100%', height = 16, radius = R.sm, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle }) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(reduced ? 0.6 : 0.4);

  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(withTiming(0.85, { duration: SHIMMER_MS }), -1, true);
  }, [reduced, pulse]);

  const animStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.bg4 }, animStyle, style]} />;
}

/** Mehrzeiliger Platzhalter für den Metrik-Ledger (Eyebrow + Wert + Sparkline). */
export function MetricLedgerSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: Spacing.lg }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ gap: Spacing.sm }}>
          <Skeleton width="35%" height={10} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md }}>
            <Skeleton width="28%" height={26} />
            <Skeleton width="45%" height={28} radius={R.md} />
          </View>
        </View>
      ))}
    </View>
  );
}
