// PulseDot.tsx — sanft pulsierender Punkt: der „Herzschlag" des Jetzt-Markers
// im Tagesplan. Ein weicher Ring atmet nach außen und verblasst; der Kern
// bleibt ruhig. Reduced-Motion → nur der statische Punkt.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/theme/ThemeProvider';

export function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    p.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduced, p]);

  const ring = useAnimatedStyle(() => ({
    opacity: (1 - p.value) * 0.45,
    transform: [{ scale: 1 + p.value * 1.6 }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {!reduced && (
        <Animated.View
          style={[{ position: 'absolute', width: size, height: size, borderRadius: 999, backgroundColor: color }, ring]}
        />
      )}
      <View style={{ width: size, height: size, borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}
