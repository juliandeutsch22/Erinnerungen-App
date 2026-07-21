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

/** Leerzustand als stille Einladung: Glyphe in runder Stein-Well, Titel als
 *  Tempel-Inschrift, ein ruhiger Satz — überall dieselbe Geste, zentriert. */
export function EmptyState({ title, body, icon }: { title?: string; body: string; icon?: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: Spacing.sm, paddingVertical: Spacing.lg, alignItems: 'center' }}>
      {icon ? (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: R.pill,
            backgroundColor: colors.chip,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.chipBorder,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: Spacing.xs,
          }}
        >
          {icon}
        </View>
      ) : null}
      {title ? <Type variant="eyebrow" tone="text2" style={{ textAlign: 'center' }}>{title}</Type> : null}
      <Type variant="body" tone="text3" style={{ textAlign: 'center', maxWidth: 280, lineHeight: 15 * 1.5 }}>
        {body}
      </Type>
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
