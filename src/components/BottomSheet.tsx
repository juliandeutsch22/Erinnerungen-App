// BottomSheet.tsx — Glass-Bottom-Sheet (Fahrplan §4: Editor ist ein Sheet, kein
// eigener Screen). RN-Modal mit Slide + dimmendem Backdrop; Inhalt auf einer
// Liquid-Glass-Fläche, deren untere Kanten unter den Screenrand tauchen.
//
// Gesten: am Grabber/in der Kopfzeile nach unten ziehen schließt das Sheet
// (Spring zurück, wenn unter der Schwelle). Der Scroll-Bereich wird bewusst NICHT
// mit der Zieh-Geste gekoppelt: jede Kopplung von Pan und ScrollView (Gesture.
// Native / Gesture.Simultaneous / simultaneousWithExternalGesture) ist auf dem
// Gerät reproduzierbar abgestürzt. Die Kopfzeile ist dafür eine großzügige
// Zieh-Fläche.
//
// WICHTIG: RN-Modals rendern in einer EIGENEN nativen View-Hierarchie, die die
// GestureHandlerRootView der App (_layout.tsx) NICHT abdeckt. Gesten im Modal
// brauchen daher eine eigene GestureHandlerRootView hier drin (wie PhotoViewer/
// ReorderSheet). Fehlt sie, stürzt die App beim ersten Gesten-Event ab.
//
// Tastatur: bewusst OHNE KeyboardAvoidingView UND ohne automaticallyAdjust­
// KeyboardInsets — beides schob den Inhalt in Modals ungewollt hoch (das
// Titelfeld rutschte unter die Kopfzeile). Stattdessen hebt die gemessene
// Tastaturhöhe das ganze Sheet über die Tastatur; der Inhalt scrollt im Rest.
import { X } from 'lucide-react-native';
import React from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { hapticSelect } from '@/lib/haptics';
import { useSheetTor } from '@/lib/sheetPresence';
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
  // Solange dieses Sheet steht, zieht sich die EINE Zeile zurück — sie sitzt
  // unten und läge sonst hinter dem Sheet, bei offener Tastatur sogar sichtbar
  // daneben. Zentral gemeldet, damit kein Bildschirm es einzeln buchführen muss.
  //
  // Derselbe Griff hält auch die Übergabe auseinander: schließt ein Sheet und
  // öffnet im selben Zug das nächste, geht das nächste erst auf, wenn die
  // Entlass-Animation des ersten durch ist (sheetPresence.ts). Auf iOS wäre
  // das sonst ein View-Controller, der präsentiert, während der vorherige noch
  // geht — der klassische Weg in einen Absturz beim Aufziehen (§8.54).
  const darfZeigen = useSheetTor(visible);

  // Sichtbarer Raum über der Tastatur; der Inhalt scrollt innerhalb davon.
  const footerAllowance = footer ? 84 : 0;
  const available = windowHeight - keyboard - insets.top - CHROME_HEIGHT - footerAllowance - Spacing.xl;
  const contentMaxHeight = Math.max(160, Math.min(520, available));
  const bottomPad = keyboard > 0 ? Spacing.md : Math.max(insets.bottom, Spacing.sm) + Spacing.lg;

  // Zieh-Offset des Sheets (0 = Ruhelage). Nur nach unten wirksam.
  const translateY = useSharedValue(0);

  const close = () => {
    // Tastatur zuerst schließen, damit das Sheet nicht kurz nachspringt.
    Keyboard.dismiss();
    onClose();
  };

  // Zieh-Geste an der Kopfzeile (keine Kopplung mit der ScrollView → absturzfrei).
  //
  // ⚠️ Sie geht NUR nach unten. Bis v1.70 durfte man das Sheet auch nach oben
  // ziehen — mit Gummiband und einer Klemme bei −40 px. Das war reine Zierde:
  // ein Sheet, das sich nicht aufziehen lässt, verspricht mit dieser Bewegung
  // etwas, das es nicht einlöst. Und genau diese Bewegung hat Julian
  // reproduzierbar zum Absturz gebracht („Modal öffnet, dann nach oben
  // ziehen"). Drei Riegel, jeder für sich sinnvoll:
  //
  //  · `activeOffsetY(8)`  — die Geste STARTET erst nach 8 px nach unten. Ein
  //    Zug nach oben bringt die Gesten-Maschinerie gar nicht erst in Gang.
  //  · `failOffsetY(-8)`   — und sie scheitert sauber, statt in der Schwebe zu
  //    bleiben und die Berührung festzuhalten.
  //  · `maxPointers(1)`    — zwei Finger auf der Kopfzeile sind kein Ziehen.
  //    (Der PhotoViewer macht das aus demselben Grund seit jeher.)
  //
  // Am Web-Harnisch ist der Absturz nicht nachstellbar (dort sind Modals
  // gewöhnliche Overlays); prüfbar ist nur, dass ein Zug nach oben nichts mehr
  // bewegt — `scratchpad/hochziehen.mjs`.
  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetY(-8)
    .maxPointers(1)
    .onChange((e) => {
      // Nur nach unten. Ein negativer Wert kann gar nicht mehr entstehen.
      translateY.value = Math.max(0, translateY.value + e.changeY);
    })
    .onEnd((e) => {
      if (translateY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(hapticSelect)();
        // close() erst nach Abschluss der Wegblend-Animation → kein harter Sprung.
        translateY.value = withTiming(windowHeight, { duration: 180 }, (finished) => {
          if (finished) runOnJS(close)();
        });
      } else {
        translateY.value = withSpring(0, springConfig('snappy'));
      }
    });

  // Die Klemme bei −40 ist entfallen: `translateY` wird nie mehr negativ.
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - translateY.value / (DISMISS_DISTANCE * 2.4)),
  }));

  // Kopf = großzügige Zieh-Fläche (Grabber + Titelzeile tragen die Geste).
  const header = (
    <GestureDetector gesture={pan}>
      <View>
        <View style={{ alignItems: 'center', paddingVertical: Spacing.sm }}>
          <View style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: colors.border2 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
          <Type variant="heading">{title}</Type>
          <PressableScale accessibilityLabel="Schließen" onPress={close} style={{ padding: Spacing.xs }}>
            <X size={22} color={colors.text3} strokeWidth={2} />
          </PressableScale>
        </View>
      </View>
    </GestureDetector>
  );

  return (
    <Modal visible={darfZeigen} transparent animationType="slide" onRequestClose={close}>
      {/* Eigene Root-View: RN-Modals liegen außerhalb der App-Root-GHRootView. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Backdrop dimmt (mit der Zieh-Distanz) und schließt beim Tap. */}
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="box-none">
          {/* Eigener Name: das X heißt „Schließen". Hießen beide gleich, kündigte
              VoiceOver zwei identische Knöpfe an, von denen einer der ganze
              Bildschirm ist — und jede Prüfung, die „Schließen" sucht, träfe
              per Zufall den einen oder den anderen. */}
          <Pressable
            accessibilityLabel="Außerhalb tippen, um zu schließen"
            onPress={close}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
          />
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
                {header}
                <ScrollView
                  style={{ maxHeight: contentMaxHeight }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>
                {footer && <View style={{ paddingTop: Spacing.md }}>{footer}</View>}
              </Glass>
            </Animated.View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
