// GlassTabBar.tsx — Floating-Glass-Tab-Bar (position:absolute, damit der Blur den
// Inhalt dahinter sieht). Aktiver Tab in Akzent-Teal, eine Bewegung pro Aktion
// (Spring.snappy beim Wechsel), Reduced-Motion-gegated.
import { CalendarDays, ListTodo, type LucideIcon, Search, Sun } from 'lucide-react-native';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { Glass } from '@/components/Glass';
import { Type } from '@/components/Type';
import { hapticSelect } from '@/lib/haptics';
import { Dur, springConfig } from '@/theme/motion.tokens';
import { useColors, useReducedMotion } from '@/theme/ThemeProvider';
import { TAB_BAR_HEIGHT } from '@/theme/layout';
import { Shadow, Spacing } from '@/theme/theme.tokens';

const ICONS: Record<string, LucideIcon> = {
  heute: Sun,
  kalender: CalendarDays,
  listen: ListTodo,
  suche: Search,
};

const LABELS: Record<string, string> = {
  heute: 'Heute',
  kalender: 'Kalender',
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
        radius={20}
        intensity={80}
        style={[styles.bar, Shadow.lg]}
        contentStyle={{ flexDirection: 'row', height: TAB_BAR_HEIGHT, alignItems: 'center' }}
      >
        {/* Tempel-Fries: Mäander an der Oberkante — das Gebälk der Bar. */}
        <View pointerEvents="none" style={styles.frieze}>
          <Svg width="100%" height="7">
            <Defs>
              <Pattern id="bar-maeander" patternUnits="userSpaceOnUse" width="8.4" height="7">
                <Path d="M0 0.7 H8.4 M7.7 0.7 V6.3 H2.1 V2.8 H5.25 V4.55" stroke={colors.teal} strokeWidth="1" fill="none" />
              </Pattern>
            </Defs>
            <Rect x="0" y="0" width="100%" height="7" fill="url(#bar-maeander)" />
          </Svg>
        </View>
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
  // Bewusst KEIN Scale auf dem Icon: iOS rastert SVGs beim Skalieren als
  // Bitmap → Icons wirken während der Animation kurz verpixelt. Stattdessen
  // dezenter Lift (translateY) beim Fokus + Opacity-Feedback beim Drücken.
  const lift = useSharedValue(focused ? 0 : 1.5);
  const pressed = useSharedValue(0);

  React.useEffect(() => {
    const target = focused ? 0 : 1.5;
    lift.value = reduced ? target : withSpring(target, springConfig('snappy'));
  }, [focused, reduced, lift]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
    opacity: 1 - pressed.value * 0.35,
  }));
  const color = focused ? activeColor : inactiveColor;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: Dur.press });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: Dur.pressOut });
      }}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabInner, animatedStyle]}>
        <Icon size={23} color={color} strokeWidth={focused ? 2.2 : 1.75} />
        <Type variant="caption" style={{ color }}>
          {label}
        </Type>
      </Animated.View>
    </Pressable>
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
  frieze: {
    position: 'absolute',
    top: 4,
    left: 16,
    right: 16,
    height: 7,
    opacity: 0.4,
  },
});
