// GlassButton.tsx — die Button-Familie der App als getönte Liquid-Glass-Pillen.
//
// primary  = satte Marken-Füllung + Glas-Kanten (Specular oben, Abdunklung
//            unten, heller Rahmen) + weicher Teal-Glow, der den CTA schweben
//            lässt. KEIN vollflächiger Weiß→Farbe-Verlauf (sähe billig aus).
// secondary= ruhige Glas-Well (Chip) mit Akzent-Label — für Neben-Aktionen.
// sizes    = md (CTA, 52pt) / sm (Inline-Aktionen, 40pt).
// Touch-Licht: die Scheibe hellt beim Drücken kurz auf (Opacity-only).
import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { hapticTap } from '@/lib/haptics';
import { Dur } from '@/theme/motion.tokens';
import { useColors, useScheme } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export type GlassButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  tone?: 'teal' | 'indigo';
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
};

export function GlassButton({
  children,
  onPress,
  disabled = false,
  accessibilityLabel,
  tone = 'teal',
  variant = 'primary',
  size = 'md',
  style,
}: GlassButtonProps) {
  const colors = useColors();
  const isDark = useScheme() === 'dark';
  const isPrimary = variant === 'primary';

  // Füllung: primary = satte, gleichmäßige Marken-Farbe (Glas-Eindruck kommt
  // aus den Kanten-Schichten, nicht aus der Fläche); secondary = helle Well.
  const tint = disabled
    ? hexToRgba('#9AA0A6', isDark ? 0.22 : 0.32)
    : isPrimary
      ? hexToRgba(colors[tone], isDark ? 0.82 : 0.9)
      : isDark
        ? 'rgba(255,255,255,0.09)'
        : 'rgba(255,255,255,0.55)';

  // Weicher Akzent-Glow + Float-Schatten — nur primary & aktiv. Lässt den CTA
  // über der Fläche schweben statt aufgeklebt zu wirken. Skaliert mit der
  // Größe: der große CTA strahlt, kleine Aktionen bleiben dezent.
  const glow =
    isPrimary && !disabled
      ? size === 'md'
        ? { shadowColor: colors[tone], shadowOpacity: isDark ? 0.45 : 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 }
        : { shadowColor: colors[tone], shadowOpacity: isDark ? 0.3 : 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 }
      : null;

  const rimColor = isPrimary
    ? 'rgba(255,255,255,0.35)'
    : isDark
      ? 'rgba(255,255,255,0.14)'
      : 'rgba(0,0,0,0.08)';

  const metrics =
    size === 'md'
      ? { minHeight: 52, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg }
      : { minHeight: 40, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md };

  const handlePress = () => {
    if (disabled) return;
    hapticTap();
    onPress?.();
  };

  // Touch-Licht (Opacity-only → Reduced-Motion-unkritisch).
  const pressLight = useSharedValue(0);
  const lightStyle = useAnimatedStyle(() => ({ opacity: pressLight.value }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={() => {
        if (!disabled) pressLight.value = withTiming(1, { duration: Dur.press });
      }}
      onPressOut={() => {
        pressLight.value = withTiming(0, { duration: Dur.pressOut * 2 });
      }}
      style={style}
    >
      <Glass
        variant="pill"
        tint={tint}
        // Dezenter Top-Highlight statt vollflächigem Sheen.
        sheenTop={disabled ? 'rgba(255,255,255,0)' : isPrimary ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.14)'}
        sheenSpan={0.42}
        // Weiche Abdunklung unten für Dimensionalität (nur primary).
        footerShade={isPrimary && !disabled ? 'rgba(0,0,0,0.12)' : undefined}
        style={[{ borderColor: rimColor, borderWidth: 1 }, glow]}
        contentStyle={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Spacing.sm,
          ...metrics,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: isPrimary ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.28)', borderRadius: 999 }, lightStyle]}
        />
        {children}
      </Glass>
    </PressableScale>
  );
}
