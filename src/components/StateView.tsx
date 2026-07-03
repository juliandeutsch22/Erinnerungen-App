// StateView.tsx — konsistente Empty-/Loading-/Error-Zustände, editorial auf der
// Canvas (keine Karten). Ruhig, deskriptiv, nie wertend; optional sanfte Retry-Aktion.
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import React from 'react';

import { GlassButton } from '@/components/GlassButton';
import { Type } from '@/components/Type';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

export function LoadingState({ label = 'Wird geladen…' }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md }}>
      <ActivityIndicator color={colors.teal} accessibilityLabel="Lädt" />
      <Type variant="body" tone="text3">{label}</Type>
    </View>
  );
}

export function EmptyState({ title, body, icon }: { title?: string; body: string; icon?: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: Spacing.sm, paddingVertical: Spacing.md }}>
      {icon ? (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: R.md,
            backgroundColor: colors.chip,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.chipBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
      ) : null}
      {title ? <Type variant="label" tone="text2">{title}</Type> : null}
      <Type variant="body" tone="text3">{body}</Type>
    </View>
  );
}

export function ErrorState({ body = 'Etwas ist schiefgelaufen.', onRetry }: { body?: string; onRetry?: () => void }) {
  return (
    <View style={{ gap: Spacing.sm, paddingVertical: Spacing.md }}>
      <Type variant="body" tone="text3">{body}</Type>
      {onRetry && (
        <GlassButton size="sm" variant="secondary" accessibilityLabel="Erneut versuchen" onPress={onRetry} style={{ alignSelf: 'flex-start' }}>
          <Type variant="label" tone="teal">Erneut versuchen</Type>
        </GlassButton>
      )}
    </View>
  );
}
