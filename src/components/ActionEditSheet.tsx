// ActionEditSheet.tsx — einen einzelnen Vorschlag des Assistenten schnell
// zurechtrücken, bevor er übernommen wird.
//
// Vorher gab es nur ganz oder gar nicht: abwählen oder hinnehmen. Wenn der
// Titel fast stimmt oder das Datum einen Tag daneben liegt, ist beides falsch —
// man will es in zehn Sekunden geradeziehen, nicht abwählen und von Hand neu
// anlegen.
//
// Bewusst KEIN vollständiger Aufgaben-Editor: Titel, Datum, Uhrzeit, Liste.
// Alles Weitere (Tags, Wiederholung, Schritte) macht man danach in der echten
// Aufgabe — hier zählt Tempo.
import { Clock } from 'lucide-react-native';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { GlassButton } from '@/components/GlassButton';
import { keyboardDoneProps } from '@/components/KeyboardDone';
import { MiniCalendar } from '@/components/MiniCalendar';
import { PressableScale } from '@/components/PressableScale';
import { TimeField } from '@/components/TimeField';
import { Type } from '@/components/Type';
import type { List } from '@/data/types';
import type { AssistantAction } from '@/lib/assistant';
import { formatDueDate, todayStr } from '@/lib/dates';
import { hapticSelect } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

/** Welcher Vorschlag wird gerade bearbeitet? Der Index zeigt zurück in den Block. */
export type EditTarget =
  | { kind: 'aufgabe'; index: number }
  | { kind: 'termin'; index: number }
  | { kind: 'notiz'; index: number };

export function ActionEditSheet({
  target,
  actions,
  lists,
  onClose,
  onSave,
}: {
  target: EditTarget;
  actions: AssistantAction;
  lists: List[];
  onClose: () => void;
  /** Gibt den geänderten Block zurück — der Aufrufer ersetzt damit seinen Stand. */
  onSave: (next: AssistantAction) => void;
}) {
  const colors = useColors();
  const aufgabe = target.kind === 'aufgabe' ? actions.aufgaben[target.index] : null;
  const termin = target.kind === 'termin' ? actions.termine[target.index] : null;
  const notiz = target.kind === 'notiz' ? actions.notizen[target.index] : null;

  const [titel, setTitel] = useState(aufgabe?.titel ?? termin?.titel ?? notiz ?? '');
  const [datum, setDatum] = useState<string | null>(aufgabe?.datum ?? termin?.datum ?? null);
  const [zeit, setZeit] = useState<string | null>(aufgabe?.zeit ?? termin?.start ?? null);
  const [liste, setListe] = useState<string | undefined>(aufgabe?.liste);
  const [zeigeDatum, setZeigeDatum] = useState(false);

  const feld = {
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    backgroundColor: colors.chip,
    padding: Spacing.sm,
    fontSize: T.md,
    color: colors.text,
  } as const;

  const speichern = () => {
    const text = titel.trim();
    if (text.length === 0) return;
    if (target.kind === 'aufgabe') {
      const next = [...actions.aufgaben];
      next[target.index] = { ...next[target.index], titel: text, datum: datum ?? undefined, zeit: zeit ?? undefined, liste };
      onSave({ ...actions, aufgaben: next });
    } else if (target.kind === 'termin') {
      const next = [...actions.termine];
      // Ein Termin OHNE Datum ergibt keinen Kalendereintrag — dann bleibt das alte stehen.
      next[target.index] = { ...next[target.index], titel: text, datum: datum ?? next[target.index].datum, start: zeit ?? undefined };
      onSave({ ...actions, termine: next });
    } else {
      const next = [...actions.notizen];
      next[target.index] = text;
      onSave({ ...actions, notizen: next });
    }
    onClose();
  };

  const titelLabel = target.kind === 'notiz' ? 'Notiz' : 'Titel';

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title="Vorschlag ändern"
      footer={
        <GlassButton accessibilityLabel="Vorschlag sichern" onPress={speichern} disabled={titel.trim().length === 0}>
          <Type variant="label" style={{ color: '#FFFFFF' }}>Übernehmen</Type>
        </GlassButton>
      }
    >
      <View style={{ gap: Spacing.md }}>
        <View style={{ gap: Spacing.xs }}>
          <Type variant="label" tone="text2">{titelLabel}</Type>
          <TextInput
            value={titel}
            onChangeText={setTitel}
            multiline={target.kind === 'notiz'}
            accessibilityLabel={`${titelLabel} des Vorschlags`}
            placeholderTextColor={colors.text3}
            {...(target.kind === 'notiz' ? keyboardDoneProps : {})}
            style={[feld, target.kind === 'notiz' ? { minHeight: 96, textAlignVertical: 'top' } : null, webNoOutline]}
          />
        </View>

        {target.kind !== 'notiz' && (
          <>
            <View style={{ gap: Spacing.xs }}>
              <PressableScale
                accessibilityLabel={zeigeDatum ? 'Datum zuklappen' : 'Datum ändern'}
                onPress={() => {
                  hapticSelect();
                  setZeigeDatum((v) => !v);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Type variant="label" tone="text2">Datum</Type>
                <Type variant="label" tone={datum ? 'teal' : 'text3'} tabular>
                  {datum ? formatDueDate(datum, todayStr()) : 'Keins'}
                </Type>
              </PressableScale>
              {zeigeDatum && (
                <View style={{ borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.bg2, padding: Spacing.sm }}>
                  <MiniCalendar selected={datum} onSelect={setDatum} />
                </View>
              )}
            </View>

            <View style={{ gap: Spacing.xs }}>
              <PressableScale
                accessibilityRole="switch"
                accessibilityState={{ checked: zeit !== null }}
                accessibilityLabel={zeit !== null ? 'Uhrzeit entfernen' : 'Uhrzeit hinzufügen'}
                onPress={() => {
                  hapticSelect();
                  setZeit((v) => (v === null ? '09:00' : null));
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}
              >
                <Clock size={18} color={zeit !== null ? colors.teal : colors.text3} strokeWidth={2} />
                <Type variant="body" style={{ flex: 1 }}>Uhrzeit</Type>
                <Type variant="label" tone={zeit !== null ? 'teal' : 'text3'}>{zeit ?? 'Aus'}</Type>
              </PressableScale>
              {zeit !== null && <TimeField value={zeit} onChange={setZeit} accessibilityLabel="Uhrzeit wählen" />}
            </View>
          </>
        )}

        {target.kind === 'aufgabe' && lists.length > 0 && (
          <View style={{ gap: Spacing.xs }}>
            <Type variant="label" tone="text2">Liste</Type>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
              <Chip label="Eingang" active={!liste} onPress={() => setListe(undefined)} />
              {lists
                .filter((l) => !l.deletedAt && l.id !== 'default')
                .map((l) => (
                  <Chip key={l.id} label={l.name} active={liste === l.name} onPress={() => setListe(l.name)} />
                ))}
            </View>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}
