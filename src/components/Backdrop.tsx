// Backdrop.tsx — Aurora-Hintergrund mit Tiefe: Basis-Verlauf + zwei Radial-Glows
// (Terrakotta oben-links, Salbei unten-rechts). Gibt dem Liquid Glass etwas zum Brechen.
// Optional mit Scroll-Parallax: das Feld bewegt sich langsamer als der Inhalt →
// die Glasflächen schweben sichtbar ÜBER einem lebendigen Grund.
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useColors, useReducedMotion, useScheme } from '@/theme/ThemeProvider';

// Wie stark die Aurora dem Scroll folgt (klein = weit hinten).
const PARALLAX_FACTOR = 0.12;
// Über-Ausdehnung oben/unten, damit die Bewegung keine Ränder freilegt.
const BLEED = 80;

export function Backdrop({ scrollY }: { scrollY?: SharedValue<number> }) {
  const colors = useColors();
  const isDark = useScheme() === 'dark';
  const reduced = useReducedMotion();
  // Mediterran gedimmt: sonnengebleichtes Licht statt satter Aurora — die
  // Farbe liegt im Grundverlauf, die Glows setzen nur noch sanfte Pole.
  const tealOp = isDark ? 0.22 : 0.30;
  const indigoOp = isDark ? 0.18 : 0.26;

  // Basis-Verlauf: Terrakotta-Sand oben → Salbei unten (mediterranes Licht).
  // Light bewusst eine Stufe tiefer/satter, damit die Frost-Platten hell
  // DAGEGEN leuchten (Figur-Grund).
  const base: [string, string, string] = isDark ? ['#120B07', '#000000', '#0A0E08'] : ['#EAD5C2', '#EFE6DB', '#DDE0CE'];

  const parallax = useAnimatedStyle(() => {
    if (!scrollY || reduced) return { transform: [{ translateY: 0 }] };
    const shift = Math.max(-BLEED, Math.min(BLEED, -scrollY.value * PARALLAX_FACTOR));
    return { transform: [{ translateY: shift }] };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { top: -BLEED, bottom: -BLEED }, parallax]}>
        <LinearGradient colors={base} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="aurora-teal" cx="16%" cy="10%" r="65%">
              <Stop offset="0" stopColor={colors.teal} stopOpacity={tealOp} />
              <Stop offset="1" stopColor={colors.teal} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="aurora-indigo" cx="92%" cy="94%" r="70%">
              <Stop offset="0" stopColor={colors.indigo} stopOpacity={indigoOp} />
              <Stop offset="1" stopColor={colors.indigo} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#aurora-teal)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#aurora-indigo)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
