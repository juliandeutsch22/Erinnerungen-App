// SheetParts.tsx — geteilte Bausteine der Editor-Sheets, damit alle Sheets
// dieselbe Sprache sprechen (iOS-Grouped-Look): die gerundete Sammel-Karte,
// ihr an der Textkante eingerückter Trenner und der aufgeklappte Zeilen-Inhalt.
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

/** Gerundete Sammel-Fläche für Detail-/Aktionszeilen. */
export function Group({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ borderRadius: R.lg, backgroundColor: colors.chip, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.chipBorder, overflow: 'hidden' }}>
      {children}
    </View>
  );
}

/** Trenner innerhalb der Gruppe — an der Textkante eingerückt (wie iOS). */
export function RowDivider() {
  const colors = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: Spacing.md * 2 + 18 }} />;
}

/** Aufgeklappter Inhalt einer Zeile — eingerückt, sitzt optisch an der Zeile. */
export function Expanded({ children }: { children: React.ReactNode }) {
  return <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, paddingTop: Spacing.xs }}>{children}</View>;
}
