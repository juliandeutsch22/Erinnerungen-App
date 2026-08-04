// EventPersonen.tsx — „Wer ist dabei" im Termin-Editor.
//
// Anders als bei Aufgabe, Notiz und Chat sind hier MEHRERE Personen möglich —
// ein Abendessen hat selten genau einen Teilnehmer. Deshalb Kästchen statt
// eines Hakens beim einen Gewählten.
//
// Es sind ausdrücklich NICHT die Teilnehmer des Kalendertermins: die gibt
// EventKit nur lesend heraus, und sie zu setzen hieße, die Einladungs-
// Verwaltung des Systems anzufassen (die verschickt Mails). Das hier ist
// Stoas eigene Verknüpfung — wie Fotos und Dokumente am Termin.
import { Check, Plus, UserRound } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useEventPeople, useToggleEventPerson } from '@/data/eventPersonQueries';
import { useCreatePerson, usePeople } from '@/data/personQueries';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

export function EventPersonen({
  eventId,
  gewaehlt,
  onGewaehlt,
}: {
  /** Bestehender Termin — dann wird sofort verknüpft. */
  eventId?: string;
  /**
   * NEUER Termin: die Auswahl hat noch kein Ziel und wird beim Aufrufer
   * zwischengehalten, bis der Termin angelegt ist (EventEditorSheet).
   *
   * Bis v1.74 gab es diesen Weg nicht — „Wer ist dabei" erschien erst beim
   * BEARBEITEN eines gespeicherten Termins, weil die Verknüpfung eine
   * Event-ID braucht. „Abendessen mit Anna" hieß damit: anlegen, schließen,
   * wieder öffnen, Anna anhaken. Seit `createDeviceEvent` die ID zurückgibt
   * (v1.74.0), geht es in einem Zug.
   */
  gewaehlt?: string[];
  onGewaehlt?: (ids: string[]) => void;
}) {
  const colors = useColors();
  const { data: people } = usePeople();
  const { data: links } = useEventPeople();
  const toggle = useToggleEventPerson();
  const createPerson = useCreatePerson();
  const [entwurf, setEntwurf] = useState('');

  const dabei = useMemo(
    () =>
      eventId
        ? new Set((links ?? []).filter((l) => l.eventId === eventId).map((l) => l.personId))
        : new Set(gewaehlt ?? []),
    [links, eventId, gewaehlt],
  );

  /** Eine Person an/aus — am bestehenden Termin sofort, sonst im Entwurf. */
  const umschalten = (personId: string, ist: boolean) => {
    if (eventId) {
      toggle.mutate({ eventId, personId, dran: ist });
      return;
    }
    const naechste = ist ? (gewaehlt ?? []).filter((x) => x !== personId) : [...(gewaehlt ?? []), personId];
    onGewaehlt?.(naechste);
  };

  // EINE Ordnung, überall dieselbe: die aus `usePeople()`, also die des
  // Listen-Tabs.
  //
  // Bis v1.75 sortierte dieser Block „wer dabei ist, steht oben" — gut gemeint,
  // aber `dabei` ändert sich beim Anhaken, und damit sprang die Zeile unter dem
  // Finger nach oben und beim Lösen wieder zurück. Zweimal hintereinander
  // dieselbe Zeile zu treffen war unmöglich, und in dieser App springt nichts.
  // Das Häkchen sagt ohnehin, wer dabei ist; die Reihenfolge muss es nicht
  // noch einmal sagen. Nebenbei ist sie damit dieselbe wie in `PersonWahl`.

  const anlegen = () => {
    const name = entwurf.trim();
    if (!name) return;
    hapticSuccess();
    // Gleicher Name = dieselbe Person (siehe `useCreatePerson`), und sie ist
    // sofort dabei — man tippt den Namen ja ein, weil sie dazugehört.
    createPerson.mutate({ name }, { onSuccess: (p) => umschalten(p.id, false) });
    setEntwurf('');
  };

  return (
    <View style={{ gap: Spacing.xs }}>
      <Type variant="eyebrow" tone="text3">Wer ist dabei</Type>
      {(people ?? []).map((p) => {
        const ist = dabei.has(p.id);
        return (
          <PressableScale
            key={p.id}
            accessibilityLabel={ist ? `${p.name} ist nicht dabei` : `${p.name} ist dabei`}
            onPress={() => {
              hapticSelect();
              umschalten(p.id, ist);
            }}
            pressedScale={0.99}
            style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                borderWidth: 1.5,
                borderColor: ist ? colors.teal : colors.border3,
                backgroundColor: ist ? colors.teal : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {ist && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <UserRound size={15} color={colors.text3} strokeWidth={2} />
            {/* Die Notiz steht mit — sie ist das, was zwei Annas unterscheidet.
                Im Aufgaben-Editor (`PersonWahl`) und im Listen-Tab stand sie
                immer schon da; hier fehlte sie, und damit war ausgerechnet der
                Ort ohne Unterscheidung, an dem man MEHRERE anhakt. */}
            <View style={{ flex: 1 }}>
              <Type variant="body" numberOfLines={1}>{p.name}</Type>
              {p.note && <Type variant="caption" tone="text3" numberOfLines={1}>{p.note}</Type>}
            </View>
          </PressableScale>
        );
      })}

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
          marginTop: Spacing.xs,
        }}
      >
        <TextInput
          accessibilityLabel="Name — direkt anlegen und hinzufügen"
          value={entwurf}
          onChangeText={setEntwurf}
          onSubmitEditing={anlegen}
          placeholder="Name — direkt anlegen"
          placeholderTextColor={colors.text3}
          returnKeyType="done"
          style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: Spacing.sm + 2, minHeight: 24 }, webNoOutline]}
        />
        <PressableScale
          accessibilityLabel="Person anlegen und hinzufügen"
          onPress={anlegen}
          style={{ padding: Spacing.xs, opacity: entwurf.trim() ? 1 : 0.35 }}
        >
          <Plus size={18} color={colors.teal} strokeWidth={2.4} />
        </PressableScale>
      </View>
    </View>
  );
}
