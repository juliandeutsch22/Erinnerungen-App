// PhotoViewer.tsx — Vollbild-Ansicht eines Fotos mit horizontalem Blättern
// durch die Momente eines Termins. Tippen schließt; Löschen zweistufig.
import { Trash2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import type { EventPhoto } from '@/data/PhotoRepository';
import { hapticSelect } from '@/lib/haptics';
import { Spacing } from '@/theme/theme.tokens';

export function PhotoViewer({
  photos,
  index,
  onClose,
  onDelete,
}: {
  photos: EventPhoto[];
  index: number;
  onClose: () => void;
  onDelete?: (photo: EventPhoto) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(index);
  const [confirm, setConfirm] = useState(false);

  const photo = photos[current];
  if (!photo) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * width, y: 0 }}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {photos.map((p) => (
            <Pressable key={p.id} onPress={onClose} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: p.uri }} style={{ width, height: height * 0.8 }} resizeMode="contain" />
            </Pressable>
          ))}
        </ScrollView>

        {/* Schließen */}
        <PressableScale
          accessibilityLabel="Schließen"
          onPress={onClose}
          style={{ position: 'absolute', top: insets.top + Spacing.sm, right: Spacing.lg, padding: Spacing.sm }}
        >
          <X size={26} color="#FFFFFF" strokeWidth={2} />
        </PressableScale>

        {/* Seiten-Zähler */}
        {photos.length > 1 && (
          <View style={{ position: 'absolute', top: insets.top + Spacing.sm, left: 0, right: 0, alignItems: 'center' }}>
            <Type variant="label" style={{ color: 'rgba(255,255,255,0.85)' }} tabular>
              {current + 1} / {photos.length}
            </Type>
          </View>
        )}

        {/* Löschen */}
        {onDelete && (
          <PressableScale
            accessibilityLabel={confirm ? 'Endgültig löschen' : 'Foto löschen'}
            onPress={() => {
              if (!confirm) {
                hapticSelect();
                setConfirm(true);
                return;
              }
              onDelete(photo);
              const remaining = photos.length - 1;
              setConfirm(false);
              if (remaining <= 0) onClose();
              else setCurrent((c) => Math.max(0, c - (c === photos.length - 1 ? 1 : 0)));
            }}
            style={{
              position: 'absolute',
              bottom: insets.bottom + Spacing.lg,
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.xs,
              paddingVertical: Spacing.sm,
              paddingHorizontal: Spacing.lg,
              borderRadius: 999,
              backgroundColor: confirm ? 'rgba(124,138,255,0.28)' : 'rgba(255,255,255,0.14)',
            }}
          >
            <Trash2 size={16} color="#FFFFFF" strokeWidth={2} />
            <Type variant="label" style={{ color: '#FFFFFF' }}>{confirm ? 'Wirklich löschen?' : 'Löschen'}</Type>
          </PressableScale>
        )}
      </View>
    </Modal>
  );
}
