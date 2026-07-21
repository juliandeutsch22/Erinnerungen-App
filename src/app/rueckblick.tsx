// rueckblick.tsx — Foto-Rückblick über alle Termine: Momente chronologisch nach
// Monat gruppiert, als Raster. Tap öffnet die Vollbild-Ansicht mit Blättern.
import { useRouter } from 'expo-router';
import { ChevronLeft, GalleryHorizontalEnd } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Image, View, useWindowDimensions } from 'react-native';

import { GlassPanel } from '@/components/GlassPanel';
import { PhotoViewer } from '@/components/PhotoViewer';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/StateView';
import { Type } from '@/components/Type';
import { useAllPhotos, useRemovePhoto } from '@/data/photoQueries';
import type { EventPhoto } from '@/data/PhotoRepository';
import { useColors } from '@/theme/ThemeProvider';
import { MAX_CONTENT_WIDTH } from '@/theme/layout';
import { R, Spacing } from '@/theme/theme.tokens';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export default function RueckblickScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: photos } = useAllPhotos();
  const removePhoto = useRemovePhoto();
  const { width } = useWindowDimensions();
  const [viewerAt, setViewerAt] = useState<number | null>(null);

  const all = photos ?? [];

  // Nach Monat gruppieren (neueste zuerst) — all[] ist bereits absteigend sortiert.
  const groups = useMemo(() => {
    const map = new Map<string, EventPhoto[]>();
    for (const p of all) {
      const d = new Date(p.addedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return [...map.entries()].map(([key, items]) => {
      const [y, m] = key.split('-').map(Number);
      return { title: `${MONTHS[m]} ${y}`, items };
    });
  }, [all]);

  // Raster: 3 Spalten innerhalb der Inhaltsbreite.
  const contentW = Math.min(width, MAX_CONTENT_WIDTH) - Spacing.lg * 2 - Spacing.lg * 2;
  const gap = Spacing.xs;
  const cell = Math.floor((contentW - gap * 2) / 3);

  // Absoluter Index über alle Fotos (für den Viewer).
  const indexOf = (photo: EventPhoto) => all.findIndex((p) => p.id === photo.id);

  return (
    <Screen withTabBar={false}>
      <Reveal>
        <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm, marginLeft: -Spacing.sm, alignSelf: 'flex-start' }}>
          <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
        </PressableScale>
        <Type variant="title" style={{ marginTop: Spacing.xs }}>Rückblick</Type>
        <Type variant="caption" tone="text3" style={{ marginTop: 2 }} tabular>
          {all.length === 1 ? '1 Moment' : `${all.length} Momente`}
        </Type>
      </Reveal>

      {all.length === 0 ? (
        <Reveal delay={80}>
          <GlassPanel>
            <EmptyState
              icon={<GalleryHorizontalEnd size={20} color={colors.teal} strokeWidth={2} />}
              title="Noch keine Momente"
              body="Öffne einen Termin im Kalender und füge unten Fotos hinzu — sie erscheinen dann hier als Rückblick."
            />
          </GlassPanel>
        </Reveal>
      ) : (
        groups.map((g, gi) => (
          <Reveal key={g.title} delay={80 + gi * 40}>
            <View style={{ gap: Spacing.sm }}>
              <Type variant="eyebrow" tone="text3">{g.title}</Type>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
                {g.items.map((p) => (
                  <PressableScale key={p.id} accessibilityLabel="Foto ansehen" onPress={() => setViewerAt(indexOf(p))}>
                    <Image source={{ uri: p.uri }} style={{ width: cell, height: cell, borderRadius: R.md, backgroundColor: colors.chip }} />
                  </PressableScale>
                ))}
              </View>
            </View>
          </Reveal>
        ))
      )}

      {viewerAt !== null && (
        <PhotoViewer
          photos={all}
          index={viewerAt}
          onClose={() => setViewerAt(null)}
          onDelete={(photo) => removePhoto.mutate(photo)}
        />
      )}
    </Screen>
  );
}
