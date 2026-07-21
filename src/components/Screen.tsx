// Screen.tsx — Standard-Screen-Wrapper: BG aus Tokens, horizontales lg-Padding,
// Safe-Area oben, Tab-Bar-Clearance unten, zentrierte max. Inhaltsbreite.
// Scroll-Offset wird an den Backdrop gereicht → Aurora-Parallax (Tiefe hinter Glas).
import { useScrollToTop } from 'expo-router';
import React, { useRef } from 'react';
import { RefreshControl, ScrollViewProps, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { useColors } from '@/theme/ThemeProvider';
import { MAX_CONTENT_WIDTH, TAB_BAR_SAFE_BOTTOM } from '@/theme/layout';
import { Spacing } from '@/theme/theme.tokens';

export type ScreenProps = ScrollViewProps & {
  children: React.ReactNode;
  /** Tab-Bar-Clearance am unteren Rand einrechnen (für Screens innerhalb der Tabs). */
  withTabBar?: boolean;
  /** Zusätzliche Top-Padding-Stufe (Default: Safe-Area + lg). */
  scroll?: boolean;
  /** Pull-to-Refresh (§D.2): Zustand + Handler. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Zugriff auf die Scroll-Methoden (z. B. scrollToEnd, wenn die Tastatur
   *  ein Eingabefeld am Seitenende freilegen muss). */
  scrollHandle?: React.MutableRefObject<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>;
};

export function Screen({ children, withTabBar = true, scroll = true, refreshing, onRefresh, scrollHandle, style, contentContainerStyle, ...rest }: ScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = (withTabBar ? TAB_BAR_SAFE_BOTTOM : insets.bottom) + Spacing.lg;

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Tippen auf den bereits aktiven Tab scrollt nach oben (iOS-Standard).
  // Aus expo-router (SDK 56: vendored, KEIN @react-navigation-Import).
  const scrollRef = useRef<Animated.ScrollView>(null);
  useScrollToTop(scrollRef);

  const inner = (
    <View style={styles.center}>
      <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: Spacing.lg }}>{children}</View>
    </View>
  );

  if (!scroll) {
    return (
      <View style={[{ flex: 1, paddingTop: insets.top + Spacing.lg, paddingBottom: bottomPad, paddingHorizontal: Spacing.lg }, style as any]}>
        <Backdrop />
        {inner}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Backdrop scrollY={scrollY} />
      <Animated.ScrollView
        ref={(node: React.ElementRef<typeof Animated.ScrollView> | null) => {
          (scrollRef as React.MutableRefObject<unknown>).current = node;
          if (scrollHandle) scrollHandle.current = node as unknown as { scrollToEnd: (o?: { animated?: boolean }) => void } | null;
        }}
        style={[{ backgroundColor: 'transparent' }, style]}
        contentContainerStyle={[
          { paddingTop: insets.top + Spacing.lg, paddingBottom: bottomPad, paddingHorizontal: Spacing.lg },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.teal} /> : undefined
        }
        {...rest}
      >
        {inner}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', width: '100%' },
});
