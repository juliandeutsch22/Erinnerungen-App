// GlassPanel.tsx — die schwebende Liquid-Glass-Fläche, auf der Inhalt lebt
// (Squircle, satter Float-Schatten). Einheitliche Behandlung über alle Screens;
// interne Abschnitte werden durch <Seam/> getrennt, nicht durch getrennte Karten.
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import { Glass } from '@/components/Glass';
import { useScheme } from '@/theme/ThemeProvider';
import { Shadow, Spacing } from '@/theme/theme.tokens';

export function GlassPanel({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const isDark = useScheme() === 'dark';
  // Light braucht einen satteren Float-Schatten für Figur-Grund-Trennung;
  // im Dark trägt die Kante das Heben, der Schatten bleibt dezenter.
  const shadowOpacity = isDark ? 0.16 : 0.22;
  return (
    <Glass
      variant="card"
      radius={36}
      style={[Shadow.lg, { shadowOpacity, shadowRadius: 48, shadowOffset: { width: 0, height: 24 } }, style]}
      contentStyle={padded ? { padding: Spacing.lg } : undefined}
    >
      {children}
    </Glass>
  );
}
