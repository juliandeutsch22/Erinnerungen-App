// TaskEditorSheet.tsx — Aufgaben-Editor als Glass-Bottom-Sheet (Fahrplan §4):
// Titel, Notiz, Listen-Chips, Datums-Chips (+ Mini-Kalender), Uhrzeit-Chips,
// Wiederholungs-Chips, Flagge. Destruktives Löschen zweistufig.
import { CalendarDays, Flag, Moon, Sun, Trash2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { GlassButton } from '@/components/GlassButton';
import { MiniCalendar } from '@/components/MiniCalendar';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useCreateTask, useDeleteTask, useLists, useUpdateTask } from '@/data/queries';
import type { Rrule, Task } from '@/data/types';
import { addDays, formatDueDate, nextWeekend, todayStr } from '@/lib/dates';
import { hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { useSettings } from '@/theme/settings.store';
import { R, Spacing, T } from '@/theme/theme.tokens';

const TIME_PRESETS = ['09:00', '12:00', '18:00'];
const RRULES: { value: Rrule; label: string }[] = [
  { value: 'daily', label: 'Täglich' },
  { value: 'weekdays', label: 'Werktags' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'yearly', label: 'Jährlich' },
];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
      <Type variant="label" tone="text2">{label}</Type>
      {children}
    </View>
  );
}

