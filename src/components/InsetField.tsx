// InsetField.tsx — eine Schreibfläche, die IN der Steinplatte liegt statt auf
// ihr.
//
// Warum es das gibt: Ein Eingabefeld war bisher überall ein gefülltes Rechteck
// mit Radius, das mittig auf der Karte schwebte — mit Luft an allen vier Seiten
// und (je nach Bildschirm) mal mit, mal ohne Haarlinie. Auf einer behauenen
// Platte liest sich das als aufgeklebtes Plättchen; genau das war die Kritik an
// der Abendbetrachtung.
//
// Die Lösung ist dieselbe Physik wie beim Meißel in Glass.tsx/Type.tsx, nur
// umgekehrt: Die PLATTE trägt den Lichtgrat oben und den Schattengrat unten
// (Licht von links oben, das Material steht hervor). Eine MULDE muss das
// spiegeln — oben fällt der Schatten der Kante hinein, unten fängt die innere
// Wand das Licht. Deshalb hier: Schattengrat OBEN, Lichtgrat UNTEN. Wer die
// beiden vertauscht, macht aus der Mulde wieder ein Plättchen.
//
// Und weil eine Mulde eine Vertiefung IST, trägt sie keine Umrandung — dieselbe
// Regel wie bei der Platte: behauen, nicht gezeichnet.
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useColors, useScheme } from '@/theme/ThemeProvider';
import { R } from '@/theme/theme.tokens';

export function InsetField({
  children,
  style,
  radius = R.md,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  radius?: number;
}) {
  const colors = useColors();
  const isDark = useScheme() === 'dark';
  // Die Grate enden vor den Ecken — wie bei der Platte, sonst zeichnen sie das
  // Rechteck nach, das wir gerade loswerden wollen.
  const inset = Math.min(radius * 0.7, 12);

  return (
    <View style={[{ borderRadius: radius, backgroundColor: colors.sunk, overflow: 'hidden' }, style]}>
      {children}
      {/* Oben: der Schatten, den die Kante in die Mulde wirft. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: inset,
          right: inset,
          height: 2,
          backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(60,55,40,0.14)',
        }}
      />
      {/* Unten: die innere Wand, die das Licht fängt. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: inset,
          right: inset,
          height: 2,
          backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.9)',
        }}
      />
      {/* Seitliche Fasen, sehr schwach — sie deuten die Tiefe an. Links liegt
          im Schatten, rechts im Licht: die Umkehr der Platte. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: inset,
          bottom: inset,
          left: 0,
          width: StyleSheet.hairlineWidth * 2,
          backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(60,55,40,0.07)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: inset,
          bottom: inset,
          right: 0,
          width: StyleSheet.hairlineWidth * 2,
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.5)',
        }}
      />
    </View>
  );
}
