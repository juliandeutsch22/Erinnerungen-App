// BottomSheet.tsx — Glass-Bottom-Sheet (Fahrplan §4: Editor ist ein Sheet, kein
// eigener Screen). RN-Modal mit Slide + dimmendem Backdrop; Inhalt auf einer
// Liquid-Glass-Fläche, deren untere Kanten unter den Screenrand tauchen.
import { X } from 'lucide-react-native';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { MAX_CONTENT_WIDTH } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Shadow, Spacing } from '@/theme/theme.tokens';

const SHEET_RADIUS = 32;

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop dimmt und schließt beim Tap. */}
      <Pressable accessibilityLabel="Schließen" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
        pointerEvents="box-none"
      >
        <View style={{ alignItems: 'center' }} pointerEvents="box-none">
          <Glass
            variant="card"
            radius={SHEET_RADIUS}
            intensity={90}
            style={[
              Shadow.lg,
              {
                width: '100%',
                maxWidth: MAX_CONTENT_WIDTH,
                // Untere Rundung unter den Screenrand schieben.
                marginBottom: -SHEET_RADIUS,
              },
            ]}
            contentStyle={{
              paddingHorizontal: Spacing.lg,
              paddingTop: Spacing.md,
              paddingBottom: SHEET_RADIUS + Spacing.lg + Math.max(insets.bottom, Spacing.sm),
            }}
          >
            {/* Grabber + Kopfzeile */}
            <View style={{ alignItems: 'center', paddingBottom: Spacing.sm }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border2 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
              <Type variant="heading">{title}</Type>
              <PressableScale accessibilityLabel="Schließen" onPress={onClose} style={{ padding: Spacing.xs }}>
                <X size={22} color={colors.text3} strokeWidth={2} />
              </PressableScale>
            </View>
            <ScrollView
              style={{ maxHeight: 520 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </Glass>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
