// heute.tsx — Startscreen: Datum-Eyebrow + Begrüßung, Gruppen überfällig/heute.
// M0: Gerüst — Inhalt folgt in M2.
import React from 'react';

import { Screen } from '@/components/Screen';
import { Type } from '@/components/Type';

function formatToday(): string {
  return new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function HeuteScreen() {
  return (
    <Screen>
      <Type variant="eyebrow" tone="text3">{formatToday()}</Type>
      <Type variant="title">Heute</Type>
      <Type tone="text2">Deine Aufgaben erscheinen hier (M2).</Type>
    </Screen>
  );
}
