// MicButton.tsx — Diktat-Knopf: tippen startet/stoppt On-Device-Diktat, der
// erkannte Text fließt in ein Textfeld. Während des Zuhörens atmet ein weicher
// Teal-Ring (Reduced-Motion → statisch). Reine Präsentation über useDictation.
import { Mic } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { useDictation } from '@/lib/dictation';
import { hapticSelect } from '@/lib/haptics';
import { useColors, useReducedMotion } from '@/theme/ThemeProvider';

export function MicButton({
  size = 40,
  onStart,
  onText,
  onListeningChange,
}: {
  size?: number;
  /** Vor dem Sprechen aufgerufen — merke dir den aktuellen Feldstand. */
  onStart?: () => void;
  /** Kumulatives Transkript der laufenden Äußerung + ob final. */
  onText: (transcript: string, final: boolean) => void;
  /** Meldet den Zuhör-Zustand nach außen (z. B. für die Platzhalter-Zeile). */
  onListeningChange?: (listening: boolean) => void;
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const { available, listening, toggle } = useDictation({ onStart, onText });

  useEffect(() => {
    onListeningChange?.(listening);
  }, [listening, onListeningChange]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (listening && !reduced) {
      pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
    } else {
      pulse.value = 0;
    }
  }, [listening, reduced, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.4,
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));

  if (!available) return null;

  return (
    <PressableScale
      accessibilityLabel={listening ? 'Diktat beenden' : 'Per Sprache diktieren'}
      accessibilityState={{ selected: listening }}
      onPress={() => {
        hapticSelect();
        toggle();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: listening ? `${colors.teal}1F` : 'transparent',
      }}
    >
      {listening && !reduced && (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: colors.teal }, ring]}
        />
      )}
      <Mic size={20} color={listening ? colors.teal : colors.text3} strokeWidth={2} />
    </PressableScale>
  );
}
