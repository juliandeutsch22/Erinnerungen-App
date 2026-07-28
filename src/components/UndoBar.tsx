// UndoBar.tsx — das Angebot, einen Schritt zurückzugehen.
//
// Eine kleine Steintafel, die kurz über dem unteren Rand auftaucht und von
// selbst wieder geht. Kein Alarm, keine Farbe, kein Zähler: sie sagt, was
// passiert ist, und bietet EINEN Weg zurück.
//
// Zur Höhe: Sie sitzt bewusst ÜBER der Eingabezeile von „Heute" statt darüber
// zu liegen — eine Meldung, die das Eingabefeld verdeckt, während man tippt,
// ist schlimmer als gar keine. Deshalb der großzügige Abstand nach unten.
// Der Wert ist eine Annahme über fremde Bauteile (Tab-Leiste + Eingabezeile);
// wer an einem der beiden die Höhe ändert, muss hier nachsehen.
import { Undo2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { PopIn } from '@/components/PopIn';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { hapticSelect } from '@/lib/haptics';
import { runUndo, UNDO_MS, useUndo } from '@/lib/undo';
import { MAX_CONTENT_WIDTH } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Shadow, Spacing } from '@/theme/theme.tokens';

/** Abstand nach unten: Tab-Leiste (~56) + Eingabezeile (~64) + Luft. */
const BOTTOM_CLEARANCE = 132;

export function UndoBar() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const entry = useUndo((s) => s.entry);
  const clear = useUndo((s) => s.clear);
  // Der Zeitstempel im Key sorgt dafür, dass ein NEUER Schritt die Leiste neu
  // auftreten lässt, statt den alten Text stillschweigend zu ersetzen.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!entry) return undefined;
    setTick((t) => t + 1);
    const timer = setTimeout(clear, UNDO_MS);
    return () => clearTimeout(timer);
  }, [entry, clear]);

  if (!entry) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: insets.bottom + BOTTOM_CLEARANCE }]}
    >
      <PopIn key={tick}>
        <Glass
          variant="pill"
          intensity={80}
          style={[Shadow.md, { maxWidth: MAX_CONTENT_WIDTH }]}
          contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md }}
        >
          <Type variant="caption" tone="text2" numberOfLines={1}>{entry.label}</Type>
          <PressableScale
            accessibilityLabel={`Rückgängig: ${entry.label}`}
            onPress={() => {
              hapticSelect();
              void runUndo();
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
          >
            <Undo2 size={14} color={colors.teal} strokeWidth={2.2} />
            <Type variant="label" tone="teal">Rückgängig</Type>
          </PressableScale>
        </Glass>
      </PopIn>
    </View>
  );
}
