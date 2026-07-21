// AppLockGate.tsx — legt bei aktivierter Sperre einen Marmor-Vorhang über die
// App: beim Kaltstart und immer, wenn die App aus dem Hintergrund zurückkommt.
// Entsperrt wird mit Face ID (Gerätecode als Fallback). Web/ohne Hardware:
// die Sperre greift nie — die App bleibt offen wie bisher.
import { Lock } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { Backdrop } from '@/components/Backdrop';
import { GlassButton } from '@/components/GlassButton';
import { Type } from '@/components/Type';
import { appLockAvailable, authenticateAppLock } from '@/lib/appLock';
import { useColors } from '@/theme/ThemeProvider';
import { useSettings } from '@/theme/settings.store';
import { Spacing } from '@/theme/theme.tokens';

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const enabled = useSettings((s) => s.appLockEnabled);
  const hydrated = useSettings((s) => s._hasHydrated);
  const active = appLockAvailable && enabled;

  const [locked, setLocked] = useState(appLockAvailable);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await authenticateAppLock();
    prompting.current = false;
    if (ok) setLocked(false);
  }, []);

  // Kaltstart: sobald die Settings da sind, entweder freigeben (Sperre aus)
  // oder direkt den Face-ID-Prompt zeigen.
  useEffect(() => {
    if (!hydrated) return;
    if (!active) {
      setLocked(false);
      return;
    }
    if (locked) void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, active]);

  // Hintergrund → wieder sperren; zurück im Vordergrund → erneut fragen.
  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') setLocked(true);
      else if (state === 'active') {
        // setLocked-Callback statt Closure: der aktuelle Sperr-Zustand zählt.
        setLocked((wasLocked) => {
          if (wasLocked) void unlock();
          return wasLocked;
        });
      }
    });
    return () => sub.remove();
  }, [active, unlock]);

  const showCurtain = active && locked;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {showCurtain && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
          <Backdrop />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl }}>
            <Lock size={26} color={colors.text3} strokeWidth={1.8} />
            <Type variant="title">Stoa</Type>
            <Type variant="caption" tone="text3" style={{ textAlign: 'center' }}>
              Deine Erinnerungen bleiben privat.
            </Type>
            <GlassButton accessibilityLabel="Mit Face ID entsperren" size="sm" onPress={() => void unlock()} style={{ marginTop: Spacing.md }}>
              <Type variant="label" style={{ color: '#FFFFFF' }}>Entsperren</Type>
            </GlassButton>
          </View>
        </View>
      )}
    </View>
  );
}
