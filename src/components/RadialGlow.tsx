// RadialGlow.tsx — weicher radialer Lichtkern (react-native-svg) hinter einem
// Hero-Element. Genau ein präzise gesetztes Glanzlicht (VIBE §7 „ein Glanzlicht
// pro Element"). pointerEvents none, rein dekorativ.
import React, { useId } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export function RadialGlow({ color, opacity = 0.22, style }: { color: string; opacity?: number; style?: StyleProp<ViewStyle> }) {
  const id = useId().replace(/:/g, '');
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="42%" r="55%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
