// Backdrop.tsx — Santorini-Grund hinter den Steintafeln: oben ein zarter
// Ägäis-Himmel, der in Elfenbein-Marmor ausläuft — weiße Tafeln vor blauem
// Himmel (Dark: Nachthimmel über der Ägäis). Optional mit Scroll-Parallax.
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
    ? ['#0A1424', '#000000', '#0B0D10']
    : ['#C9DCEF', '#F2F0E5', '#EAE6D8'];

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
