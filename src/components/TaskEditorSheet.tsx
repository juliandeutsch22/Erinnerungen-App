// TaskEditorSheet.tsx — Aufgaben-Editor als Glass-Bottom-Sheet (Fahrplan §4).
// Aufbau nach iOS-Muster: Titel + Notiz immer sichtbar, darunter kompakte
// Detail-Zeilen (Liste / Fällig / Wiederholung / Flagge) mit aktuellem Wert,
// die erst beim Antippen ihre Chips aufklappen — keine Chip-Wand. Der
// Primär-Button sitzt fest im Sheet-Footer. Löschen zweistufig.
import { CalendarDays, ChevronDown, ChevronRight, Flag, type LucideIcon, Moon, Repeat, Sun, Trash2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { GlassButton } from '@/components/GlassButton';
import { listIcon } from '@/components/listMeta';
import { MiniCalendar } from '@/components/MiniCalendar';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useCreateTask, useDeleteTask, useLists, useUpdateTask } from '@/data/queries';
import type { Rrule, Task } from '@/data/types';
import { addDays, formatDueDate, nextWeekend, todayStr } from '@/lib/dates';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
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
const RRULE_LABEL: Record<Rrule, string> = {
  daily: 'Täglich',
  weekdays: 'Werktags',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
};

