// PersonWahl.tsx — „an wem hängt das?" als INLINE-Block, kein eigenes Sheet.
//
// Bewusst kein Modal: Aufgaben-Editor, Notiz-Zuweisung und Chat-Zuweisung sind
// selbst schon Sheets, und ein Modal, das aus einem Modal aufgeht, ist auf iOS
// genau der Weg, der die App reproduzierbar zerlegt hat (§8.54/§8.71). Der
// Block spricht dieselbe Sprache wie die anderen aufgeklappten Zeilen im
// Editor: eine Gruppe, eine Zeile je Person, ein Haken beim Gewählten.
//
// Eine Person wird hier auch ANGELEGT — der Moment, in dem man sie braucht,
// ist der Moment, in dem sie einem einfällt. Ein eigener Verwaltungs-Ort dafür
// wäre ein Umweg, den niemand geht.
import { Check, Plus, UserRound } from 'lucide-react-native';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Group, RowDivider } from '@/components/SheetParts';
import { Type } from '@/components/Type';
import { useCreatePerson, usePeople } from '@/data/personQueries';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

export function PersonWahl({
  selected,
  onSelect,
}: {
  selected: string | null;
  /** null = Zuordnung lösen. */
  onSelect: (id: string | null) => void;
}) {
  const colors = useColors();
  const { data: people } = usePeople();
  const createPerson = useCreatePerson();
  const [entwurf, setEntwurf] = useState('');

  const anlegen = () => {
    const name = entwurf.trim();
    if (!name) return;
    hapticSuccess();
    // `useCreatePerson` gibt die VORHANDENE Person zurück, wenn es den Namen
    // schon gibt — tippt man „Anna" ein zweites Mal, wird sie ausgewählt statt
    // verdoppelt.
    createPerson.mutate({ name }, { onSuccess: (p) => onSelect(p.id) });
    setEntwurf('');
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      {(people ?? []).length > 0 && (
        <Group>
          {(people ?? []).map((p, i) => {
            const dran = selected === p.id;
            return (
              <React.Fragment key={p.id}>
                {i > 0 && <RowDivider />}
                <PressableScale
                  accessibilityLabel={dran ? `${p.name} lösen` : `An ${p.name} hängen`}
                  onPress={() => {
                    hapticSelect();
                    onSelect(dran ? null : p.id);
                  }}
                  pressedScale={0.99}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md }}
                >
                  <UserRound size={16} color={dran ? colors.teal : colors.text3} strokeWidth={2} />
                  <View style={{ flex: 1 }}>
                    <Type variant="body" numberOfLines={1}>{p.name}</Type>
                    {p.note && <Type variant="caption" tone="text3" numberOfLines={1}>{p.note}</Type>}
                  </View>
                  {dran && <Check size={18} color={colors.teal} strokeWidth={2.4} />}
                </PressableScale>
              </React.Fragment>
            );
          })}
        </Group>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          borderRadius: R.lg,
          borderWidth: 1,
          borderColor: colors.chipBorder,
          backgroundColor: colors.bg2,
          paddingHorizontal: Spacing.md,
        }}
      >
        <TextInput
          accessibilityLabel="Name — direkt anlegen"
          value={entwurf}
          onChangeText={setEntwurf}
          onSubmitEditing={anlegen}
          placeholder="Name — direkt anlegen"
          placeholderTextColor={colors.text3}
          returnKeyType="done"
          style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: Spacing.sm + 2, minHeight: 24 }, webNoOutline]}
        />
        <PressableScale accessibilityLabel="Person anlegen" onPress={anlegen} style={{ padding: Spacing.xs, opacity: entwurf.trim() ? 1 : 0.35 }}>
          <Plus size={18} color={colors.teal} strokeWidth={2.4} />
        </PressableScale>
      </View>
    </View>
  );
}
