// einstellungen.tsx — Zahnrad-Ziel (Fahrplan §4): Theme + Bewegung (M2-Stand);
// Standard-Uhrzeit, Backup und Benachrichtigungen folgen in M4/M5.
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { Chip } from '@/components/Chip';
import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { Type } from '@/components/Type';
import { useColors } from '@/theme/ThemeProvider';
import { MotionPref, ThemePref, useSettings } from '@/theme/settings.store';
import { Spacing } from '@/theme/theme.tokens';

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];
const MOTIONS: { value: MotionPref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'full', label: 'Voll' },
  { value: 'reduced', label: 'Reduziert' },
];

export default function EinstellungenScreen() {
  const colors = useColors();
  const router = useRouter();
  const themePref = useSettings((s) => s.themePref);
  const motionPref = useSettings((s) => s.motionPref);
  const setThemePref = useSettings((s) => s.setThemePref);
  const setMotionPref = useSettings((s) => s.setMotionPref);

  return (
    <Screen withTabBar={false}>
      <Reveal>
        <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm, marginLeft: -Spacing.sm, alignSelf: 'flex-start' }}>
          <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
        </PressableScale>
        <Type variant="title" style={{ marginTop: Spacing.xs }}>Einstellungen</Type>
      </Reveal>

      <Reveal delay={80}>
        <GlassPanel>
          <Type variant="label" tone="text2">Erscheinungsbild</Type>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
            {THEMES.map((t) => (
              <Chip key={t.value} label={t.label} active={themePref === t.value} onPress={() => setThemePref(t.value)} />
            ))}
          </View>

          <Seam />

          <Type variant="label" tone="text2">Bewegung</Type>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
            {MOTIONS.map((m) => (
              <Chip key={m.value} label={m.label} active={motionPref === m.value} onPress={() => setMotionPref(m.value)} />
            ))}
          </View>
        </GlassPanel>
      </Reveal>
    </Screen>
  );
}
