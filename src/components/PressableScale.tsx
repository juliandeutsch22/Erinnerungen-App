// PressableScale.tsx — eine Bewegung pro Aktion: Scale-Pop beim Drücken,
// `tight`-Spring beim Loslassen (kein Overshoot, "Material schnappt zurück").
// Gate Bewegung hinter useReducedMotion (Opacity-Feedback bleibt erhalten).
import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Dur } from '@/theme/motion.tokens';
import { springConfig } from '@/theme/motion.tokens';
import { useReducedMotion } from '@/theme/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = PressableProps & {
  /** Ziel-Scale beim Drücken (Default 0.96). */
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function PressableScale({
  pressedScale = 0.96,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(e) => {
        if (reduced) {
          opacity.value = withTiming(0.7, { duration: Dur.press });
        } else {
          scale.value = withTiming(pressedScale, { duration: Dur.press });
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (reduced) {
          opacity.value = withTiming(1, { duration: Dur.pressOut });
        } else {
          scale.value = withSpring(1, springConfig('tight'));
        }
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
