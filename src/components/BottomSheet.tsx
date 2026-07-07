// BottomSheet.tsx — Glass-Bottom-Sheet (Fahrplan §4: Editor ist ein Sheet, kein
// eigener Screen). RN-Modal mit Slide + dimmendem Backdrop; Inhalt auf einer
// Liquid-Glass-Fläche, deren untere Kanten unter den Screenrand tauchen.
//
// Gesten: das GANZE Sheet lässt sich nach unten ziehen und schließen. Im Inhalt
// greift die Geste nur, wenn oben (Scroll = 0) und nach unten gezogen wird —
// sonst scrollt der Inhalt normal (iOS-Standard). Backdrop dimmt mit der Distanz.
//
// Tastatur: bewusst OHNE KeyboardAvoidingView UND ohne automaticallyAdjust­
// KeyboardInsets (beides schob den Inhalt in Modals ungewollt hoch). Stattdessen
// hebt die gemessene Tastaturhöhe das ganze Sheet über die Tastatur; der Inhalt
// scrollt innerhalb des sichtbaren Rests — das fokussierte Feld bleibt sichtbar.
import { X } from 'lucide-react-native';
import React from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
  // Aktuelle Scroll-Position des Inhalts — die Zieh-Geste greift nur bei 0.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const close = () => {
    // Tastatur zuerst schließen, damit das Sheet nicht kurz nachspringt.
    Keyboard.dismiss();
    onClose();
  };

  // Loslassen: über der Schwelle (oder mit Schwung) schließen, sonst zurückfedern.
  const finishDrag = (velocityY: number) => {
    'worklet';
    if (translateY.value > DISMISS_DISTANCE || (translateY.value > 4 && velocityY > DISMISS_VELOCITY)) {
      translateY.value = withTiming(windowHeight, { duration: 180 });
      runOnJS(hapticSelect)();
      runOnJS(close)();
    } else {
      translateY.value = withSpring(0, springConfig('snappy'));
    }
  };

  // Kopfzeile/Grabber: zieht das Sheet immer (wie der iOS-Grabber).
  const headerPan = Gesture.Pan()
    .onChange((e) => {
      translateY.value = Math.max(0, translateY.value + e.changeY);
    })
    .onEnd((e) => finishDrag(e.velocityY));

  // Native Scroll-Geste, damit die Inhalts-Pan gleichzeitig mit dem Scrollen läuft.
  const nativeScroll = Gesture.Native();

  // Inhalt: zieht das Sheet nur, wenn oben (Scroll = 0) und nach unten — sonst
  // scrollt der Inhalt normal.
  const contentPan = Gesture.Pan()
    .onChange((e) => {
      const dragging = translateY.value > 0;
      const atTop = scrollY.value <= 0;
      if (dragging || (atTop && e.changeY > 0)) {
        translateY.value = Math.max(0, translateY.value + e.changeY);
      }
    })
    .onEnd((e) => finishDrag(e.velocityY));

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
                  <GestureDetector gesture={headerPan}>{header}</GestureDetector>
                  <GestureDetector gesture={Gesture.Simultaneous(nativeScroll, contentPan)}>
                    <Animated.ScrollView
                      style={{ maxHeight: contentMaxHeight }}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      bounces={false}
                      onScroll={onScroll}
                      scrollEventThrottle={16}
                    >
                      {children}
                    </Animated.ScrollView>
                  </GestureDetector>
                  {footer && <View style={{ paddingTop: Spacing.md }}>{footer}</View>}
                </Glass>
              </Animated.View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
