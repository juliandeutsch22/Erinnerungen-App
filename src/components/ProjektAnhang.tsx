// ProjektAnhang.tsx — „Dazu gehört" auf dem Listen-/Projekt-Screen: die Notizen
// und Chats, die an DIESER Liste hängen, plus die beiden Wege, etwas
// hinzuzufügen — neu anlegen (schon zugeordnet) oder Vorhandenes anheften.
//
// Das ist Stoas Antwort auf „Ordner für Notizen": kein zweites Ordnungssystem,
// sondern der Ort, den es schon gibt. Ausführlich begründet an `Note.listId`
// (data/types.ts). Die Liste bleibt dabei die Startansicht der Notizen — eine
// Notiz OHNE Projekt ist völlig normal, hier steht nur, was jemand bewusst
// zugeordnet hat.
import { Paperclip } from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';

import { GlassPanel } from '@/components/GlassPanel';
import { LinkedChats } from '@/components/LinkedChats';
import { LinkedNotes } from '@/components/LinkedNotes';
import { PressableScale } from '@/components/PressableScale';
import { ProjektAnheftenSheet } from '@/components/ProjektAnheftenSheet';
import { Seam } from '@/components/Seam';
import { Type } from '@/components/Type';
import { hapticSelect } from '@/lib/haptics';
import { useSettings } from '@/theme/settings.store';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export function ProjektAnhang({ listId, listName }: { listId: string; listName: string }) {
  const colors = useColors();
  const [anheften, setAnheften] = useState(false);
  // Ohne Schlüssel gibt es keine Chats — dann darf auch die Naht dazwischen
  // nicht stehen, sonst trennt sie zwei Dinge, von denen eines fehlt.
  const hasKey = useSettings((s) => s.geminiApiKey.length > 0);

  return (
    <>
      <GlassPanel>
        <LinkedNotes listId={listId} onNavigate={() => undefined} />
        {hasKey && (
          <>
            <Seam marginVertical={Spacing.md} />
            <LinkedChats listId={listId} title={listName} onNavigate={() => undefined} />
          </>
        )}
        <Seam marginVertical={Spacing.md} />
        <PressableScale
          accessibilityLabel="Vorhandenes anheften"
          onPress={() => {
            hapticSelect();
            setAnheften(true);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 }}
        >
          <View style={{ width: 16, alignItems: 'center' }}>
            <Paperclip size={15} color={colors.text3} strokeWidth={2} />
          </View>
          <Type variant="label" tone="text3">Vorhandenes anheften</Type>
        </PressableScale>
      </GlassPanel>
      {anheften && <ProjektAnheftenSheet listId={listId} onClose={() => setAnheften(false)} />}
    </>
  );
}
