// listen.tsx — Grid aus Glass-Karten (Icon, Name, offene Anzahl).
// M0: Gerüst — Inhalt folgt in M2.
import React from 'react';

import { Screen } from '@/components/Screen';
import { Type } from '@/components/Type';

export default function ListenScreen() {
  return (
    <Screen>
      <Type variant="title">Listen</Type>
      <Type tone="text2">Deine Listen erscheinen hier (M2).</Type>
    </Screen>
  );
}
