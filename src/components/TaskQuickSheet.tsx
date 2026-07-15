// TaskQuickSheet.tsx — Schnellmenü per Long-Press auf eine Aufgabe. Bündelt die
// Aktionen, die sonst nur tief im Editor liegen (Flagge, Löschen) plus Erledigen,
// als gruppierte Liste (gleiche Sprache wie die Editoren). Selbstständig: nutzt
// die Mutationen intern, braucht nur die Aufgabe.
import { Check, Flag, RotateCcw, Trash2, type LucideIcon } from 'lucide-react-native';
import React, { useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { PressableScale } from '@/components/PressableScale';
import { Group, RowDivider } from '@/components/SheetParts';
import { Type } from '@/components/Type';
import { useCompleteTask, useDeleteTask, useReopenTask, useUpdateTask } from '@/data/queries';
import type { Task } from '@/data/types';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export function TaskQuickSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const colors = useColors();
  const update = useUpdateTask();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const del = useDeleteTask();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const done = task.completedAt !== null;

  const Row = ({
    icon: Icon,
    label,
    tone,
    onPress,
  }: {
    icon: LucideIcon;
    label: string;
    tone: 'teal' | 'indigo' | 'text3';
    onPress: () => void;
  }) => {
    const color = tone === 'indigo' ? colors.indigo : tone === 'text3' ? colors.text3 : colors.teal;
    return (
      <PressableScale
        accessibilityLabel={label}
        onPress={onPress}
        pressedScale={0.99}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
      >
        <Icon size={18} color={color} strokeWidth={2} />
        <Type variant="body" style={{ flex: 1, color: tone === 'text3' ? colors.text : colors.text }}>{label}</Type>
      </PressableScale>
    );
  };

  return (
    <BottomSheet visible title="Aktionen" onClose={onClose}>
      <Type variant="caption" tone="text3" style={{ marginBottom: Spacing.md }} numberOfLines={1}>
        {task.title}
      </Type>
      <Group>
        <Row
          icon={Flag}
          label={task.flagged ? 'Flagge entfernen' : 'Flagge setzen'}
          tone={task.flagged ? 'indigo' : 'teal'}
          onPress={() => {
            hapticSelect();
            update.mutate({ id: task.id, patch: { flagged: !task.flagged } });
            onClose();
          }}
        />
        <RowDivider />
        <Row
          icon={done ? RotateCcw : Check}
          label={done ? 'Wieder öffnen' : 'Erledigt'}
          tone="teal"
          onPress={() => {
            if (done) {
              hapticSelect();
              reopen.mutate(task.id);
            } else {
              hapticSuccess();
              complete.mutate(task);
            }
            onClose();
          }}
        />
        <RowDivider />
        <Row
          icon={Trash2}
          label={confirmDelete ? 'Wirklich löschen? Tippe erneut.' : 'Löschen'}
          tone={confirmDelete ? 'indigo' : 'text3'}
          onPress={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            del.mutate(task.id);
            onClose();
          }}
        />
      </Group>
    </BottomSheet>
  );
}
