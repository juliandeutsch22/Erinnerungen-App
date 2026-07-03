// Chip.tsx — die Chip-Sprache der App (wie Cairns Experiment-Start): Auswahl-
// Pillen für Listen, Datum, Uhrzeit, Wiederholung. Aktiv = Teal-Füllung.
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { hapticSelect } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

export function Chip({
  label,
  active = false,
  onPress,
  icon: Icon,
  accessibilityLabel,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => {
        hapticSelect();
        onPress?.();
      }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
          borderRadius: R.pill,
          backgroundColor: active ? colors.teal : colors.chip,
          borderWidth: 1,
          borderColor: active ? colors.teal : colors.chipBorder,
        },
        style,
      ]}
    >
      {Icon && <Icon size={14} color={active ? '#FFFFFF' : colors.text3} strokeWidth={2} />}
      <Type variant="label" style={{ color: active ? '#FFFFFF' : colors.text2 }}>
        {label}
      </Type>
    </PressableScale>
  );
}
