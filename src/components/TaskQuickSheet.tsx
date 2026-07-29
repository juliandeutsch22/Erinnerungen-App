// TaskQuickSheet.tsx — Schnellmenü per Long-Press auf eine Aufgabe. Bündelt die
// Aktionen, die sonst nur tief im Editor liegen (Flagge, Löschen) plus Erledigen,
// als gruppierte Liste (gleiche Sprache wie die Editoren). Selbstständig: nutzt
// die Mutationen intern, braucht nur die Aufgabe.
import { CalendarClock, Check, Flag, RotateCcw, Trash2, type LucideIcon } from 'lucide-react-native';
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

/**
 * Pause zwischen dem Schließen dieses Sheets und dem Öffnen des nächsten.
 *
 * RN-Modals sind auf iOS echte View-Controller; `animationType="slide"` braucht
 * rund 300 ms zum Entlassen. Wer in dieser Zeit den nächsten präsentiert,
 * bekommt im besten Fall ein hängendes Sheet, im schlechteren einen Absturz.
 */
const MODAL_UEBERGABE_MS = 340;

// Eine Zeile des Aktions-Bogens. Liegt bewusst AUSSERHALB der Komponente:
// innen waere sie bei jedem Rendern ein neuer Komponententyp — React baut sie
// dann jedes Mal neu auf, statt sie zu aktualisieren (Zustand und Animation
// gehen verloren). `colors` kommt deshalb als Eigenschaft herein.
function Row({
  icon: Icon,
  label,
  tone,
  onPress,
  colors,
}: {
  icon: LucideIcon;
  label: string;
  tone: 'teal' | 'indigo' | 'text3';
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
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
}

export function TaskQuickSheet({
  task,
  onClose,
  /**
   * „Neu planen" öffnen. Bis v1.58.1 gab es das NUR als Wisch nach links —
   * eine Geste ohne sichtbaren Zwilling, und damit ein Verstoß gegen die
   * eigene Leitplanke aus §8.42 („eine Geste darf nie der einzige Weg zu
   * einer Funktion sein"). Ausgerechnet beim häufigsten Handgriff überhaupt.
   */
  onReschedule,
}: {
  task: Task;
  onClose: () => void;
  onReschedule?: () => void;
}) {
  const colors = useColors();
  const update = useUpdateTask();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const del = useDeleteTask();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const done = task.completedAt !== null;

  return (
    <BottomSheet visible title="Aktionen" onClose={onClose}>
      <Type variant="caption" tone="text3" style={{ marginBottom: Spacing.md }} numberOfLines={1}>
        {task.title}
      </Type>
      <Group>
        {onReschedule && (
          <>
            <Row
              colors={colors}
              icon={CalendarClock}
              label="Neu planen"
              tone="teal"
              onPress={() => {
                hapticSelect();
                onClose();
                // ⚠️ NICHT im selben Zug öffnen. `onClose` baut diesen Modal ab,
                // `onReschedule` baut den nächsten auf — im selben React-Commit
                // präsentiert iOS einen View-Controller, während der vorherige
                // noch entlassen wird. Das ist der klassische Weg in einen
                // Absturz beim Aufziehen des zweiten Sheets. Erst wenn die
                // Schließ-Animation durch ist, geht der nächste auf.
                setTimeout(onReschedule, MODAL_UEBERGABE_MS);
              }}
            />
            <RowDivider />
          </>
        )}
        <Row
          colors={colors}
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
          colors={colors}
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
          colors={colors}
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
