// GlassTabBar.tsx — Floating-Glass-Tab-Bar (position:absolute, damit der Blur den
// Inhalt dahinter sieht). Aktiver Tab in Akzent-Teal, eine Bewegung pro Aktion
// (Spring.snappy beim Wechsel), Reduced-Motion-gegated.
import { ListTodo, type LucideIcon, Search, Sun } from 'lucide-react-native';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { Type } from '@/components/Type';
import { PressableScale } from '@/components/PressableScale';
import { hapticSelect } from '@/lib/haptics';
import { springConfig } from '@/theme/motion.tokens';
import { useColors, useReducedMotion } from '@/theme/ThemeProvider';
import { TAB_BAR_HEIGHT } from '@/theme/layout';
import { Shadow, Spacing } from '@/theme/theme.tokens';

const ICONS: Record<string, LucideIcon> = {
  heute: Sun,
  listen: ListTodo,
  suche: Search,
};

const LABELS: Record<string, string> = {
  heute: 'Heute',
  listen: 'Listen',
  suche: 'Suche',
};

// Minimaler lokaler Typ für die expo-router/React-Navigation-Tab-Bar-Props
// (@react-navigation/bottom-tabs ist nur transitiv vorhanden, daher kein direkter Import).
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: never) => void;
  };
};

export function GlassTabBar({ state, navigation }: TabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
      <Glass
        variant="bar"
        radius={28}
        intensity={80}
        style={[styles.bar, Shadow.lg]}
        contentStyle={{ flexDirection: 'row', height: TAB_BAR_HEIGHT, alignItems: 'center' }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? Sun;
          const label = LABELS[route.name] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              hapticSelect();
              navigation.navigate(route.name as never);
            }
          };

          return (
            <TabButton
              key={route.key}
              focused={focused}
              Icon={Icon}
              label={label}
              activeColor={colors.teal}
              inactiveColor={colors.text3}
              onPress={onPress}
            />
          );
        })}
      </Glass>
    </View>
  );
}

function TabButton({
  focused,
  Icon,
  label,
  activeColor,
  inactiveColor,
  onPress,
}: {
  focused: boolean;
  Icon: LucideIcon;
  label: string;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(focused ? 1 : 0.92);

  React.useEffect(() => {
    const target = focused ? 1 : 0.92;
    scale.value = reduced ? target : withSpring(target, springConfig('snappy'));
  }, [focused, reduced, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = focused ? activeColor : inactiveColor;

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabInner, animatedStyle]}>
        <Icon size={23} color={color} strokeWidth={focused ? 2.2 : 1.75} />
        <Type variant="caption" style={{ color }}>
          {label}
        </Type>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 480,
    ...(Platform.OS === 'web' ? { cursor: 'auto' as any } : null),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    gap: 2,
  },
});
