// ReorderSheet.tsx — Reihenfolge einer Liste per Drag & Drop festlegen.
// Eigenes Vollbild-Modal (DraggableFlatList als alleiniger Scroller — kein
// Nesting-Konflikt mit der Screen-ScrollView). „Fertig" schreibt die
// Reihenfolge über useReorderTasks fest.
import { Check, GripVertical } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, View } from 'react-native';
import DraggableFlatList, { type RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { GlassButton } from '@/components/GlassButton';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useReorderTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { hapticSelect } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { MAX_CONTENT_WIDTH } from '@/theme/layout';
import { R, Shadow, Spacing } from '@/theme/theme.tokens';

export function ReorderSheet({ tasks, onClose }: { tasks: Task[]; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reorder = useReorderTasks();
  const [data, setData] = useState<Task[]>(tasks);

  const done = () => {
    reorder.mutate(data.map((t) => t.id));
    onClose();
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Task>) => (
    <ScaleDecorator activeScale={1.03}>
      <PressableScale
        accessibilityLabel={`${item.title} verschieben`}
        onLongPress={() => {
          hapticSelect();
          drag();
        }}
        delayLongPress={120}
        pressedScale={1}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.md,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.sm,
          borderRadius: R.lg,
          backgroundColor: isActive ? `${colors.teal}22` : colors.chip,
          borderWidth: 1,
          borderColor: isActive ? colors.teal : colors.chipBorder,
        }}
      >
        <GripVertical size={18} color={colors.text3} strokeWidth={2} />
        <Type variant="body" numberOfLines={1} style={{ flex: 1 }}>{item.title}</Type>
      </PressableScale>
    </ScaleDecorator>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Backdrop />
        <View style={{ flex: 1, paddingTop: insets.top + Spacing.lg, paddingHorizontal: Spacing.lg }}>
          <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: Spacing.md }}>
              <View style={{ gap: 2 }}>
                <Type variant="eyebrow" tone="text3">Reihenfolge</Type>
                <Type variant="heading">Sortieren</Type>
              </View>
              <PressableScale accessibilityLabel="Fertig" onPress={done}>
                <GlassButton size="sm" accessibilityLabel="Reihenfolge sichern" onPress={done}>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.4} />
                  <Type variant="label" style={{ color: '#FFFFFF' }}>Fertig</Type>
                </GlassButton>
              </PressableScale>
            </View>
            <Type variant="caption" tone="text3" style={{ marginBottom: Spacing.md }}>
              Halte eine Aufgabe gedrückt und zieh sie an die neue Stelle.
            </Type>
            <DraggableFlatList
              data={data}
              keyExtractor={(t) => t.id}
              renderItem={renderItem}
              onDragEnd={({ data: next }) => setData(next)}
              contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxl }}
              style={[{ borderRadius: R.xl }, Shadow.sm]}
            />
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
