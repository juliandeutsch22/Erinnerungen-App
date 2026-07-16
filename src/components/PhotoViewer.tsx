// PhotoViewer.tsx — Vollbild-Ansicht eines Fotos mit horizontalem Blättern
// durch die Momente eines Termins. Tippen schließt; Löschen zweistufig.
import { Trash2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import type { EventPhoto } from '@/data/PhotoRepository';
import { hapticSelect } from '@/lib/haptics';
import { Spacing } from '@/theme/theme.tokens';

export function PhotoViewer({
  photos,
  index,
  onClose,
  onDelete,
}: {
  photos: EventPhoto[];
  index: number;
  onClose: () => void;
  onDelete?: (photo: EventPhoto) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(index);
  const [confirm, setConfirm] = useState(false);

  const photo = photos[current];

  // Nach unten wischen schließt (nur klar vertikal → bricht das horizontale
  // Blättern nicht). Backdrop dimmt mit der Distanz.
  const dragY = useSharedValue(0);
  const swipeDown = Gesture.Pan()
    .activeOffsetY(24)
    .failOffsetX([-24, 24])
    // Nur Ein-Finger — damit das Zwei-Finger-Zoomen nicht das Schließen auslöst.
    .maxPointers(1)
    .onChange((e) => {
      dragY.value = Math.max(0, dragY.value + e.changeY);
    })
    .onEnd((e) => {
      if (dragY.value > 140 || e.velocityY > 800) {
        dragY.value = withTiming(height, { duration: 180 });
        runOnJS(onClose)();
      } else {
        dragY.value = withSpring(0, { damping: 22, stiffness: 320 });
      }
    });

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));
  const bgStyle = useAnimatedStyle(() => ({ opacity: Math.max(0.3, 1 - dragY.value / 500) }));

  if (!photo) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, bgStyle]}>
        <GestureDetector gesture={swipeDown}>
          <Animated.View style={[{ flex: 1 }, contentStyle]}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * width, y: 0 }}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {photos.map((p) => (
            <ZoomableImage key={p.id} uri={p.uri} width={width} height={height} onPress={onClose} />
          ))}
        </ScrollView>
          </Animated.View>
        </GestureDetector>

        {/* Schließen */}
        <PressableScale
          accessibilityLabel="Schließen"
          onPress={onClose}
          style={{ position: 'absolute', top: insets.top + Spacing.sm, right: Spacing.lg, padding: Spacing.sm }}
        >
          <X size={26} color="#FFFFFF" strokeWidth={2} />
        </PressableScale>

        {/* Seiten-Zähler */}
        {photos.length > 1 && (
          <View style={{ position: 'absolute', top: insets.top + Spacing.sm, left: 0, right: 0, alignItems: 'center' }}>
            <Type variant="label" style={{ color: 'rgba(255,255,255,0.85)' }} tabular>
              {current + 1} / {photos.length}
            </Type>
          </View>
        )}

        {/* Löschen */}
        {onDelete && (
          <PressableScale
            accessibilityLabel={confirm ? 'Endgültig löschen' : 'Foto löschen'}
            onPress={() => {
              if (!confirm) {
                hapticSelect();
                setConfirm(true);
                return;
              }
              onDelete(photo);
              const remaining = photos.length - 1;
              setConfirm(false);
              if (remaining <= 0) onClose();
              else setCurrent((c) => Math.max(0, c - (c === photos.length - 1 ? 1 : 0)));
            }}
            style={{
              position: 'absolute',
              bottom: insets.bottom + Spacing.lg,
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.xs,
              paddingVertical: Spacing.sm,
              paddingHorizontal: Spacing.lg,
              borderRadius: 999,
              backgroundColor: confirm ? 'rgba(201,106,71,0.35)' : 'rgba(255,255,255,0.14)',
            }}
          >
            <Trash2 size={16} color="#FFFFFF" strokeWidth={2} />
            <Type variant="label" style={{ color: '#FFFFFF' }}>{confirm ? 'Wirklich löschen?' : 'Löschen'}</Type>
          </PressableScale>
        )}
      </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Ein Foto mit „Pinch-to-Peek": mit zwei Fingern zoomen, beim Loslassen sanft
 *  zurückfedern. Bewusst ohne Pan/Scroll-Kopplung — nur die Pinch-Geste. */
function ZoomableImage({ uri, width, height, onPress }: { uri: string; width: number; height: number; onPress: () => void }) {
  const scale = useSharedValue(1);
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(e.scale, 1), 4);
    })
    .onEnd(() => {
      scale.value = withSpring(1, { damping: 20, stiffness: 220 });
    });
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <GestureDetector gesture={pinch}>
      <Pressable onPress={onPress} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.Image source={{ uri }} style={[{ width, height: height * 0.8 }, style]} resizeMode="contain" />
      </Pressable>
    </GestureDetector>
  );
}
