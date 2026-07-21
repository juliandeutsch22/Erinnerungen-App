// DocumentStrip.tsx — Dokumente eines Termins (Tickets, PDFs, Buchungen):
// Zeilenliste mit Dateiname, Tap öffnet die iOS-Vorschau (QuickLook),
// ✕ löst das Dokument und löscht die Kopie im App-Container.
import { FileText, Paperclip, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useAddDocument, useDocuments, useRemoveDocument } from '@/data/documentQueries';
import { deleteStoredDocument, documentsAvailable, openDocument, pickAndStoreDocument } from '@/lib/documents';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

export function DocumentStrip({ eventId }: { eventId: string }) {
  const colors = useColors();
  const { data: docs } = useDocuments();
  const addDocument = useAddDocument();
  const removeDocument = useRemoveDocument();
  const [picking, setPicking] = useState(false);

  const list = (docs ?? []).filter((d) => d.eventId === eventId);

  const onAdd = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const stored = await pickAndStoreDocument();
      if (stored) {
        await addDocument.mutateAsync({ eventId, name: stored.name, uri: stored.uri });
        hapticSuccess();
      }
    } finally {
      setPicking(false);
    }
  };

  if (!documentsAvailable && list.length === 0) return null;

  return (
    <View style={{ gap: Spacing.sm }}>
      <Type variant="caption" tone="text3">Dokumente</Type>
      {list.map((d) => (
        <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <PressableScale
            accessibilityLabel={`Dokument ${d.name} öffnen`}
            onPress={() => {
              hapticSelect();
              void openDocument(d.uri);
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              paddingVertical: Spacing.sm,
              paddingHorizontal: Spacing.md,
              borderRadius: R.md,
              backgroundColor: colors.chip,
            }}
          >
            <FileText size={16} color={colors.teal} strokeWidth={2} />
            <Type variant="body" numberOfLines={1} style={{ flex: 1 }}>{d.name}</Type>
          </PressableScale>
          <PressableScale
            accessibilityLabel={`Dokument ${d.name} entfernen`}
            hitSlop={8}
            onPress={() => {
              deleteStoredDocument(d.uri);
              removeDocument.mutate(d.id);
            }}
          >
            <X size={16} color={colors.text3} strokeWidth={2} />
          </PressableScale>
        </View>
      ))}
      {documentsAvailable && (
        <PressableScale
          accessibilityLabel="Dokument anhängen"
          onPress={onAdd}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
            paddingVertical: Spacing.sm,
            borderRadius: R.md,
            // Tonale Well statt Strichlinie (Design-Leitplanke).
            backgroundColor: colors.chip,
          }}
        >
          {picking ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <>
              <Paperclip size={16} color={colors.text3} strokeWidth={2} />
              <Type variant="caption" tone="text3">Dokument anhängen</Type>
            </>
          )}
        </PressableScale>
      )}
    </View>
  );
}
