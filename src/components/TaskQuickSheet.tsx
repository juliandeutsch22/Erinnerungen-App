// TaskQuickSheet.tsx — Schnellmenü per Long-Press auf eine Aufgabe. Bündelt die
// Aktionen, die sonst nur tief im Editor liegen (Flagge, Löschen) plus Erledigen,
// als gruppierte Liste (gleiche Sprache wie die Editoren). Selbstständig: nutzt
// die Mutationen intern, braucht nur die Aufgabe.
import { CalendarClock, Check, Flag, PauseCircle, RotateCcw, Trash2, type LucideIcon } from 'lucide-react-native';
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
                // Die Pause zwischen den beiden Sheets liegt seit v1.67.0 im
                // Tor (`lib/sheetPresence.ts`) und nicht mehr hier: sie galt
                // sonst an genau DIESER Stelle und an keiner künftigen.
                onReschedule();
              }}
            />
            <RowDivider />
          </>
        )}
        {/* Warten auf — der schnelle Weg. Der ausführliche liegt im Editor
            (mit „worauf?" und dem Menschen); hier genügt der Zustand, weil man
            ihn meistens genau in dem Moment setzt, in dem einem auffällt, dass
            man selbst gerade nichts tun kann. */}
        {!done && (
          <>
            <Row
              colors={colors}
              icon={PauseCircle}
              label={task.waiting ? 'Nicht mehr warten' : 'Ich warte darauf'}
              tone={task.waiting ? 'indigo' : 'teal'}
              onPress={() => {
                hapticSelect();
                // Beim Beenden auch den Text lösen: „wartet auf Angebot" an
                // einer Aufgabe, die nicht mehr wartet, wäre eine Fußnote, die
                // niemand mehr aufräumt.
                update.mutate({
                  id: task.id,
                  patch: task.waiting ? { waiting: false, waitingFor: null } : { waiting: true },
                });
                onClose();
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
