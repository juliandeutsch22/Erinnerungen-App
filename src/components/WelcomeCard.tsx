// WelcomeCard.tsx — das Erster-Start-Erlebnis: eine einmalige, ruhige
// Begrüßung auf „Heute". Erklärt in drei Zeilen, was Stoa ist (alles lokal),
// zeigt den QuickAdd-Griff, holt den Kalender-Zugriff mit einem erklärten
// Tipp (statt eines nackten iOS-Prompts) und erwähnt den opt-in-Assistenten.
// Einmal weggetippt („Los geht's"), erscheint sie nie wieder.
import { CalendarDays, Plus, Sparkles } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { GlassButton } from '@/components/GlassButton';
import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Seam } from '@/components/Seam';
import { Type } from '@/components/Type';
import { deviceCalendarAvailable, ensureCalendarPermission, hasCalendarPermission } from '@/lib/deviceCalendar';
import { hapticSuccess } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { useSettings } from '@/theme/settings.store';
import { Spacing, T } from '@/theme/theme.tokens';

export function WelcomeCard({ onCalendarGranted }: { onCalendarGranted?: () => void }) {
  const colors = useColors();
  const hydrated = useSettings((s) => s._hasHydrated);
  const dismissed = useSettings((s) => s.welcomeDismissed);
  const setDismissed = useSettings((s) => s.setWelcomeDismissed);

  const [calGranted, setCalGranted] = useState(true);
  useEffect(() => {
    if (deviceCalendarAvailable) void hasCalendarPermission().then(setCalGranted);
  }, []);

  // Vor der Hydration nichts zeigen — sonst blitzt die Karte bei jedem Start auf.
  if (!hydrated || dismissed) return null;

  const connectCalendar = async () => {
    const granted = await ensureCalendarPermission();
    if (granted) {
      hapticSuccess();
      setCalGranted(true);
      onCalendarGranted?.();
    }
  };

  return (
    <Reveal>
      <GlassPanel>
        <Type variant="eyebrow" tone="indigo">Willkommen</Type>
        <Type variant="heading" style={{ marginTop: Spacing.xs }}>Schön, dass du hier bist</Type>
        <Type variant="body" tone="text2" style={{ marginTop: Spacing.xs, lineHeight: T.md * 1.5 }}>
          Stoa ist dein ruhiger Ort für Erinnerungen, Termine und Notizen.
          Alles bleibt auf diesem iPhone — kein Konto, kein Server, keine Auswertung.
        </Type>

        <Seam marginVertical={Spacing.md} />

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm }}>
          <Plus size={16} color={colors.teal} strokeWidth={2.2} style={{ marginTop: 2 }} />
          <Type variant="caption" tone="text2" style={{ flex: 1, lineHeight: T.xs * 1.5 }}>
            Halte unten fest, was ansteht — „Zahnarzt morgen 10 Uhr" oder „Miete monatsende" versteht Stoa von selbst.
          </Type>
        </View>

        {deviceCalendarAvailable && !calGranted && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.sm }}>
            <CalendarDays size={16} color={colors.teal} strokeWidth={2.2} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: Spacing.xs }}>
              <Type variant="caption" tone="text2" style={{ lineHeight: T.xs * 1.5 }}>
                Termine bleiben in deinem Gerätekalender — Stoa zeigt sie nur an und schreibt nichts ohne dich.
              </Type>
              <PressableScale accessibilityLabel="Kalender verbinden" onPress={() => void connectCalendar()} style={{ alignSelf: 'flex-start' }}>
                <Type variant="label" tone="teal">Kalender verbinden</Type>
              </PressableScale>
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.sm }}>
          <Sparkles size={16} color={colors.text3} strokeWidth={2.2} style={{ marginTop: 2 }} />
          <Type variant="caption" tone="text3" style={{ flex: 1, lineHeight: T.xs * 1.5 }}>
            Der Assistent ist optional — er bleibt aus, bis du in den Einstellungen einen eigenen Schlüssel hinterlegst.
          </Type>
        </View>

        <GlassButton
          size="sm"
          accessibilityLabel="Willkommens-Karte schließen"
          onPress={() => {
            hapticSuccess();
            setDismissed(true);
          }}
          style={{ marginTop: Spacing.md, alignSelf: 'flex-start' }}
        >
          <Type variant="label" style={{ color: '#FFFFFF' }}>Los geht's</Type>
        </GlassButton>
      </GlassPanel>
    </Reveal>
  );
}
