// Reveal.tsx — sanftes Einschweben beim Mounten (Opacity + leichtes Anheben).
// Web-sicher: endet garantiert im sichtbaren Zustand. Reduced-Motion → sofort da.
import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/theme/ThemeProvider';

export function Reveal({ children, delay = 0, distance = 14, style }: { children: React.ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    p.value = reduced ? 1 : withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [reduced, delay, p]);

  const animStyle = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * distance }] }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}
