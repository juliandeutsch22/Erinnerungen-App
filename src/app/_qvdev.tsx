// WEGWERF — nur für Design-Screenshots des QuickVoiceView (wird gelöscht).
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { Glass } from '@/components/Glass';
import { GlassButton } from '@/components/GlassButton';
import { QuickVoiceView } from '@/components/QuickVoiceSheet';
import { Type } from '@/components/Type';
import type { AssistantAction } from '@/lib/assistant';
import { Spacing } from '@/theme/theme.tokens';

const sample: AssistantAction = {
  aufgaben: [
    { titel: 'Zahnarzt anrufen', datum: '2026-07-23', zeit: '10:00' },
    { titel: 'Reifen wechseln vor dem Winter' },
  ],
  checkliste: [],
  notizen: ['Geschenkidee Anna: Kochbuch'],
};

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: Spacing.sm }}>
      <Type variant="eyebrow" tone="text3">{label}</Type>
      <Glass variant="card" radius={28} intensity={90} contentStyle={{ padding: Spacing.lg }}>
        {children}
      </Glass>
    </View>
  );
}

export default function QvDev() {
  const insets = useSafeAreaInsets();
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setDeselected((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingTop: insets.top + Spacing.lg, gap: Spacing.xl }}>
        <Card label="Zustand · Zuhören">
          <QuickVoiceView phase="listening" interim="Zahnarzt morgen um zehn" transcript="" actions={null} deselected={new Set()} error={null} summary="" today="2026-07-22" />
        </Card>
        <Card label="Zustand · Denkt nach">
          <QuickVoiceView phase="thinking" interim="" transcript="Zahnarzt morgen um zehn, Reifen wechseln" actions={null} deselected={new Set()} error={null} summary="" today="2026-07-22" />
        </Card>
        <Card label="Zustand · Ergebnis (bestätigen)">
          <QuickVoiceView
            phase="result"
            interim=""
            transcript="Zahnarzt morgen um zehn, Reifen wechseln, Geschenkidee Anna Kochbuch"
            actions={sample}
            deselected={deselected}
            error={null}
            summary=""
            today="2026-07-22"
            onToggleItem={toggle}
          />
          <GlassButton accessibilityLabel="übernehmen" onPress={() => {}} style={{ marginTop: Spacing.md }}>
            <Type variant="label" style={{ color: '#FFFFFF' }}>3 übernehmen</Type>
          </GlassButton>
        </Card>
        <Card label="Zustand · Erledigt">
          <QuickVoiceView phase="done" interim="" transcript="" actions={null} deselected={new Set()} error={null} summary="2 Aufgaben und 1 Notiz angelegt." today="2026-07-22" />
        </Card>
      </ScrollView>
    </View>
  );
}
