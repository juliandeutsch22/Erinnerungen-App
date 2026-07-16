// Seam.tsx — Mäander-Fries als Trennung zwischen Abschnitten: der klassische
// griechische Schlüssel als fortlaufendes SVG-Pattern, ruhig und flach in
// Lapis. DAS antike Erkennungszeichen der App.
import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export function Seam({ marginVertical = Spacing.lg }: { marginVertical?: number }) {
  const colors = useColors();
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
