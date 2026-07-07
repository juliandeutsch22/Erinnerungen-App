// TaskRow.tsx — eine Aufgaben-Zeile: Haken (Teal-Puls) + Titel + Meta-Zeile.
// Swipe rechts = erledigt, Swipe links = „Neu planen" (Fahrplan §3.6).
// Überfällig trägt Indigo (ruhig), nie Alarm-Rot.
import { Check, Flag, ListChecks, Repeat } from 'lucide-react-native';
import React, { useRef } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { PressableScale } from '@/components/PressableScale';
import { TaskCheck } from '@/components/TaskCheck';
import { Type } from '@/components/Type';
import type { List, Task } from '@/data/types';
import { formatDueDate } from '@/lib/dates';
import { subtaskProgress } from '@/lib/taskFilters';
import { isOverdue } from '@/lib/taskLogic';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

const RRULE_SHORT: Record<string, string> = {
  daily: 'täglich',
  weekdays: 'werktags',
  weekly: 'wöchentlich',
  monthly: 'monatlich',
  yearly: 'jährlich',
};

export function TaskRow({
  task,
  today,
  list,
  showDue = true,
  onToggle,
  onPress,
  onReschedule,
}: {
  task: Task;
  today: string;
  /** Liste anzeigen (in Smart-Ansichten); in der Listen-Detailansicht weglassen. */
  list?: List;
  /** 'time-only': nur Uhrzeit zeigen (Tagesgruppen — das Datum steht im Header). */
  showDue?: boolean | 'time-only';
  onToggle: (next: boolean) => void;
  onPress: () => void;
  onReschedule?: () => void;
}) {
  const colors = useColors();
  const done = task.completedAt !== null;
  const overdue = isOverdue(task, today);
  const progress = subtaskProgress(task.subtasks);
  const swipeRef = useRef<SwipeableMethods>(null);

  const metaParts: { text: string; tone: 'indigo' | 'teal' | 'text3' }[] = [];
  if (showDue === 'time-only') {
    if (task.dueTime) metaParts.push({ text: task.dueTime, tone: 'text3' });
  } else if (showDue && task.dueDate) {
    metaParts.push({
      text: formatDueDate(task.dueDate, today) + (task.dueTime ? `, ${task.dueTime}` : ''),
      tone: done ? 'text3' : overdue ? 'indigo' : task.dueDate === today ? 'teal' : 'text3',
    });
  }
  if (list) metaParts.push({ text: list.name, tone: 'text3' });

  const row = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.sm + 2,
        // Deckende Fläche, damit beim Swipen die Aktion dahinter nicht durchscheint.
        backgroundColor: 'transparent',
      }}
    >
      <TaskCheck
        checked={done}
        onToggle={onToggle}
        accessibilityLabel={done ? `${task.title} — wieder öffnen` : `${task.title} — erledigen`}
      />
      <PressableScale accessibilityLabel={`${task.title} bearbeiten`} onPress={onPress} pressedScale={0.99} style={{ flex: 1 }}>
        <View style={{ gap: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Type
              variant="body"
              tone={done ? 'text3' : 'text'}
              style={{ flexShrink: 1, textDecorationLine: done ? 'line-through' : 'none' }}
              numberOfLines={2}
            >
              {task.title}
            </Type>
            {task.flagged && <Flag size={13} color={colors.indigo} fill={colors.indigo} strokeWidth={2} />}
            {task.rrule && <Repeat size={13} color={colors.text3} strokeWidth={2} />}
          </View>
          {(metaParts.length > 0 || task.note || progress.total > 0) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              {metaParts.map((p, i) => (
                <Type key={i} variant="caption" tone={p.tone}>
                  {p.text}
                </Type>
              ))}
              {progress.total > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <ListChecks size={11} color={progress.done === progress.total ? colors.teal : colors.text3} strokeWidth={2} />
                  <Type variant="caption" tone={progress.done === progress.total ? 'teal' : 'text3'} tabular>
                    {progress.done}/{progress.total}
                  </Type>
                </View>
              )}
              {task.note ? (
                <Type variant="caption" tone="text3" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {task.note}
                </Type>
              ) : null}
            </View>
          )}
          {task.tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: 2 }}>
              {task.tags.map((tag) => (
                <View key={tag} style={{ paddingVertical: 1, paddingHorizontal: Spacing.xs + 1, borderRadius: R.pill, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.chipBorder }}>
                  <Type variant="caption" tone="text3">#{tag}</Type>
                </View>
              ))}
            </View>
          )}
        </View>
      </PressableScale>
    </View>
  );

  // Erledigte Zeilen brauchen keine Swipe-Aktionen.
  if (done) return row;

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={56}
      rightThreshold={56}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'flex-start',
            paddingHorizontal: Spacing.md,
            minWidth: 88,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <Check size={16} color={colors.teal} strokeWidth={2.4} />
            <Type variant="label" tone="teal">Erledigt</Type>
          </View>
        </View>
      )}
      renderRightActions={
        onReschedule
          ? () => (
              <View
                style={{
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                  paddingHorizontal: Spacing.md,
                  minWidth: 104,
                }}
              >
                <View
                  style={{
                    paddingVertical: Spacing.xs,
                    paddingHorizontal: Spacing.sm,
                    borderRadius: R.pill,
                    backgroundColor: `${colors.indigo}1A`,
                  }}
                >
                  <Type variant="label" tone="indigo" style={{ fontSize: T.sm }}>
                    Neu planen
                  </Type>
                </View>
              </View>
            )
          : undefined
      }
      onSwipeableWillOpen={(direction) => {
        swipeRef.current?.close();
        if (direction === 'left') onToggle(true);
        else onReschedule?.();
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}
