// BottomSheet.tsx — Glass-Bottom-Sheet (Fahrplan §4: Editor ist ein Sheet, kein
// eigener Screen). RN-Modal mit Slide + dimmendem Backdrop; Inhalt auf einer
// Liquid-Glass-Fläche, deren untere Kanten unter den Screenrand tauchen.
//
// Gesten: das GANZE Sheet lässt sich nach unten ziehen und schließen. Im Inhalt
// greift die Zieh-Geste nur, wenn oben (Scroll = 0) und nach unten gezogen wird —
// sonst scrollt der Inhalt normal. Umsetzung über die Gesture-Handler-eigene
// ScrollView + simultaneousWithExternalGesture (offizielles RNGH-Muster für
// „Sheet ziehen + Inhalt scrollen"); bewusst OHNE Gesture.Native/Animated.Scroll­
// View, weil diese Kombination auf dem Gerät abgestürzt ist.
//
// Tastatur: bewusst OHNE KeyboardAvoidingView UND ohne automaticallyAdjust­
// KeyboardInsets — beides schob den Inhalt in Modals ungewollt hoch (das
// Titelfeld rutschte unter die Kopfzeile). Stattdessen hebt die gemessene
// Tastaturhöhe das ganze Sheet über die Tastatur; der Inhalt scrollt im Rest.
import { X } from 'lucide-react-native';
import React, { useRef } from 'react';
import { Keyboard, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { hapticSelect } from '@/lib/haptics';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { MAX_CONTENT_WIDTH } from '@/theme/layout';
import { springConfig } from '@/theme/motion.tokens';
import { useColors } from '@/theme/ThemeProvider';
import { Shadow, Spacing } from '@/theme/theme.tokens';

const SHEET_RADIUS = 32;
// Platz für Grabber + Kopfzeile + Paddings innerhalb des Sheets.
const CHROME_HEIGHT = 120;
// Ab dieser Zieh-Distanz (oder mit Schwung) schließt das Sheet.
const DISMISS_DISTANCE = 130;
const DISMISS_VELOCITY = 900;

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Fixer Bereich unter dem Scroll-Inhalt (Primär-Button) — scrollt nie weg. */
  footer?: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();

  // Sichtbarer Raum über der Tastatur; der Inhalt scrollt innerhalb davon.
  const footerAllowance = footer ? 84 : 0;
  const available = windowHeight - keyboard - insets.top - CHROME_HEIGHT - footerAllowance - Spacing.xl;
  const contentMaxHeight = Math.max(160, Math.min(520, available));
  const bottomPad = keyboard > 0 ? Spacing.md : Math.max(insets.bottom, Spacing.sm) + Spacing.lg;

  // Zieh-Offset des Sheets (0 = Ruhelage). Nur nach unten wirksam.
  const translateY = useSharedValue(0);
  // Scroll-Position des Inhalts — die Zieh-Geste greift nur bei 0.
  const scrollY = useSharedValue(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RNGH erwartet einen lockeren Ref-Typ
  const scrollRef = useRef<any>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = e.nativeEvent.contentOffset.y;
  };

  const close = () => {
    // Tastatur zuerst schließen, damit das Sheet nicht kurz nachspringt.
    Keyboard.dismiss();
    onClose();
  };

  // --- WICHTIG: Erstelle ein Gesture-Objekt für die ScrollView. ---
  const scrollGesture = Gesture.Native();

  // Ganzes Sheet ziehbar; läuft gleichzeitig mit der ScrollView (RNGH-Muster).
  const pan = Gesture.Pan()
    .simultaneousWithExternalGesture(scrollGesture)
    .onChange((e) => {
      const dragging = translateY.value > 0;
      const atTop = scrollY.value <= 0;
      // Sheet mitziehen, wenn schon am Ziehen ODER oben + nach unten.
      if (dragging || (atTop && e.changeY > 0)) {
        translateY.value = Math.max(0, translateY.value + e.changeY);
      }
    })
    .onEnd((e) => {
      if (translateY.value > DISMISS_DISTANCE || (translateY.value > 4 && e.velocityY > DISMISS_VELOCITY)) {
        translateY.value = withTiming(windowHeight, { duration: 180 });
        runOnJS(hapticSelect)();
        runOnJS(close)();
      } else {
        translateY.value = withSpring(0, springConfig('snappy'));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => {
    const fade = Math.max(0, 1 - translateY.value / (DISMISS_DISTANCE * 2.4));
    return { opacity: translateY.value > 0 ? fade : 1 };
  });

  const header = (
    <View>
      <View style={{ alignItems: 'center', paddingBottom: Spacing.sm, paddingTop: Spacing.xs }}>
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border2 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
        <Type variant="heading">{title}</Type>
        <PressableScale accessibilityLabel="Schließen" onPress={close} style={{ padding: Spacing.xs }}>
          <X size={22} color={colors.text3} strokeWidth={2} />
        </PressableScale>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Backdrop dimmt (mit der Zieh-Distanz) und schließt beim Tap. */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="box-none">
        <Pressable accessibilityLabel="Schließen" onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        {/* Tastaturhöhe als Sockel: hebt das Sheet exakt über die Tastatur. */}
        <View style={{ alignItems: 'center', paddingBottom: keyboard }} pointerEvents="box-none">
          {/* Zieh-Geste liegt auf dem GANZEN Sheet. */}
          <GestureDetector gesture={pan}>
            <Animated.View style={[{ width: '100%', maxWidth: MAX_CONTENT_WIDTH }, sheetStyle]}>
              <Glass
                variant="card"
                radius={SHEET_RADIUS}
                intensity={90}
                style={[
                  Shadow.lg,
                  {
                    width: '100%',
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
                {header}
                {/* ScrollView in einen GestureDetector für die Native-Scroll-Geste packen */}
                <GestureDetector gesture={scrollGesture}>
                  <ScrollView
                    ref={scrollRef}
                    style={{ maxHeight: contentMaxHeight }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                  >
                    {children}
                  </ScrollView>
                </GestureDetector>
                {footer && <View style={{ paddingTop: Spacing.md }}>{footer}</View>}
              </Glass>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
