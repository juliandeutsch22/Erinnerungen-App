// PhotoStrip.tsx — Foto-Rückblick eines Termins: „+ Foto"-Kachel plus Thumbnails
// in einer horizontalen Reihe. Tap öffnet die Vollbild-Ansicht mit Blättern.
import { ImagePlus } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';

import { PhotoViewer } from '@/components/PhotoViewer';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useAddPhotos, useEventPhotos, useRemovePhoto } from '@/data/photoQueries';
import { hapticSuccess } from '@/lib/haptics';
import { pickAndStorePhotos, photosAvailable } from '@/lib/photos';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

const THUMB = 76;

export function PhotoStrip({
  eventId,
  /**
   * Wie viel Innen-Padding der Behälter hat — die Reihe hebt es auf und gibt
   * es im Inhalt zurück, damit der Schnitt an der ECHTEN Kante liegt.
   *
   * Dieselbe Sache wie bei den Such-Chips (§8.61): endet der Scroll-Behälter
   * INNERHALB des Paddings, wird die letzte sichtbare Kachel mittendrin
   * abgeschnitten und daneben steht ein leerer Streifen — das liest sich wie
   * ein Fehler, nicht wie „hier geht es weiter". Der Wert kommt vom Aufrufer,
   * weil nur DER sein Padding kennt; im Sheet sind es `Spacing.lg`.
   */
  randAusgleich = 0,
}: {
  eventId: string;
  randAusgleich?: number;
}) {
  const colors = useColors();
  const { data: photos } = useEventPhotos(eventId);
  const addPhotos = useAddPhotos();
  const removePhoto = useRemovePhoto();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);

  const list = photos ?? [];

  const onAdd = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const uris = await pickAndStorePhotos();
      if (uris.length > 0) {
        await addPhotos.mutateAsync({ eventId, uris });
        hapticSuccess();
      }
    } finally {
      setPicking(false);
    }
  };

  if (!photosAvailable && list.length === 0) return null;

  return (
    <View style={{ gap: Spacing.sm }}>
      <Type variant="caption" tone="text3">Rückblick</Type>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -randAusgleich }}
        contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: randAusgleich }}
      >
        {photosAvailable && (
          <PressableScale
            accessibilityLabel="Foto hinzufügen"
            onPress={onAdd}
            style={{
              width: THUMB,
              height: THUMB,
              borderRadius: R.md,
              // Tonale Well statt Strichlinie (Design-Leitplanke).
              backgroundColor: colors.chip,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {picking ? (
              <ActivityIndicator color={colors.teal} />
            ) : (
              <>
                <ImagePlus size={20} color={colors.text3} strokeWidth={2} />
                <Type variant="caption" tone="text3">Foto</Type>
              </>
            )}
          </PressableScale>
        )}
        {list.map((p, i) => (
          <PressableScale key={p.id} accessibilityLabel={`Foto ${i + 1} ansehen`} onPress={() => setViewerIndex(i)}>
            <Image source={{ uri: p.uri }} style={{ width: THUMB, height: THUMB, borderRadius: R.md, backgroundColor: colors.chip }} />
          </PressableScale>
        ))}
      </ScrollView>

      {viewerIndex !== null && (
        <PhotoViewer
          photos={list}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onDelete={(photo) => removePhoto.mutate(photo)}
        />
      )}
    </View>
  );
}
