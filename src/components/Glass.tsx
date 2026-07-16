// Glass.tsx — Liquid Glass (iOS 26), Schichten (VIBE §6) + Sheen und Specular-
// Kantenlicht für den „leicht metallischen" Premium-Eindruck (VIBE §7: Licht auf Kanten).
//
// Schichten (hinten→vorn):
//  1. BlurView          — Backdrop-Blur, im overflow:hidden-Wrapper.
//  2. Tint-Wash         — halbtransparente Farb-/Dunkel-Lage.
//  3. Sheen             — vertikaler Gradient (oben heller → transparent): gewölbtes Glas.
//  4. Diagonal-Sheen    — schmale Lichtbahn quer über die Scheibe (metallic, nur card).
//  4b. Sheen-Sweep      — einmalige Lichtwanderung beim Erscheinen (reduced-motion-gegated).
//  5. Specular-Ring     — Lichtkanten oben/unten/links/rechts: geschliffene Platte.
//     Unterkante mit warmem Schimmer (Terrakotta→Weiß→Salbei), bewusst leise —
//     matte Keramik statt Hochglanz (mediterran).
//  6. Bottom-Depth      — weicher innerer Schatten unten (Wölbung).
//  7. Innen-Rand        — 1px eingerückter heller Rand: Illusion von Glasdicke.
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useReducedMotion, useScheme } from '@/theme/ThemeProvider';
import { R } from '@/theme/theme.tokens';

export type GlassVariant = 'card' | 'pill' | 'bar';

type Recipe = { bg: string; border: string; highlight: string; sheenTop: string };

// Tint-Rezepte (bg / border / highlight) aus VIBE §6, ergänzt um sheenTop (Sheen-Startfarbe).
const RECIPES: Record<GlassVariant, { dark: Recipe; light: Recipe }> = {
  // Apple-„Liquid Glass": Hintergrund scheint leicht durch (translucent), aber
  // etwas deckender als iOS; kräftiges Specular-Kantenlicht.
  // Mediterran: Sheens/Highlights eine Stufe leiser als das iOS-Original —
  // matte, sonnengebleichte Keramik statt Hochglanz-Vitrine.
  card: {
    dark: { bg: 'rgba(20,16,12,0.24)', border: 'rgba(255,255,255,0.18)', highlight: 'rgba(255,255,255,0.4)', sheenTop: 'rgba(255,255,255,0.09)' },
    light: { bg: 'rgba(255,255,255,0.26)', border: 'rgba(60,40,20,0.09)', highlight: 'rgba(255,255,255,0.55)', sheenTop: 'rgba(255,255,255,0.5)' },
  },
  pill: {
    dark: { bg: 'rgba(255,255,255,0.10)', border: 'rgba(255,255,255,0.22)', highlight: 'rgba(255,255,255,0.35)', sheenTop: 'rgba(255,255,255,0.10)' },
    light: { bg: 'rgba(255,255,255,0.40)', border: 'rgba(60,40,20,0.08)', highlight: 'rgba(255,255,255,0.5)', sheenTop: 'rgba(255,255,255,0.4)' },
  },
  bar: {
    dark: { bg: 'rgba(16,12,10,0.38)', border: 'rgba(255,255,255,0.15)', highlight: 'rgba(255,255,255,0.3)', sheenTop: 'rgba(255,255,255,0.04)' },
    light: { bg: 'rgba(255,255,255,0.36)', border: 'rgba(60,40,20,0.06)', highlight: 'rgba(255,255,255,0.5)', sheenTop: 'rgba(255,255,255,0.28)' },
  },
};

const DEFAULT_RADIUS: Record<GlassVariant, number> = { card: R.xl, pill: R.pill, bar: 28 };

// Markenfarben als Kanten-Chromatik (§ Farb-Regel: nur die zwei Haupt-Akzente).
const TERRA_FRINGE = (a: number) => `rgba(201,106,71,${a})`;
const SAGE_FRINGE = (a: number) => `rgba(116,147,107,${a})`;

