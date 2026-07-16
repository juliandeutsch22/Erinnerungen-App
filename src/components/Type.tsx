// Type.tsx — Typo-Hierarchie nach VIBE §4 / Build-Spec §7.1.
//
// Headings: Sora (geometrisch, seriös-modern, negatives Tracking). Body: System-Font. Zahlen, die ticken:
// tabular-nums. Farben kommen aus useColors() — nie graue Hex hardcoden.
import React from 'react';
import { StyleProp, Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { ColorToken, T } from '@/theme/theme.tokens';

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'eyebrow';
type Tone = ColorToken;

export type TypeProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
  /** tabular-nums für tickende Zahlen (Counter, Metriken, Timer). */
  tabular?: boolean;
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

export function Type({ variant = 'body', tone = 'text', tabular = false, style, ...rest }: TypeProps) {
  const colors = useColors();
  const toneColor = colors[tone];
  return (
    <RNText
      style={[
        VARIANT_STYLE[variant],
        { color: toneColor },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
      {...rest}
    />
  );
}
