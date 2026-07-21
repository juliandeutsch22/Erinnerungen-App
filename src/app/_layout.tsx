import '@/global.css';

import { CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond/700Bold';
import { useFonts } from '@expo-google-fonts/sora';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLockGate } from '@/components/AppLockGate';
import { setOnTasksChanged } from '@/data/queries';
import { isAutoBackupDue, runAutoBackup } from '@/lib/autoBackup';
import { runOrphanDocumentSweep } from '@/lib/orphanDocuments';
import { getSecureKey, setSecureKey } from '@/lib/secureKey';
import {
  ensureNotificationPermission,
  registerNotificationCategories,
  requestReschedule,
  rescheduleJournalReminder,
  useNotificationResponses,
} from '@/lib/notifications';
import { useSettings } from '@/theme/settings.store';
import { ThemeProvider, useColors, useScheme } from '@/theme/ThemeProvider';

function RootStack() {
  const colors = useColors();
  const scheme = useScheme();
  useNotificationResponses();

  // App wacht auf (iOS hält sie tagelang im Speicher): Queries invalidieren →
  // Screens rendern neu und rechnen „heute" frisch — sonst zeigt der
  // Morgen-Blick noch den gestrigen Tagesplan.
  const qc = useQueryClient();
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void qc.invalidateQueries();
    });
    return () => sub.remove();
  }, [qc]);

  // Erinnerungs-Engine: bei App-Start + nach jeder Datenänderung wird das
  // Planungsfenster neu aufgebaut (64er-Limit, Fahrplan §5). No-Op im Web.
  const hydrated = useSettings((s) => s._hasHydrated);
  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      await registerNotificationCategories();
      await ensureNotificationPermission();
      requestReschedule();

      // Gemini-Schlüssel aus der Keychain in den Speicher holen. Migration:
      // lag er noch im alten Persist (Store hat einen, Keychain nicht),
      // wandert er einmalig in die Keychain.
      const state = useSettings.getState();

      // Journal-Erinnerung neu aufsetzen — überlebt sonst keine Neuinstallation.
      await rescheduleJournalReminder(state.journalReminderEnabled, state.journalReminderTime, false);

      const secure = await getSecureKey();
      if (secure && !state.geminiApiKey) state.setGeminiApiKey(secure);
      else if (!secure && state.geminiApiKey) await setSecureKey(state.geminiApiKey);

      // Stilles Wochen-Backup in den Dateien-Ordner (nur nativ).
      if (isAutoBackupDue(state.lastAutoBackupAt)) {
        const name = await runAutoBackup(state.savedFilters);
        if (name) useSettings.getState().setLastAutoBackupAt(new Date().toISOString());
      }

      // Dokumente gelöschter Termine entsorgen (60-Tage-Schonfrist, nur nativ).
      await runOrphanDocumentSweep();
    })();
    setOnTasksChanged(requestReschedule);
    return () => setOnTasksChanged(null);
  }, [hydrated]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AppLockGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </AppLockGate>
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
          style={{ marginTop: 8, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 999, backgroundColor: '#2B5FA6' }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Erneut versuchen</Text>
        </Pressable>
      </View>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ CormorantGaramond_700Bold });
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
