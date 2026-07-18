// SwipeActionSlide.tsx — Aktions-Inhalt einer Swipe-Zeile, der mit der Geste
// hereingleitet und per overflow:hidden auf den aufgedeckten Streifen
// geclippt wird. Dadurch liegt die Beschriftung NIE unter dem (transparenten)
// Zeileninhalt — keine Deckflächen nötig (iOS-Muster: Aktion klebt an der
// Zeilenkante). Für renderLeftActions/renderRightActions von ReanimatedSwipeable.
import React from 'react';
import { View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { Spacing } from '@/theme/theme.tokens';

export function SwipeActionSlide({
  side,
  width,
  translation,
  color,
  children,
}: {
  /** 'left' = linke Aktion (Wisch nach rechts), 'right' = rechte (Wisch nach links). */
  side: 'left' | 'right';
  /** Breite des Aktions-Streifens (bestimmt auch den Öffnungsweg). */
  width: number;
  /** translation der Swipeable-Zeile (SharedValue aus render*Actions). */
  translation: SharedValue<number>;
  /** Vollflächiger Farb-Block (Apple-Muster: Aktion als farbige Fläche). */
  color: string;
  children: React.ReactNode;
}) {
  // Der Block startet außerhalb des Streifens und gleitet synchron zur Zeile
  // herein — er klebt an der Zeilenkante und liegt nie unter deren Inhalt:
  // links: von -width → 0 (translation 0 → +width); rechts: von +width → 0.
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: side === 'left' ? -width + translation.value : width + translation.value }],
  }));

  return (
    <View style={{ width, overflow: 'hidden' }}>
      <Animated.View
        style={[
          {
            flex: 1,
            backgroundColor: color,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: Spacing.sm,
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}