function bumpAlpha(rgba: string, delta: number): string {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgba;
  const parts = m[1].split(',').map((p) => p.trim());
  if (parts.length < 4) return rgba;
  const a = Math.min(1, parseFloat(parts[3]) + delta);
  return `rgba(${parts[0]},${parts[1]},${parts[2]},${a})`;
}

export type GlassProps = {
  variant?: GlassVariant;
  radius?: number;
  intensity?: number;
  // Optionaler Farb-Tint statt des Standard-Wash (z. B. Teal für den CTA-Button).
  // Der Rest der Glas-Schichten (Blur, Sheen, Specular-Kante) bleibt erhalten.
  tint?: string;
  // Überschreibt die Sheen-Startfarbe. Für getönte Flächen (CTA) bewusst dezent,
  // damit kein vollflächiger Weiß→Farbe-Verlauf entsteht (sähe billig aus).
  sheenTop?: string;
  // Höhe des Sheen-Fades (Anteil). Default 0.7. Kleiner = Highlight nur oben.
  sheenSpan?: number;
  // Unterer Tiefen-Shade als Farbe; aktiviert Bottom-Depth für jede Variante.
  footerShade?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function Glass({ variant = 'card', radius, intensity, tint, sheenTop, sheenSpan, footerShade, style, contentStyle, children }: GlassProps) {
  const scheme = useScheme();
  const isDark = scheme === 'dark';
  const recipe = RECIPES[variant][isDark ? 'dark' : 'light'];
  const borderRadius = radius ?? DEFAULT_RADIUS[variant];
  const blurIntensity = intensity ?? (isDark ? 54 : 72);
  const baseBg = tint ?? recipe.bg;
  const tintBg = Platform.OS === 'android' ? bumpAlpha(baseBg, 0.14) : baseBg;
  const sheenColor = sheenTop ?? recipe.sheenTop;
  const sheenEnd = sheenSpan ?? 0.7;
  const showBottomDepth = variant === 'card' || !!footerShade;
  const bottomDepthColor = footerShade ?? (isDark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.08)');
  // Kantenlicht ringsum (polierte Glas-Slab-Kante) — nur card, im Light kräftiger.
  const showEdges = variant === 'card' && !footerShade;
  // Seitenkanten mit leiser Chromatik: Terrakotta links, Salbei rechts.
  const leftEdge = isDark
    ? ['rgba(255,255,255,0)', TERRA_FRINGE(0.12), 'rgba(255,255,255,0)']
    : ['rgba(255,255,255,0)', TERRA_FRINGE(0.28), 'rgba(255,255,255,0)'];
  const rightEdge = isDark
    ? ['rgba(255,255,255,0)', SAGE_FRINGE(0.12), 'rgba(255,255,255,0)']
    : ['rgba(255,255,255,0)', SAGE_FRINGE(0.28), 'rgba(255,255,255,0)'];
  // Diagonale Sheen-Bahn (Licht wandert schräg über die Scheibe) — nur card,
  // matt gedimmt (Keramik, kein Spiegel).
  const showDiagonalSheen = variant === 'card';
  const diagonalSheen = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.26)';
  // Innen-Rand (Glasdicke) — heller 1px-Rand, leicht eingerückt.
  const innerRimColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)';
  // Chromatik an der Unterkante: Terrakotta links, Weiß mittig, Salbei rechts.
  const chroma = isDark
    ? [TERRA_FRINGE(0), TERRA_FRINGE(0.16), 'rgba(255,255,255,0.10)', SAGE_FRINGE(0.16), SAGE_FRINGE(0)]
    : [TERRA_FRINGE(0), TERRA_FRINGE(0.32), 'rgba(255,255,255,0.55)', SAGE_FRINGE(0.32), SAGE_FRINGE(0)];

  return (
    <View style={[styles.wrapper, { borderRadius, borderColor: recipe.border, borderWidth: StyleSheet.hairlineWidth }, style]}>
      {/* 1. Blur */}
      <BlurView intensity={blurIntensity} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { borderRadius }]} />
      {/* 2. Tint-Wash */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tintBg, borderRadius }]} />
      {/* 3. Sheen — vertikaler Gradient (gewölbtes Glas) */}
      <LinearGradient
        colors={[sheenColor, 'rgba(255,255,255,0)']}
        locations={[0, sheenEnd]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        pointerEvents="none"
      />
      {/* 4. Diagonale Sheen-Bahn — schmales Lichtband, das schräg über die
          Scheibe läuft (metallic). Läuft von oben-links nach unten-rechts. */}
      {showDiagonalSheen && (
        <LinearGradient
          colors={['rgba(255,255,255,0)', diagonalSheen, 'rgba(255,255,255,0)']}
          locations={[0.32, 0.5, 0.68]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.9 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          pointerEvents="none"
        />
      )}
      {/* 4b. Sheen-Sweep — Licht wandert einmal beim Erscheinen über die Scheibe. */}
      {variant === 'card' && <SheenSweep isDark={isDark} borderRadius={borderRadius} />}
      {/* 5. Specular-Top — horizontales Lichtband an der Oberkante */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', recipe.highlight, 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.specular, { borderTopLeftRadius: borderRadius, borderTopRightRadius: borderRadius }]}
        pointerEvents="none"
      />
      {/* 6. Bottom-Depth — weicher Verlauf (kein harter Block). card immer,
          sonst wenn footerShade gesetzt. */}
      {showBottomDepth && (
        <LinearGradient
          colors={['rgba(0,0,0,0)', bottomDepthColor]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.bottomDepth, { borderBottomLeftRadius: borderRadius, borderBottomRightRadius: borderRadius }]}
          pointerEvents="none"
        />
      )}
      {showEdges && (
        <>
          {/* 5b. Bottom-Specular mit Chromatik — Glas bricht Farbe an der Kante. */}
          <LinearGradient
            colors={chroma as [string, string, string, string, string]}
            locations={[0.06, 0.28, 0.5, 0.72, 0.94]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.specularBottom, { borderBottomLeftRadius: borderRadius, borderBottomRightRadius: borderRadius }]}
            pointerEvents="none"
          />
          {/* 5c. Seiten-Specular links/rechts — schließt den Licht-Ring, mit
              leichter Chromatik (Teal links, Indigo rechts). */}
          <LinearGradient
            colors={leftEdge as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.specularLeft}
            pointerEvents="none"
          />
          <LinearGradient
            colors={rightEdge as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.specularRight}
            pointerEvents="none"
          />
          {/* 7. Innen-Rand — Illusion von Glasdicke. */}
          <View
            style={[styles.innerRim, { borderRadius: Math.max(0, borderRadius - 1.5), borderColor: innerRimColor }]}
            pointerEvents="none"
          />
        </>
      )}
      {/* Content */}
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

// Einmalige Lichtwanderung beim Mount: ein schmales diagonales Band zieht von
// links nach rechts über die Scheibe. Reduced Motion → gar nicht rendern.
function SheenSweep({ isDark, borderRadius }: { isDark: boolean; borderRadius: number }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced || width === 0) return;
    progress.value = 0;
    progress.value = withDelay(350, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [reduced, width, progress]);

  const bandStyle = useAnimatedStyle(() => {
    // Band startet links außerhalb und endet rechts außerhalb der Scheibe.
    const x = -0.7 * width + progress.value * 2.1 * width;
    return { transform: [{ translateX: x }, { skewX: '-18deg' }] };
  });

  if (reduced) return null;
  const bandColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.22)';

  return (
    <View
      style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}
      pointerEvents="none"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: width * 0.45 }, bandStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', bandColor, 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { overflow: 'hidden', position: 'relative' },
  specular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  specularBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 },
  specularLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2 },
  specularRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 2 },
  innerRim: { position: 'absolute', top: 1.5, bottom: 1.5, left: 1.5, right: 1.5, borderWidth: 1 },
  bottomDepth: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 26 },
});
