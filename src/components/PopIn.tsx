// PopIn.tsx — kleiner Auftritt für bedingt gerenderte Elemente (Senden-Button,
// Parser-Chips): federt beim Mounten von 60 % auf volle Größe statt hart
// aufzupoppen. Eine Bewegung pro Aktion; Reduced-Motion → sofort da.
import React, { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springConfig } from '@/theme/motion.tokens';
import { useReducedMotion } from '@/theme/ThemeProvider';

export function PopIn({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    p.value = reduced ? 1 : withSpring(1, springConfig('snappy'));
  }, [reduced, p]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.6 + p.value * 0.4 }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
