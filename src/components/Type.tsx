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

// Headings: Sora (geometrisch, seriös-modern, premium) mit leicht negativem Tracking.
const HEAD_EXTRABOLD = 'Sora_800ExtraBold';
const HEAD_BOLD = 'Sora_700Bold';

const VARIANT_STYLE: Record<Variant, TextStyle> = {
  // Sora-Headings mit negativem Letterspacing (Premium-Look).
  hero: { fontFamily: HEAD_EXTRABOLD, fontSize: T.hero, lineHeight: T.hero * 1.08, letterSpacing: -1 },
  title: { fontFamily: HEAD_EXTRABOLD, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  heading: { fontFamily: HEAD_BOLD, fontSize: T.xl, lineHeight: T.xl * 1.25, letterSpacing: -0.4 },
  // Body: System-Font (kein fontFamily gesetzt → System).
  body: { fontSize: T.md, lineHeight: T.md * 1.45 },
  label: { fontSize: T.sm, lineHeight: T.sm * 1.3, fontWeight: '600' },
  caption: { fontSize: T.xs, lineHeight: T.xs * 1.4 },
  // Editorialer Overline: Uppercase mit weitem Tracking (Premium-Akzent).
  eyebrow: { fontSize: T.xs, lineHeight: T.xs * 1.4, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
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
