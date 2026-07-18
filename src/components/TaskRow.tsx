// TaskRow.tsx — eine Aufgaben-Zeile: Haken (Teal-Puls) + Titel + Meta-Zeile.
// Swipe rechts = erledigt, Swipe links = „Neu planen" (Fahrplan §3.6).
// Überfällig trägt Indigo (ruhig), nie Alarm-Rot.
import { Check, Flag, Link2, ListChecks, NotebookPen, Repeat } from 'lucide-react-native';
import React, { useMemo, useRef } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Highlighted } from '@/components/Highlighted';
import { PressableScale } from '@/components/PressableScale';
import { TaskCheck } from '@/components/TaskCheck';
import { Type } from '@/components/Type';
import { useNotes } from '@/data/noteQueries';
import type { List, Task } from '@/data/types';
import { formatDueDate } from '@/lib/dates';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
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
  showEventLink = true,
  highlight,
  onToggle,
  onPress,
  onReschedule,
  onLongPress,
}: {
  task: Task;
  today: string;
  /** Liste anzeigen (in Smart-Ansichten); in der Listen-Detailansicht weglassen. */
  list?: List;
  /** 'time-only': nur Uhrzeit zeigen (Tagesgruppen — das Datum steht im Header). */
  showDue?: boolean | 'time-only';
  /** Termin-Verknüpfungs-Glyph zeigen; unter dem verknüpften Termin selbst überflüssig. */
  showEventLink?: boolean;
  /** Suchbegriff: Fundstellen in Titel und Notiz werden hervorgehoben. */
  highlight?: string;
  onToggle: (next: boolean) => void;
  onPress: () => void;
  onReschedule?: () => void;
  /** Langes Drücken (Schnellmenü). */
  onLongPress?: () => void;
}) {
  const colors = useColors();
  const done = task.completedAt !== null;
  // Verknüpfte Notiz? Kleiner Glyph in der Titelzeile (analog zum Termin-Link).
  const { data: notes } = useNotes();
  const hasNote = useMemo(() => (notes ?? []).some((n) => n.taskId === task.id && n.deletedAt === null), [notes, task.id]);
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
        // Deckende Fläche in Tafel-Farbe: beim Swipen scheint die Aktion
        // dahinter sonst durch den Zeileninhalt (Text-Überlagerung).
        backgroundColor: colors.bg2,
      }}
    >
      <TaskCheck
        checked={done}
        onToggle={onToggle}
        accessibilityLabel={done ? `${task.title} — wieder öffnen` : `${task.title} — erledigen`}
      />
      <PressableScale accessibilityLabel={`${task.title} bearbeiten`} onPress={onPress} onLongPress={onLongPress} pressedScale={0.99} style={{ flex: 1 }}>
        <View style={{ gap: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Type
              variant="body"
              tone={done ? 'text3' : 'text'}
              style={{ flexShrink: 1, textDecorationLine: done ? 'line-through' : 'none' }}
              numberOfLines={2}
            >
              <Highlighted text={task.title} query={highlight} />
            </Type>
            {task.flagged && <Flag size={13} color={colors.indigo} fill={colors.indigo} strokeWidth={2} />}
            {task.rrule && <Repeat size={13} color={colors.text3} strokeWidth={2} />}
            {showEventLink && task.eventId && <Link2 size={13} color={colors.text3} strokeWidth={2} />}
            {hasNote && <NotebookPen size={13} color={colors.text3} strokeWidth={2} />}
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
                  <Highlighted text={task.note} query={highlight} />
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
        // direction = Bewegungsrichtung der Zeile (ReanimatedSwipeable):
        // 'right' = nach rechts gewischt → LINKE Aktion (Erledigt) offen.
        if (direction === 'right') {
          hapticSuccess();
          onToggle(true);
        } else {
          hapticSelect();
          onReschedule?.();
        }
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}
