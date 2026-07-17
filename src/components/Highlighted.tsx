// Highlighted.tsx — hebt Vorkommen eines Suchbegriffs in einem Text hervor
// (fett + Akzentfarbe). Wird IN eine Type/Text-Komponente gehängt und erbt
// deren Grundstil; nur die Fundstellen weichen ab. Ohne Query: reiner Text.
import React from 'react';
import { Text } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';

export function Highlighted({ text, query }: { text: string; query?: string }) {
  const colors = useColors();
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  let pos = 0;
  for (let i = lower.indexOf(q, pos); i !== -1; i = lower.indexOf(q, pos)) {
    if (i > pos) parts.push(text.slice(pos, i));
    parts.push(
      <Text key={i} style={{ fontWeight: '700', color: colors.teal }}>
        {text.slice(i, i + q.length)}
      </Text>,
    );
    pos = i + q.length;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return <>{parts}</>;
}
