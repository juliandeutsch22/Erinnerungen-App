// KeyboardDone.tsx — schmale „Fertig"-Leiste über der iOS-Tastatur für
// mehrzeilige Textfelder (die haben keine Done-Taste). iOS-only:
// InputAccessoryView existiert nur dort, auf Web/Android rendert nichts.
// Nutzung: <KeyboardDoneBar /> einmal im Screen mounten und den TextInputs
// inputAccessoryViewID={KEYBOARD_DONE_ID} geben.
import React from 'react';
import { InputAccessoryView, Keyboard, Platform, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export const KEYBOARD_DONE_ID = 'keyboard-done-bar';

/** iOS: gibt die ID nur dort zurück, wo die Leiste existiert. */
export const keyboardDoneProps = Platform.OS === 'ios' ? { inputAccessoryViewID: KEYBOARD_DONE_ID } : {};

export function KeyboardDoneBar() {
  const colors = useColors();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          backgroundColor: colors.bg3,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
        }}
      >
        <PressableScale
          accessibilityLabel="Tastatur ausblenden"
          onPress={() => Keyboard.dismiss()}
          style={{ paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm }}
        >
          <Type variant="label" tone="teal">Fertig</Type>
        </PressableScale>
      </View>
    </InputAccessoryView>
  );
}