type Section = 'list' | 'due' | 'repeat';

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
  // Neue Aufgabe: Fällig direkt offen (häufigste Aktion); Bearbeiten: alles kompakt.
  const [section, setSection] = useState<Section | null>(task === null ? 'due' : null);

  const canSave = title.trim().length > 0;
  const isEdit = task !== null;

  const toggleSection = (s: Section) => {
    hapticSelect();
    setSection((cur) => (cur === s ? null : s));
    setShowCalendar(false);
  };

  const currentList = useMemo(() => (lists ?? []).find((l) => l.id === listId), [lists, listId]);

  // Datums-Chips: Heute / Heute Abend / Morgen / Wochenende / Kalender.
  const weekend = nextWeekend(today);
  const dateChips = useMemo(
    () => [
      { key: 'heute', label: 'Heute', icon: Sun as LucideIcon | undefined, date: today, time: undefined as string | null | undefined },
      { key: 'abend', label: 'Heute Abend', icon: Moon as LucideIcon | undefined, date: today, time: '18:00' as string | null },
      { key: 'morgen', label: 'Morgen', icon: undefined, date: addDays(today, 1), time: undefined },
      { key: 'wochenende', label: 'Wochenende', icon: undefined, date: weekend, time: undefined },
    ],
    [today, weekend],
  );

  const dueLabel = dueDate ? formatDueDate(dueDate, today) + (dueTime ? `, ${dueTime}` : '') : 'Kein Datum';

  const save = () => {
    if (!canSave) return;
    // Nur gültige Uhrzeiten übernehmen — halbe Eingaben („9:3", Text) verfallen.
    const validTime = dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : null;
    // Uhrzeit ohne Datum → heute; Wiederholung braucht ein Datum.
    const finalDate = dueDate ?? (validTime || rrule ? today : null);
    const payload = {
      title: title.trim(),
      note: note.trim() ? note.trim() : null,
      listId,
      dueDate: finalDate,
      dueTime: finalDate ? validTime : null,
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

  const footer = (
    <View>
      <GlassButton accessibilityLabel={isEdit ? 'Änderungen sichern' : 'Aufgabe hinzufügen'} onPress={save} disabled={!canSave}>
        <Type variant="label" style={{ color: '#FFFFFF' }}>{isEdit ? 'Sichern' : 'Hinzufügen'}</Type>
      </GlassButton>
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
          style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, marginTop: Spacing.xs }}
        >
          <Trash2 size={15} color={confirmDelete ? colors.indigo : colors.text3} strokeWidth={2} />
          <Type variant="label" tone={confirmDelete ? 'indigo' : 'text3'}>
            {confirmDelete ? 'Wirklich löschen? Tippe erneut.' : 'Löschen'}
          </Type>
        </PressableScale>
      )}
    </View>
  );

  const ListIcon = currentList ? listIcon(currentList.icon) : undefined;

  return (
    <BottomSheet visible title={isEdit ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} onClose={onClose} footer={footer}>
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
          { fontSize: T.lg, color: colors.text, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderColor: colors.border2 },
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
          { fontSize: T.md, color: colors.text2, paddingVertical: Spacing.sm, marginBottom: Spacing.sm, minHeight: 36 },
          webNoOutline,
        ]}
      />

      {/* Liste — nur wenn es mehr als eine gibt. */}
      {(lists?.length ?? 0) > 1 && (
        <>
          <DetailRow
            icon={ListIcon ?? CalendarDays}
            iconColor={currentList?.color ?? colors.text3}
            label="Liste"
            value={currentList?.name ?? '—'}
            valueTone="text2"
            expanded={section === 'list'}
            onPress={() => toggleSection('list')}
          />
          {section === 'list' && (
            <ChipWrap>
              {(lists ?? []).map((l) => (
                <Chip key={l.id} label={l.name} active={listId === l.id} onPress={() => setListId(l.id)} />
              ))}
            </ChipWrap>
          )}
          <Hairline />
        </>
      )}

      {/* Fällig: Datum + Uhrzeit gemeinsam (gehören zusammen). */}
      <DetailRow
        icon={CalendarDays}
        iconColor={dueDate ? colors.teal : colors.text3}
        label="Fällig"
        value={dueLabel}
        valueTone={dueDate ? 'teal' : 'text3'}
        expanded={section === 'due'}
        onPress={() => toggleSection('due')}
      />
      {section === 'due' && (
        <View style={{ gap: Spacing.md, paddingBottom: Spacing.md }}>
          <ChipWrap>
            {dateChips.map((c) => {
              // „Heute" und „Heute Abend" schließen sich gegenseitig aus.
              const active =
                dueDate === c.date &&
                (c.key === 'abend' ? dueTime === '18:00' : c.key === 'heute' ? dueTime !== '18:00' : true);
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
                label="Kein Datum ✕"
                accessibilityLabel="Datum entfernen"
                onPress={() => {
                  setDueDate(null);
                  setDueTime(null);
                  setRrule(null);
                  setShowCalendar(false);
                }}
              />
            )}
          </ChipWrap>
          {showCalendar && (
            <View style={{ borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.chip, padding: Spacing.sm }}>
              <MiniCalendar
                selected={dueDate}
                onSelect={(d) => {
                  setDueDate(d);
                  setShowCalendar(false);
                }}
              />
            </View>
          )}
          <View style={{ gap: Spacing.sm }}>
            <Type variant="caption" tone="text3">Uhrzeit</Type>
            <ChipWrap>
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
            </ChipWrap>
          </View>
        </View>
      )}
      <Hairline />

      {/* Wiederholung */}
      <DetailRow
        icon={Repeat}
        iconColor={rrule ? colors.teal : colors.text3}
        label="Wiederholung"
        value={rrule ? RRULE_LABEL[rrule] : 'Nie'}
        valueTone={rrule ? 'teal' : 'text3'}
        expanded={section === 'repeat'}
        onPress={() => toggleSection('repeat')}
      />
      {section === 'repeat' && (
        <ChipWrap>
          {RRULES.map((r) => (
            <Chip
              key={r.value}
              label={r.label}
              active={rrule === r.value}
              onPress={() => setRrule(rrule === r.value ? null : r.value)}
            />
          ))}
        </ChipWrap>
      )}
      <Hairline />

      {/* Flagge: direkter Schalter, kein Aufklappen nötig. */}
      <PressableScale
        accessibilityRole="switch"
        accessibilityState={{ checked: flagged }}
        accessibilityLabel={flagged ? 'Flagge entfernen' : 'Flagge setzen'}
        onPress={() => {
          hapticSelect();
          setFlagged((v) => !v);
        }}
        pressedScale={0.99}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md }}
      >
        <Flag
          size={18}
          color={flagged ? colors.indigo : colors.text3}
          fill={flagged ? colors.indigo : 'transparent'}
          strokeWidth={2}
        />
        <Type variant="body" style={{ flex: 1 }}>Flagge</Type>
        <Type variant="label" tone={flagged ? 'indigo' : 'text3'}>{flagged ? 'Gesetzt' : 'Aus'}</Type>
      </PressableScale>
    </BottomSheet>
  );
}

/** Kompakte Detail-Zeile: Icon · Label · aktueller Wert · Chevron. */
function DetailRow({
  icon: Icon,
  iconColor,
  label,
  value,
  valueTone,
  expanded,
  onPress,
}: {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  value: string;
  valueTone: 'teal' | 'text2' | 'text3';
  expanded: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      pressedScale={0.99}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md }}
    >
      <Icon size={18} color={iconColor} strokeWidth={2} />
      <Type variant="body" style={{ flex: 1 }}>{label}</Type>
      <Type variant="label" tone={valueTone} numberOfLines={1} style={{ maxWidth: 170 }}>{value}</Type>
      {expanded ? (
        <ChevronDown size={16} color={colors.text3} strokeWidth={2} />
      ) : (
        <ChevronRight size={16} color={colors.text3} strokeWidth={2} />
      )}
    </PressableScale>
  );
}

function ChipWrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: Spacing.sm }}>{children}</View>;
}

function Hairline() {
  const colors = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}
