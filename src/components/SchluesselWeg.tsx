// SchluesselWeg.tsx — der Weg zum Gemini-Schlüssel, als Knopf statt als Satz.
//
// Bis v1.59 stand die Adresse des Google-Portals an drei Stellen als nackter
// Text im Fließtext („Erstelle ihn auf …"), und die Fehlermeldungen
// verwiesen auf „die Einstellungen", ohne dorthin zu führen. Beides ist eine
// Hausaufgabe, die die App dem Nutzer stellt, statt sie ihm abzunehmen: eine
// Adresse abtippen kann auf dem Telefon niemand, und wer im Chat einen
// abgelehnten Schlüssel gemeldet bekommt, sucht danach den Weg selbst.
//
// Deshalb genau zwei Wege, immer in derselben Reihenfolge, überall gleich:
// erst der Ort, an dem der Schlüssel entsteht, dann der Ort, an dem er
// hingehört. Auf dem Einstellungs-Bildschirm entfällt der zweite — dorthin
// zu führen, wo man schon steht, ist keine Hilfe, sondern eine Sackgasse.
import { useRouter } from 'expo-router';
import { ExternalLink, Settings2 } from 'lucide-react-native';
import React from 'react';
import { Linking, View } from 'react-native';

import { GlassButton } from '@/components/GlassButton';
import { Type } from '@/components/Type';
import { hapticSelect } from '@/lib/haptics';
import { SCHLUESSEL_URL } from '@/lib/schluessel';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

/**
 * Die beiden Wege als Knopf-Paar.
 *
 * `onWeg` läuft, bevor navigiert wird — Karten, die über dem Bildschirm
 * liegen (die Antwort der EINEN Zeile), müssen sich vorher schließen, sonst
 * bleiben sie über dem neuen Bildschirm stehen.
 */
export function SchluesselWeg({
  einstellungen = true,
  onWeg,
}: {
  /** Den zweiten Knopf zeigen. Auf dem Einstellungs-Bildschirm: false. */
  einstellungen?: boolean;
  onWeg?: () => void;
}) {
  const colors = useColors();
  const router = useRouter();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md }}>
      <GlassButton
        size="sm"
        variant="secondary"
        accessibilityLabel="Schlüssel bei Google erstellen"
        onPress={() => {
          hapticSelect();
          onWeg?.();
          void Linking.openURL(SCHLUESSEL_URL);
        }}
      >
        <ExternalLink size={15} color={colors.teal} strokeWidth={2.2} />
        <Type variant="label" tone="teal">Schlüssel erstellen</Type>
      </GlassButton>
      {einstellungen && (
        <GlassButton
          size="sm"
          variant="secondary"
          accessibilityLabel="Einstellungen öffnen"
          onPress={() => {
            hapticSelect();
            onWeg?.();
            router.push('/einstellungen');
          }}
        >
          <Settings2 size={15} color={colors.teal} strokeWidth={2.2} />
          <Type variant="label" tone="teal">Einstellungen</Type>
        </GlassButton>
      )}
    </View>
  );
}