export function TaskEditorSheet({
  task,
  defaultListId,
  defaultDueDate,
  onClose,
}: {
  /** null = neue Aufgabe. */
  task: Task | null;
  defaultListId?: string;
  defaultDueDate?: string | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const today = todayStr();
  const { data: lists } = useLists();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const defaultDueTime = useSettings((s) => s.defaultDueTime);

  const [title, setTitle] = useState(task?.title ?? '');
  const [note, setNote] = useState(task?.note ?? '');
  const [listId, setListId] = useState(task?.listId ?? defaultListId ?? lists?.[0]?.id ?? 'default');
  const [dueDate, setDueDate] = useState<string | null>(task?.dueDate ?? defaultDueDate ?? null);
  const [dueTime, setDueTime] = useState<string | null>(task?.dueTime ?? null);
  const [rrule, setRrule] = useState<Rrule | null>(task?.rrule ?? null);
  const [flagged, setFlagged] = useState(task?.flagged ?? false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [customTime, setCustomTime] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canSave = title.trim().length > 0;
  const isEdit = task !== null;

  // Datums-Chips: Heute / Heute Abend / Morgen / Wochenende / Kalender.
  const weekend = nextWeekend(today);
  const dateChips = useMemo(
    () => [
      { key: 'heute', label: 'Heute', icon: Sun, date: today, time: undefined as string | null | undefined },
      { key: 'abend', label: 'Heute Abend', icon: Moon, date: today, time: '18:00' as string | null },
      { key: 'morgen', label: 'Morgen', icon: undefined, date: addDays(today, 1), time: undefined },
      { key: 'wochenende', label: 'Wochenende', icon: undefined, date: weekend, time: undefined },
    ],
    [today, weekend],
  );

  const save = () => {
    if (!canSave) return;
    // Uhrzeit ohne Datum → heute; Wiederholung braucht ein Datum.
    const finalDate = dueDate ?? (dueTime || rrule ? today : null);
    const payload = {
      title: title.trim(),
      note: note.trim() ? note.trim() : null,
      listId,
      dueDate: finalDate,
      dueTime: finalDate ? dueTime : null,
      rrule: finalDate ? rrule : null,
      flagged,
    };
    if (isEdit) {
      updateTask.mutate({ id: task.id, patch: payload });
    } else {
      createTask.mutate(payload);
      hapticSuccess();
    }
    onClose();
  };

  return (
    <BottomSheet visible title={isEdit ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} onClose={onClose}>
      {/* Titel */}
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Was liegt an?"
        placeholderTextColor={colors.text3}
        autoFocus={!isEdit}
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="Titel"
        style={[
          { fontSize: T.lg, color: colors.text, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderColor: colors.border2, marginBottom: Spacing.md },
          webNoOutline,
        ]}
      />
      {/* Notiz */}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Notiz"
        placeholderTextColor={colors.text3}
        multiline
        accessibilityLabel="Notiz"
        style={[
          { fontSize: T.md, color: colors.text2, paddingVertical: Spacing.sm, marginBottom: Spacing.lg, minHeight: 40 },
          webNoOutline,
        ]}
      />

      {/* Liste */}
      {(lists?.length ?? 0) > 1 && (
        <Section label="Liste">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
            {(lists ?? []).map((l) => (
              <Chip key={l.id} label={l.name} active={listId === l.id} onPress={() => setListId(l.id)} />
            ))}
          </View>
        </Section>
      )}

      {/* Datum */}
      <Section label="Fällig">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
          {dateChips.map((c) => {
            const active = dueDate === c.date && (c.key !== 'abend' || dueTime === '18:00');
            return (
              <Chip
                key={c.key}
                label={c.label}
                icon={c.icon}
                active={active}
                onPress={() => {
                  setDueDate(c.date);
                  if (c.time !== undefined) setDueTime(c.time);
                  setShowCalendar(false);
                }}
              />
            );
          })}
          <Chip label="Kalender" icon={CalendarDays} active={showCalendar} onPress={() => setShowCalendar((v) => !v)} />
          {dueDate && (
            <Chip
              label={`${formatDueDate(dueDate, today)} ✕`}
              accessibilityLabel="Datum entfernen"
              onPress={() => {
                setDueDate(null);
                setDueTime(null);
                setRrule(null);
                setShowCalendar(false);
              }}
            />
          )}
        </View>
        {showCalendar && (
          <View style={{ borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.chip, padding: Spacing.sm, marginTop: Spacing.xs }}>
            <MiniCalendar
              selected={dueDate}
              onSelect={(d) => {
                setDueDate(d);
                setShowCalendar(false);
              }}
            />
          </View>
        )}
      </Section>

      {/* Uhrzeit — nur sinnvoll mit Datum (setzt sonst automatisch heute). */}
      <Section label="Uhrzeit">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' }}>
          {TIME_PRESETS.map((t) => (
            <Chip
              key={t}
              label={t}
              active={dueTime === t && !customTime}
              onPress={() => {
                setCustomTime(false);
                setDueTime(dueTime === t ? null : t);
              }}
            />
          ))}
          <Chip label="Eigene" active={customTime} onPress={() => setCustomTime((v) => !v)} />
          {customTime && (
            <TextInput
              value={dueTime ?? ''}
              onChangeText={(v) => {
                // nur H:MM/HH:MM übernehmen; sonst Eingabe stehen lassen.
                setDueTime(/^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, '0') : v.length === 0 ? null : v);
              }}
              placeholder={defaultDueTime}
              placeholderTextColor={colors.text3}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Eigene Uhrzeit (HH:MM)"
              style={[
                { fontSize: T.md, color: colors.text, borderBottomWidth: 1, borderColor: colors.border2, minWidth: 64, paddingVertical: Spacing.xs },
                webNoOutline,
              ]}
            />
          )}
        </View>
      </Section>

      {/* Wiederholung */}
      <Section label="Wiederholung">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
          {RRULES.map((r) => (
            <Chip
              key={r.value}
              label={r.label}
              active={rrule === r.value}
              onPress={() => setRrule(rrule === r.value ? null : r.value)}
            />
          ))}
        </View>
      </Section>

      {/* Flagge */}
      <Section label="Markierung">
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Chip label="Flagge" icon={Flag} active={flagged} onPress={() => setFlagged((v) => !v)} />
        </View>
      </Section>

      <GlassButton accessibilityLabel={isEdit ? 'Änderungen sichern' : 'Aufgabe hinzufügen'} onPress={save} disabled={!canSave}>
        <Type variant="label" style={{ color: '#FFFFFF' }}>{isEdit ? 'Sichern' : 'Hinzufügen'}</Type>
      </GlassButton>

      {/* Löschen — zweistufig (Fahrplan §4). */}
      {isEdit && (
        <PressableScale
          accessibilityLabel={confirmDelete ? 'Endgültig löschen' : 'Aufgabe löschen'}
          onPress={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            deleteTask.mutate(task.id);
            onClose();
          }}
          style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.md, marginTop: Spacing.sm }}
        >
          <Trash2 size={15} color={confirmDelete ? colors.indigo : colors.text3} strokeWidth={2} />
          <Type variant="label" tone={confirmDelete ? 'indigo' : 'text3'}>
            {confirmDelete ? 'Wirklich löschen? Tippe erneut.' : 'Löschen'}
          </Type>
        </PressableScale>
      )}
    </BottomSheet>
  );
}
