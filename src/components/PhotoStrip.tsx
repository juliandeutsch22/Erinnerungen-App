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

export function PhotoStrip({ eventId }: { eventId: string }) {
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
        {photosAvailable && (
          <PressableScale
            accessibilityLabel="Foto hinzufügen"
            onPress={onAdd}
            style={{
              width: THUMB,
              height: THUMB,
              borderRadius: R.md,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.border2,
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
