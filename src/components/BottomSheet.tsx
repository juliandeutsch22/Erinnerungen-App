// BottomSheet.tsx — Glass-Bottom-Sheet (Fahrplan §4: Editor ist ein Sheet, kein
// eigener Screen). RN-Modal mit Slide + dimmendem Backdrop; Inhalt auf einer
// Liquid-Glass-Fläche, deren untere Kanten unter den Screenrand tauchen.
//
// Tastatur: bewusst OHNE KeyboardAvoidingView (in Modals unzuverlässig —
// Sheet wanderte aus dem Sichtfeld). Stattdessen hebt die gemessene
// Tastaturhöhe das Sheet an und der Inhalt schrumpft auf den sichtbaren
// Bereich, sodass das fokussierte Feld nie verdeckt wird.
import { X } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { MAX_CONTENT_WIDTH } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Shadow, Spacing } from '@/theme/theme.tokens';

const SHEET_RADIUS = 32;
// Platz für Grabber + Kopfzeile + Paddings innerhalb des Sheets.
const CHROME_HEIGHT = 120;

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
  const keyboard = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();

  // Sichtbarer Raum über der Tastatur; der Inhalt scrollt innerhalb davon.
  const available = windowHeight - keyboard - insets.top - CHROME_HEIGHT - Spacing.xl;
  const contentMaxHeight = Math.max(160, Math.min(520, available));
  const bottomPad = keyboard > 0 ? Spacing.md : Math.max(insets.bottom, Spacing.sm) + Spacing.lg;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop dimmt und schließt beim Tap. */}
      <Pressable accessibilityLabel="Schließen" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        {/* Tastaturhöhe als Sockel: hebt das Sheet exakt über die Tastatur. */}
        <View style={{ alignItems: 'center', paddingBottom: keyboard }} pointerEvents="box-none">
          <Glass
            variant="card"
            radius={SHEET_RADIUS}
            intensity={90}
            style={[
              Shadow.lg,
              {
                width: '100%',
                maxWidth: MAX_CONTENT_WIDTH,
                // Untere Rundung unter den Screenrand bzw. hinter die Tastatur schieben.
                marginBottom: -SHEET_RADIUS,
              },
            ]}
            contentStyle={{
              paddingHorizontal: Spacing.lg,
              paddingTop: Spacing.md,
              paddingBottom: SHEET_RADIUS + bottomPad,
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
              style={{ maxHeight: contentMaxHeight }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
            >
              {children}
            </ScrollView>
          </Glass>
        </View>
      </View>
    </Modal>
  );
}
