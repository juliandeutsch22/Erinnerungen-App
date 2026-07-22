// Backdrop.tsx — SÄULEN-PREVIEW v2: ruhiger Marmor-Grund + Halbsäulen links
// und rechts als hauchzartes Architektur-Wasserzeichen. KEINE Konturlinien —
// die Säule wird rein über weiche Hell-Dunkel-Flächen modelliert (Kanneluren
// als Schattierungs-Bahnen, Formschatten an der Seite), wie Licht auf Stein.
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

import { useReducedMotion, useScheme } from '@/theme/ThemeProvider';

// Wie stark der Grund dem Scroll folgt (klein = weit hinten).
const PARALLAX_FACTOR = 0.12;
// Über-Ausdehnung oben/unten, damit die Bewegung keine Ränder freilegt.
const BLEED = 80;

/** Tempel-Dach über die volle Breite, verbunden mit den Säulen: flaches
 *  Tympanon-Dreieck + Gebälk-Balken + die beiden KAPITELLE (Abakus/Echinus)
 *  direkt unter dem Balken — die Schäfte schließen exakt darunter an.
 *  Rein tonal, keine Konturlinien. viewBox 400×120, gestreckt. */
function Pediment({ tone, opacity }: { tone: string; opacity: number }) {
  return (
    <Svg width="100%" height="120" viewBox="0 0 400 120" preserveAspectRatio="none" opacity={opacity}>
      <Defs>
        {/* Weiche Schattenkante unter dem Balken — läuft in den Inhalt aus. */}
        <SvgGradient id="roof-shadow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tone} stopOpacity="0.55" />
          <Stop offset="1" stopColor={tone} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      {/* Tympanon — das flache Giebeldreieck. */}
      <Path d="M0 60 L200 6 L400 60 Z" fill={tone} fillOpacity="0.34" />
      {/* Gebälk-Balken (Architrav). */}
      <Rect x="0" y="60" width="400" height="24" fill={tone} fillOpacity="0.5" />
      {/* Schatten unter dem Balken (zwischen den Säulen). */}
      <Rect x="70" y="84" width="260" height="14" fill="url(#roof-shadow)" />
      {/* Kapitell links: Abakus + Echinus, verjüngt auf die Schaftbreite. */}
      <Rect x="-20" y="84" width="100" height="15" fill={tone} fillOpacity="0.5" />
      <Path d="M-20 99 H76 C70 110, 66 115, 62 120 H-20 Z" fill={tone} fillOpacity="0.44" />
      {/* Kapitell rechts (gespiegelt). */}
      <Rect x="320" y="84" width="100" height="15" fill={tone} fillOpacity="0.5" />
      <Path d="M420 99 H324 C330 110, 334 115, 338 120 H420 Z" fill={tone} fillOpacity="0.44" />
    </Svg>
  );
}

/** Dorische Säule, rein tonal modelliert (viewBox 200×1000):
 *  Silhouette als Fläche, Kanneluren als weiche Schattierungs-Bahnen,
 *  Formschatten rechts — keine einzige Konturlinie. */
function DoricColumn({ tone, opacity, flip = false }: { tone: string; opacity: number; flip?: boolean }) {
  const id = flip ? 'l' : 'r';
  // Kanneluren-Bahnen: 6 Rillen über den Schaft (x-Start je Bahn, Breite 18).
  const grooves = [42, 64, 86, 108, 130, 152];
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 200 1000"
      preserveAspectRatio="xMidYMid slice"
      opacity={opacity}
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Defs>
        {/* Rille: Schatten läuft weich von links in die Tiefe und wieder heraus. */}
        <SvgGradient id={`groove-${id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={tone} stopOpacity="0" />
          <Stop offset="0.45" stopColor={tone} stopOpacity="0.55" />
          <Stop offset="0.65" stopColor={tone} stopOpacity="0.15" />
          <Stop offset="1" stopColor={tone} stopOpacity="0" />
        </SvgGradient>
        {/* Formschatten: die dem Licht abgewandte Seite dunkelt weich ab. */}
        <SvgGradient id={`form-${id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={tone} stopOpacity="0" />
          <Stop offset="0.7" stopColor={tone} stopOpacity="0.35" />
          <Stop offset="1" stopColor={tone} stopOpacity="0.6" />
        </SvgGradient>
      </Defs>

      {/* Schaft-Silhouette: gefüllte Fläche, leicht verjüngt — beginnt oben
          bündig unterm Kapitell (das im Dach gezeichnet ist). */}
      <Path d="M38 0 L30 1000 H170 L162 0 Z" fill={tone} fillOpacity="0.22" />
      {/* Kanneluren als Schattierungs-Bahnen. */}
      {grooves.map((x, i) => (
        <Rect key={i} x={x} y={0} width={18} height={1000} fill={`url(#groove-${id})`} />
      ))}
      {/* Formschatten über der rechten Schafthälfte. */}
      <Rect x="100" y="0" width="66" height="1000" fill={`url(#form-${id})`} />
    </Svg>
  );
}

export function Backdrop({ scrollY }: { scrollY?: SharedValue<number> }) {
  const isDark = useScheme() === 'dark';
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();

  const base: [string, string, string] = isDark
    ? ['#0B0D10', '#000000', '#0C0E0C']
    : ['#ECE7DB', '#F6F3EA', '#E7E3D5'];

  // Tempelfront: Light in Santorini-Kuppel-Blau (blaugewaschene Architektur
  // auf gekalkter Wand), Dark in Weiß — Marmor im Mondlicht.
  const tone = isDark ? '#EDEFF2' : '#2B5FA6';
  const opacity = isDark ? 0.14 : 0.11;
  // Säulenbreite: monumental (halbe Screenbreite), am Rand angeschnitten.
  const colWidth = width * 0.52;

  const parallax = useAnimatedStyle(() => {
    if (!scrollY || reduced) return { transform: [{ translateY: 0 }] };
    const shift = Math.max(-BLEED, Math.min(BLEED, -scrollY.value * PARALLAX_FACTOR));
    return { transform: [{ translateY: shift }] };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { top: -BLEED, bottom: -BLEED }, parallax]}>
        <LinearGradient colors={base} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* Giebeldach mit Kapitellen am oberen Rand. */}
        <View style={{ position: 'absolute', top: BLEED, left: 0, right: 0, height: 120 }}>
          <Pediment tone={tone} opacity={opacity} />
        </View>
        {/* Schäfte links + rechts — schließen bündig unter den Kapitellen an. */}
        <View style={{ position: 'absolute', top: BLEED + 118, bottom: 0, left: -colWidth * 0.55, width: colWidth }}>
          <DoricColumn tone={tone} opacity={opacity} flip />
        </View>
        <View style={{ position: 'absolute', top: BLEED + 118, bottom: 0, right: -colWidth * 0.55, width: colWidth }}>
          <DoricColumn tone={tone} opacity={opacity} />
        </View>
      </Animated.View>
    </View>
  );
}
