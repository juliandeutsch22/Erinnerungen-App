// Backdrop.tsx — ruhiger Marmor-Grund hinter den Steintafeln: ein sanfter
// Elfenbein-Verlauf (Dark: Nacht-Schiefer), ohne Aurora-Glows — die Farbe
// tragen die Akzente, nicht der Hintergrund. Optional mit Scroll-Parallax.
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { useReducedMotion, useScheme } from '@/theme/ThemeProvider';

// Wie stark der Grund dem Scroll folgt (klein = weit hinten).
const PARALLAX_FACTOR = 0.12;
// Über-Ausdehnung oben/unten, damit die Bewegung keine Ränder freilegt.
const BLEED = 80;

export function Backdrop({ scrollY }: { scrollY?: SharedValue<number> }) {
  const isDark = useScheme() === 'dark';
  const reduced = useReducedMotion();

  const base: [string, string, string] = isDark
    ? ['#0B0D10', '#000000', '#0C0E0C']
    : ['#ECE7DB', '#F6F3EA', '#E7E3D5'];

  const parallax = useAnimatedStyle(() => {
    if (!scrollY || reduced) return { transform: [{ translateY: 0 }] };
    const shift = Math.max(-BLEED, Math.min(BLEED, -scrollY.value * PARALLAX_FACTOR));
    return { transform: [{ translateY: shift }] };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { top: -BLEED, bottom: -BLEED }, parallax]}>
        <LinearGradient colors={base} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}
