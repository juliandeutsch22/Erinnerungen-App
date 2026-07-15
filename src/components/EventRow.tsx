// EventRow.tsx — kompakte Termin-Zeile (Kalender-Tab + Dashboard): Farbbalken
// des Quell-Kalenders, Titel, Zeit-Label, optionaler Foto-Indikator.
// Gesten wie die Aufgaben-Zeile (gleiche Sprache): Tap = bearbeiten,
// Swipe rechts = Fotos anhängen (Rückblick), Swipe links = bearbeiten.
import { ImageIcon, Pencil } from 'lucide-react-native';
import React, { useRef } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
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
          ? () => (
              <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: Spacing.md, minWidth: 96 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                  <ImageIcon size={16} color={colors.teal} strokeWidth={2.4} />
                  <Type variant="label" tone="teal">Fotos</Type>
                </View>
              </View>
            )
          : undefined
      }
      // Swipe links → bearbeiten.
      renderRightActions={() => (
        <View style={{ justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: Spacing.md, minWidth: 104 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: R.pill, backgroundColor: `${colors.indigo}1A` }}>
            <Pencil size={14} color={colors.indigo} strokeWidth={2} />
            <Type variant="label" tone="indigo" style={{ fontSize: T.sm }}>Bearbeiten</Type>
          </View>
        </View>
      )}
      onSwipeableWillOpen={(direction) => {
        swipeRef.current?.close();
        hapticSelect();
        if (direction === 'left') {
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
