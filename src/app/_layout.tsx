import '@/global.css';

import { Sora_700Bold, Sora_800ExtraBold, useFonts } from '@expo-google-fonts/sora';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useColors, useScheme } from '@/theme/ThemeProvider';

function RootStack() {
  const colors = useColors();
  const scheme = useScheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}

// Wurzel-ErrorBoundary (expo-router): fängt Render-Fehler ab und zeigt eine
// ruhige Wiederherstellungs-Ansicht statt eines weißen Screens.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#0E1413' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Etwas ist schiefgelaufen.</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center' }}>
          Deine Erinnerungen sind sicher — sie liegen lokal auf deinem Gerät.
        </Text>
        {__DEV__ && (
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center' }}>{error.message}</Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Erneut versuchen"
          onPress={() => { void retry(); }}
          style={{ marginTop: 8, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 999, backgroundColor: '#1FB6A6' }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Erneut versuchen</Text>
        </Pressable>
      </View>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Sora_700Bold, Sora_800ExtraBold });
  const queryClient = useMemo(() => new QueryClient(), []);

  // Fonts blockieren das erste Render nicht hart: bis sie da sind, fällt Type auf
  // System-Font zurück (Headings sehen kurz neutral aus). Verhindert einen leeren Screen.
  void fontsLoaded;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RootStack />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
