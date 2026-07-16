// GlassPanel.tsx — die Steintafel, auf der Inhalt lebt: liegt flach mit
// hauchdünnem Schatten auf dem Marmor-Grund (schwebt nicht). Abschnitte
// trennt der Mäander-<Seam/>, nicht getrennte Karten.
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import { Glass } from '@/components/Glass';
import { Shadow, Spacing } from '@/theme/theme.tokens';

export function GlassPanel({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return (
    <Glass variant="card" style={[Shadow.sm, style]} contentStyle={padded ? { padding: Spacing.lg } : undefined}>
      {children}
    </Glass>
  );
}
