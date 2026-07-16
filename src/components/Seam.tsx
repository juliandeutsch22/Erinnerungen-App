// Seam.tsx — Trennung zwischen Abschnitten, in zwei Stufen:
//  'line' (Default)  — schlichte Haarlinie für gewöhnliche Trennungen.
//  'ornament'        — der Mäander-Fries, bewusst SPARSAM: höchstens einmal
//                      pro Tafel, für DIE Haupt-Trennung (z. B. vor
//                      „Erledigt"). Ornamente wirken durch Seltenheit.
import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export function Seam({
  marginVertical = Spacing.lg,
  variant = 'line',
}: {
  marginVertical?: number;
  variant?: 'ornament' | 'line';
}) {
  const colors = useColors();

  if (variant === 'line') {
    return <View style={{ marginVertical, height: 1, backgroundColor: colors.border }} />;
  }

  return (
    <View style={{ marginVertical, height: 10, opacity: 0.5 }}>
      <Svg width="100%" height="10">
        <Defs>
          <Pattern id="maeander" patternUnits="userSpaceOnUse" width="12" height="10">
            <Path d="M0 1 H12 M11 1 V9 H3 V4 H7.5 V6.5" stroke={colors.teal} strokeWidth="1.4" fill="none" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="10" fill="url(#maeander)" />
      </Svg>
    </View>
  );
}
