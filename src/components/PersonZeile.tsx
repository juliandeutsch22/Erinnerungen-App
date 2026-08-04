// PersonZeile.tsx — eine Person als Zeile, mit dem, was gerade bei ihr liegt.
//
// Ausgelagert, weil es sie seit v1.78.0 an ZWEI Orten gibt: gekürzt im
// Listen-Tab und vollständig auf `/personen`. Zwei Kopien derselben Zeile
// wären zwei Orte, an denen man eine Änderung vergessen kann.
import { ChevronRight, UserRound } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import type { Person } from '@/data/types';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export function PersonZeile({
  person,
  wartend,
  offen,
  onPress,
  onLongPress,
}: {
  person: Person;
  wartend: number;
  offen: number;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityLabel={`Alles zu ${person.name} ansehen`}
      onPress={onPress}
      onLongPress={onLongPress}
      pressedScale={0.99}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm }}
    >
      <UserRound size={18} color={colors.text3} strokeWidth={2} />
      <View style={{ flex: 1 }}>
        <Type variant="body" numberOfLines={1}>{person.name}</Type>
        {person.note && <Type variant="caption" tone="text3" numberOfLines={1}>{person.note}</Type>}
      </View>
      {/* Zwei Zahlen, zwei Bedeutungen: was bei ihr liegt und was bei mir.
          Nur die, die es gibt. */}
      {wartend > 0 && <Type variant="caption" tone="teal" tabular>{wartend} wartet</Type>}
      {offen > 0 && <Type variant="caption" tone="text3" tabular>{offen} offen</Type>}
      <ChevronRight size={15} color={colors.text3} strokeWidth={2} />
    </PressableScale>
  );
}
