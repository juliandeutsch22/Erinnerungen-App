// Seam.tsx — fein leuchtende „Naht" zwischen zwei Flächen (VIBE §7: leuchtende
// Nähte/seams als metallisches Detail). Trennt Abschnitte innerhalb eines Glas-
// Panels, ohne sie in getrennte Karten zu zerlegen.
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { Shadow, Spacing } from '@/theme/theme.tokens';

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

export function Seam({ marginVertical = Spacing.lg }: { marginVertical?: number }) {
  const colors = useColors();
  return (
    <View style={{ marginVertical, height: 1, borderRadius: 1, ...Shadow.glow(colors.teal), shadowOpacity: 0.25, shadowRadius: 8 }}>
      <LinearGradient
        colors={['rgba(0,0,0,0)', hexToRgba(colors.teal, 0.55), 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1, borderRadius: 1 }}
      />
    </View>
  );
}
