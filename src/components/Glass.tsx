// Glass.tsx — Steintafel (Marmor-Design „Antikes Griechenland"): matte,
// gealterte Marmorfläche statt Liquid Glass. Drei Zutaten:
//  1. Stein-Grund   — solide Fläche aus den Tokens (nie reines Weiß).
//  2. Marmor-Textur — gebackenes fraktales Rauschen (assets/images/marble-*.jpg,
//     erzeugt via SVG-feTurbulence): Wolken, Patina, Körnung. Ein Bild statt
//     gezeichneter Linien — wirkt wie fotografierter Stein, kostet ~30 KB.
//  3. Meißel-Kante  — Lichtgrat oben, Schattengrat unten: behauene Platte.
// Karten, Tab-Bar und Pills tragen dieselbe Steinsorte; getönte Flächen (CTA)
// bleiben glatt, damit Handlung heraussticht. Die Glas-Props (intensity,
// sheenTop, …) bleiben aus Kompatibilität erhalten, sind aber ohne Wirkung.
import React from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useColors, useScheme } from '@/theme/ThemeProvider';
import { R } from '@/theme/theme.tokens';

export type GlassVariant = 'card' | 'pill' | 'bar';

// Steintafeln sind kantiger als Glas-Slabs.
const DEFAULT_RADIUS: Record<GlassVariant, number> = { card: R.xl, pill: R.pill, bar: R.lg };

const MARBLE_LIGHT = require('../../assets/images/marble-light.jpg');
const MARBLE_DARK = require('../../assets/images/marble-dark.jpg');

export type GlassProps = {
  variant?: GlassVariant;
  radius?: number;
  intensity?: number;
  tint?: string;
  sheenTop?: string;
  sheenSpan?: number;
  footerShade?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function Glass({ variant = 'card', radius, tint, style, contentStyle, children }: GlassProps) {
  const scheme = useScheme();
  const colors = useColors();
  const isDark = scheme === 'dark';
  const borderRadius = radius ?? DEFAULT_RADIUS[variant];
  const backgroundColor = tint ?? colors.bg2;
  const showTexture = !tint;
  const showChisel = !tint && variant !== 'pill';
  const inset = Math.min(borderRadius * 0.7, 16);

  return (
    <View
      style={[
        {
          borderRadius,
          backgroundColor,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {showTexture && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={isDark ? MARBLE_DARK : MARBLE_LIGHT} resizeMode="cover" style={StyleSheet.absoluteFill} />
        </View>
      )}
      {showChisel && (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: inset,
              right: inset,
              height: 2,
              backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.9)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 0,
              left: inset,
              right: inset,
              height: 2,
              backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(60,55,40,0.10)',
            }}
          />
        </>
      )}
      <View style={contentStyle}>{children}</View>
    </View>
  );
}
