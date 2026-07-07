// TimeField.tsx — Uhrzeit-Auswahl wie in den iOS-Apps: eine kompakte Pille mit
// der aktuellen Zeit, die beim Antippen ein natives Spinner-Rad aufklappt.
// Nativ über @react-native-community/datetimepicker; im Web ein Textfeld-
// Fallback (Browser haben keinen nativen Zeit-Spinner in RN-Web).
import React, { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { hapticSelect } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors, useScheme } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

const native = Platform.OS === 'ios' || Platform.OS === 'android';
const VALID = /^\d{1,2}:\d{2}$/;

function parse(value: string): Date {
  const d = new Date();
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (m) d.setHours(Math.min(23, Number(m[1])), Math.min(59, Number(m[2])), 0, 0);
  else d.setHours(9, 0, 0, 0);
  return d;
}

function fmt(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function TimeField({
  value,
  onChange,
  accessibilityLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  accessibilityLabel: string;
}) {
  const colors = useColors();
  const scheme = useScheme();
  const [open, setOpen] = useState(false);

  const pill = (active: boolean) => (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ expanded: active }}
      onPress={() => {
        hapticSelect();
        setOpen((v) => !v);
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: R.pill,
        backgroundColor: active ? colors.teal : colors.chip,
        borderWidth: 1,
        borderColor: active ? colors.teal : colors.chipBorder,
      }}
    >
      <Type variant="label" tabular style={{ color: active ? '#FFFFFF' : colors.text2 }}>
        {VALID.test(value) ? value : '––:––'}
      </Type>
    </PressableScale>
  );

  if (!native) {
    // Web: direktes Textfeld (HH:MM).
    return (
      <TextInput
        value={value}
        onChangeText={(v) => onChange(/^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, '0') : v)}
        placeholder="09:00"
        placeholderTextColor={colors.text3}
        accessibilityLabel={accessibilityLabel}
        style={[
          {
            fontSize: T.md,
            color: colors.text,
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.md,
            borderRadius: R.pill,
            borderWidth: 1,
            borderColor: colors.chipBorder,
            backgroundColor: colors.chip,
            minWidth: 84,
            textAlign: 'center',
          },
          webNoOutline,
        ]}
      />
    );
  }

  // Lazy require, damit der Web-Bundle das native Modul nicht zieht.
  const DateTimePicker = require('@react-native-community/datetimepicker').default;

  return (
    <View style={{ gap: Spacing.sm }}>
      {pill(open)}
      {open && (
        <View style={{ alignItems: 'center', borderRadius: R.lg, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.chipBorder }}>
          <DateTimePicker
            value={parse(value)}
            mode="time"
            display="spinner"
            themeVariant={scheme}
            textColor={colors.text}
            minuteInterval={5}
            style={{ height: 180, alignSelf: 'stretch' }}
            onChange={(_event: unknown, date?: Date) => {
              if (date) onChange(fmt(date));
            }}
          />
        </View>
      )}
    </View>
  );
}
