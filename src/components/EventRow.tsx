// EventRow.tsx — kompakte Termin-Zeile (Kalender-Tab + Dashboard): Farbbalken
// des Quell-Kalenders, Titel, Zeit-Label, optionaler Foto-Indikator.
// Gesten wie die Aufgaben-Zeile (gleiche Sprache): Tap = bearbeiten,
// Swipe rechts = Fotos anhängen (Rückblick), Swipe links = bearbeiten.
import { ImageIcon, NotebookPen, Pencil } from 'lucide-react-native';
import React, { useMemo, useRef } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { PressableScale } from '@/components/PressableScale';
import { SwipeActionSlide } from '@/components/SwipeActionSlide';
import { Type } from '@/components/Type';
import { useNotes } from '@/data/noteQueries';
import { useAddPhotos } from '@/data/photoQueries';
import { eventTimeLabel } from '@/lib/calendarLogic';
import type { DeviceCalendar, DeviceEvent } from '@/lib/deviceCalendar';
import { hapticSelect } from '@/lib/haptics';
import { photosAvailable, pickAndStorePhotos } from '@/lib/photos';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

export function EventRow({
  event,
  calendar,
  day,
  showCalendarName = true,
  photoCount = 0,
  onPress,
}: {
  event: DeviceEvent;
  calendar?: DeviceCalendar;
  /** Angezeigter Tag ('YYYY-MM-DD') — bestimmt das Zeit-Label bei mehrtägigen Terminen. */
  day: string;
  showCalendarName?: boolean;
  /** Anzahl angehängter Rückblick-Fotos (kleiner Teal-Indikator). */
  photoCount?: number;
  onPress: () => void;
}) {
  const colors = useColors();
  const addPhotos = useAddPhotos();
  // Verknüpfte Notizen? Kleiner Indikator neben dem Foto-Zähler.
  const { data: notes } = useNotes();
  const noteCount = useMemo(() => (notes ?? []).filter((n) => n.eventId === event.id && n.deletedAt === null).length, [notes, event.id]);
  const swipeRef = useRef<SwipeableMethods>(null);

  const onPhotos = async () => {
    const uris = await pickAndStorePhotos();
    if (uris.length) addPhotos.mutate({ eventId: event.id, uris });
  };

  const row = (
    <PressableScale
      accessibilityLabel={`Termin ${event.title} bearbeiten`}
      onPress={onPress}
      pressedScale={0.99}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2, backgroundColor: 'transparent' }}
    >
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: R.pill, backgroundColor: calendar?.color ?? colors.indigo }} />
      <View style={{ flex: 1, gap: 1 }}>
        <Type variant="body" numberOfLines={2}>{event.title}</Type>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Type variant="caption" tone="text3">{eventTimeLabel(event, day)}</Type>
          {showCalendarName && calendar && (
            <Type variant="caption" tone="text3" numberOfLines={1}>{calendar.title}</Type>
          )}
          {photoCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <ImageIcon size={11} color={colors.teal} strokeWidth={2} />
              <Type variant="caption" tone="teal" tabular>{photoCount}</Type>
            </View>
          )}
          {noteCount > 0 && <NotebookPen size={11} color={colors.text3} strokeWidth={2} />}
        </View>
      </View>
    </PressableScale>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={56}
      rightThreshold={56}
      overshootLeft={false}
      overshootRight={false}
      // Swipe rechts → Fotos (nur wo der Picker verfügbar ist).
      renderLeftActions={
        photosAvailable
          ? (_progress, translation) => (
              <SwipeActionSlide side="left" width={90} translation={translation} color={colors.teal}>
                <ImageIcon size={18} color="#FFFFFF" strokeWidth={2.4} />
                <Type variant="label" style={{ color: '#FFFFFF', fontSize: T.sm }}>Fotos</Type>
              </SwipeActionSlide>
            )
          : undefined
      }
      // Swipe links → bearbeiten.
      renderRightActions={(_progress, translation) => (
        <SwipeActionSlide side="right" width={110} translation={translation} color={colors.indigo}>
          <Pencil size={16} color="#FFFFFF" strokeWidth={2} />
          <Type variant="label" style={{ color: '#FFFFFF', fontSize: T.sm }}>Bearbeiten</Type>
        </SwipeActionSlide>
      )}
      onSwipeableWillOpen={(direction) => {
        swipeRef.current?.close();
        hapticSelect();
        // direction = Bewegungsrichtung der Zeile (ReanimatedSwipeable):
        // 'right' = nach rechts gewischt → LINKE Aktion (Fotos) offen.
        if (direction === 'right') {
          if (photosAvailable) void onPhotos();
        } else {
          onPress();
        }
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}
