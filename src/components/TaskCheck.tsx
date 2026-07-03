// TaskCheck.tsx — runder Haken mit Teal-Puls (Spring) + Erfolgs-Haptik.
// Muster aus Cairns FocusTrail-Wegpunkt übernommen.
import { Check } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { springConfig } from '@/theme/motion.tokens';
import { useColors, useReducedMotion } from '@/theme/ThemeProvider';
import { R } from '@/theme/theme.tokens';

const NODE = 28;

export function TaskCheck({
  checked,
  onToggle,
  accessibilityLabel,
}: {
  checked: boolean;
  onToggle: (next: boolean) => void;
  accessibilityLabel: string;
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const fill = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    const target = checked ? 1 : 0;
    fill.value = reduced ? target : withSpring(target, springConfig('tight'));
  }, [checked, reduced, fill]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ scale: 0.4 + fill.value * 0.6 }] }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        const next = !checked;
        if (next) hapticSuccess();
        else hapticSelect();
        onToggle(next);
      }}
      pressedScale={0.88}
      // Großzügige Trefferfläche (44pt) um den 28pt-Kreis.
      style={{ padding: 8, margin: -8 }}
    >
      <View
        style={{
          width: NODE,
          height: NODE,
          borderRadius: R.pill,
          borderWidth: 1.5,
          borderColor: checked ? colors.teal : colors.border2,
          backgroundColor: colors.bg2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[{ position: 'absolute', width: NODE, height: NODE, borderRadius: R.pill, backgroundColor: colors.teal }, fillStyle]}
        />
        <Animated.View style={checkStyle}>
          <Check size={15} color="#FFFFFF" strokeWidth={2.6} />
        </Animated.View>
      </View>
    </PressableScale>
  );
}
