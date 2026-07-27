// Type.tsx — Typo-Hierarchie nach VIBE §4 / Build-Spec §7.1.
//
// Headings: Sora (geometrisch, seriös-modern, negatives Tracking). Body: System-Font. Zahlen, die ticken:
// tabular-nums. Farben kommen aus useColors() — nie graue Hex hardcoden.
import React from 'react';
import { StyleProp, Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';

import { useColors, useScheme } from '@/theme/ThemeProvider';
import { ColorToken, T } from '@/theme/theme.tokens';

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'eyebrow';
type Tone = ColorToken;

export type TypeProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
  /** tabular-nums für tickende Zahlen (Counter, Metriken, Timer). */
  tabular?: boolean;
  /** Meißel-Relief abschalten — für helle Schrift auf getönter Fläche (CTA). */
  chisel?: boolean;
  style?: StyleProp<TextStyle>;
};

// Headings: Cormorant Garamond — klassische Antiqua mit hohem Strichkontrast,
// wie griechischer Buchsatz. POSITIVES Tracking (Inschriften sind gesperrt,
// nie eng). Body bleibt System-Font (Lesbarkeit in Listen).
const HEAD = 'CormorantGaramond_700Bold';

const VARIANT_STYLE: Record<Variant, TextStyle> = {
  hero: { fontFamily: HEAD, fontSize: T.hero + 4, lineHeight: (T.hero + 4) * 1.15, letterSpacing: 0.3 },
  title: { fontFamily: HEAD, fontSize: 37, lineHeight: 44, letterSpacing: 0.3 },
  heading: { fontFamily: HEAD, fontSize: T.xl + 3, lineHeight: (T.xl + 3) * 1.2, letterSpacing: 0.3 },
  // Body: System-Font (kein fontFamily gesetzt → System).
  body: { fontSize: T.md, lineHeight: T.md * 1.45 },
  label: { fontSize: T.sm, lineHeight: T.sm * 1.3, fontWeight: '600' },
  caption: { fontSize: T.xs, lineHeight: T.xs * 1.4 },
  // Tempel-Inschrift: Uppercase mit sehr weitem Tracking.
  eyebrow: { fontSize: T.xs, lineHeight: T.xs * 1.4, fontWeight: '700', letterSpacing: 2.6, textTransform: 'uppercase' },
};

// Meißel-Relief — und es dreht sich zwischen den Themes um, weil die Physik
// sich umdreht:
//  LIGHT: dunkle Schrift auf hellem Stein = die Letter ist EINGESCHNITTEN. Der
//    Lichtgrat liegt unter der Glyphe, so wie Tageslicht auf der unteren
//    Schnittfläche einer Inschrift steht.
//  DARK: helle Schrift auf dunklem Stein heißt physikalisch das Gegenteil —
//    eine vertiefte Letter wäre dunkler als der Stein, nicht heller. Nachts
//    liest man einen Fries am Streiflicht der ERHABENEN Kante, also wirft die
//    Letter hier einen Schattengrat auf den Stein darunter. Ein heller Grat
//    unter weißer Schrift wäre ohnehin unsichtbar gewesen.
// Beide Male derselbe Versatz von 1 px, nur die Farbe kippt. Radius bleibt
// unter 1: ein weicher Schlagschatten ließe die Letter schweben statt sitzen.
type Chisel = { light: number; dark: number; dy: number };
const CHISEL: Partial<Record<Variant, Chisel>> = {
  hero: { light: 0.9, dark: 0.55, dy: 1 },
  title: { light: 0.9, dark: 0.55, dy: 1 },
  heading: { light: 0.9, dark: 0.55, dy: 1 },
  // Eyebrows sind klein: halbe Dosis, halber Versatz — sonst verschwimmt die
  // Sperrung der Tempel-Inschrift.
  eyebrow: { light: 0.45, dark: 0.3, dy: 0.5 },
};

export function Type({ variant = 'body', tone = 'text', tabular = false, chisel = true, style, ...rest }: TypeProps) {
  const colors = useColors();
  const isDark = useScheme() === 'dark';
  const toneColor = colors[tone];
  const cut = chisel ? CHISEL[variant] : undefined;
  return (
    <RNText
      style={[
        VARIANT_STYLE[variant],
        { color: toneColor },
        cut
          ? {
              textShadowColor: isDark ? `rgba(0,0,0,${cut.dark})` : `rgba(255,255,255,${cut.light})`,
              textShadowOffset: { width: 0, height: cut.dy },
              textShadowRadius: 0.6,
            }
          : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
      {...rest}
    />
  );
}
