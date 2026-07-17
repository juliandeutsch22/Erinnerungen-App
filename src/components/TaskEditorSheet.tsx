// TaskEditorSheet.tsx — Aufgaben-Editor als Glass-Bottom-Sheet (Fahrplan §4).
// Aufbau nach iOS-Muster: Titel + Notiz immer sichtbar, darunter kompakte
// Detail-Zeilen (Liste / Fällig / Wiederholung / Flagge) mit aktuellem Wert,
// die erst beim Antippen ihre Chips aufklappen — keine Chip-Wand. Der
// Primär-Button sitzt fest im Sheet-Footer. Löschen zweistufig.
import { CalendarDays, CalendarX2, Clock, Flag, ListChecks, type LucideIcon, Plus, Repeat, Tag as TagIcon, Trash2, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { DisclosureChevron } from '@/components/DisclosureChevron';
import { Chip } from '@/components/Chip';
import { GlassButton } from '@/components/GlassButton';
import { LinkedNotes } from '@/components/LinkedNotes';
import { listIcon } from '@/components/listMeta';
import { MiniCalendar } from '@/components/MiniCalendar';
import { PressableScale } from '@/components/PressableScale';
import { Expanded, Group, RowDivider } from '@/components/SheetParts';
import { TaskCheck } from '@/components/TaskCheck';
import { TimeField } from '@/components/TimeField';
import { Type } from '@/components/Type';
import { useCreateTask, useDeleteTask, useLists, useTasks, useUpdateTask } from '@/data/queries';
import type { Rrule, Subtask, Task } from '@/data/types';
import { newId, normalizeTag } from '@/data/types';
import { formatDueDate, todayStr } from '@/lib/dates';
import { tagCounts } from '@/lib/taskFilters';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { useSettings } from '@/theme/settings.store';
import { R, Spacing, T } from '@/theme/theme.tokens';

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
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [subDraft, setSubDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Neue Aufgabe: Fällig direkt offen (häufigste Aktion); Bearbeiten: alles kompakt.
  const [section, setSection] = useState<Section | null>(task === null ? 'due' : null);

  const canSave = title.trim().length > 0;
  const isEdit = task !== null;

  const toggleSection = (s: Section) => {
    hapticSelect();
    setSection((cur) => (cur === s ? null : s));
  };

  // Uhrzeit an/aus: an → Standard-Uhrzeit (Datum notfalls heute), aus → keine.
  const toggleTime = () => {
    hapticSelect();
    if (dueTime !== null) {
      setDueTime(null);
    } else {
      if (!dueDate) setDueDate(today);
      setDueTime(defaultDueTime);
    }
  };

  const currentList = useMemo(() => (lists ?? []).find((l) => l.id === listId), [lists, listId]);

  const dueLabel = dueDate ? formatDueDate(dueDate, today) + (dueTime ? `, ${dueTime}` : '') : 'Kein Datum';

  // Tag-Vorschläge aus dem Bestand (die noch nicht gewählt sind).
  const { data: allTasks } = useTasks();
  const suggestions = useMemo(
    () => tagCounts(allTasks ?? []).map((t) => t.tag).filter((t) => !tags.includes(t)).slice(0, 6),
    [allTasks, tags],
  );

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
    setTagDraft('');
  };
  const addSubtask = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setSubtasks((prev) => [...prev, { id: newId(), title: t, done: false }]);
    setSubDraft('');
  };

  const save = () => {
    if (!canSave) return;
    // Nur gültige Uhrzeiten übernehmen — halbe Eingaben („9:3", Text) verfallen.
    const validTime = dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : null;
    // Uhrzeit ohne Datum → heute; Wiederholung braucht ein Datum.
    const finalDate = dueDate ?? (validTime || rrule ? today : null);
    // Offener Entwurf im Eingabefeld nicht verschlucken.
    const finalTags = tagDraft.trim() ? [...tags, normalizeTag(tagDraft)].filter((v, i, a) => v && a.indexOf(v) === i) : tags;
    const finalSubs = subDraft.trim() ? [...subtasks, { id: newId(), title: subDraft.trim(), done: false }] : subtasks;
    const payload = {
      title: title.trim(),
      note: note.trim() ? note.trim() : null,
      listId,
      dueDate: finalDate,
      dueTime: finalDate ? validTime : null,
      rrule: finalDate ? rrule : null,
      flagged,
      tags: finalTags,
      subtasks: finalSubs,
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
          { fontSize: T.xl, fontWeight: '600', color: colors.text, paddingVertical: Spacing.sm },
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

      {/* Unteraufgaben — Checkliste innerhalb der Aufgabe. */}
      <View style={{ gap: Spacing.xs, marginBottom: Spacing.sm }}>
        {subtasks.map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <TaskCheck
              checked={s.done}
              accessibilityLabel={`${s.title} ${s.done ? 'wieder öffnen' : 'erledigen'}`}
              onToggle={(next) => setSubtasks((prev) => prev.map((x) => (x.id === s.id ? { ...x, done: next } : x)))}
            />
            <Type variant="body" tone={s.done ? 'text3' : 'text'} style={{ flex: 1, textDecorationLine: s.done ? 'line-through' : 'none' }}>
              {s.title}
            </Type>
            <PressableScale
              accessibilityLabel={`Schritt „${s.title}" entfernen`}
              onPress={() => setSubtasks((prev) => prev.filter((x) => x.id !== s.id))}
              style={{ padding: Spacing.xs }}
            >
              <X size={15} color={colors.text3} strokeWidth={2} />
            </PressableScale>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <ListChecks size={18} color={colors.text3} strokeWidth={2} />
          <TextInput
            value={subDraft}
            onChangeText={setSubDraft}
            placeholder="Schritt hinzufügen"
            placeholderTextColor={colors.text3}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={() => addSubtask(subDraft)}
            accessibilityLabel="Schritt hinzufügen"
            style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: Spacing.xs }, webNoOutline]}
          />
          {subDraft.trim().length > 0 && (
            <PressableScale accessibilityLabel="Schritt übernehmen" onPress={() => addSubtask(subDraft)} style={{ padding: Spacing.xs }}>
              <Plus size={18} color={colors.teal} strokeWidth={2.4} />
            </PressableScale>
          )}
        </View>
      </View>
      {/* Gruppierte Detail-Zeilen — iOS-Grouped-Look statt frei schwebender Zeilen. */}
      <Group>
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
              <Expanded>
                <ChipWrap>
                  {(lists ?? []).map((l) => (
                    <Chip key={l.id} label={l.name} active={listId === l.id} onPress={() => setListId(l.id)} />
                  ))}
                </ChipWrap>
              </Expanded>
            )}
            <RowDivider />
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
          <Expanded>
            <View style={{ gap: Spacing.md }}>
              {/* Datum direkt im Kalender antippen — keine Schnell-Chips. */}
              <View style={{ borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.bg2, padding: Spacing.sm }}>
                <MiniCalendar selected={dueDate} onSelect={setDueDate} />
              </View>

              {/* Uhrzeit: Schalter + natives Rad (statt Presets). */}
              <View style={{ gap: Spacing.sm }}>
                <PressableScale
                  accessibilityRole="switch"
                  accessibilityState={{ checked: dueTime !== null }}
                  accessibilityLabel={dueTime !== null ? 'Uhrzeit entfernen' : 'Uhrzeit hinzufügen'}
                  onPress={toggleTime}
                  pressedScale={0.99}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs }}
                >
                  <Clock size={18} color={dueTime !== null ? colors.teal : colors.text3} strokeWidth={2} />
                  <Type variant="body" style={{ flex: 1 }}>Uhrzeit</Type>
                  <Type variant="label" tone={dueTime !== null ? 'teal' : 'text3'}>{dueTime !== null ? 'An' : 'Aus'}</Type>
                </PressableScale>
                {dueTime !== null && (
                  <TimeField value={dueTime} onChange={setDueTime} accessibilityLabel="Uhrzeit wählen" />
                )}
              </View>

              {/* Datum wieder entfernen (dezenter Text-Link statt Chip). */}
              {dueDate && (
                <PressableScale
                  accessibilityLabel="Datum entfernen"
                  onPress={() => {
                    hapticSelect();
                    setDueDate(null);
                    setDueTime(null);
                    setRrule(null);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs }}
                >
                  <CalendarX2 size={15} color={colors.text3} strokeWidth={2} />
                  <Type variant="label" tone="text3">Datum entfernen</Type>
                </PressableScale>
              )}
            </View>
          </Expanded>
        )}
        <RowDivider />

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
          <Expanded>
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
          </Expanded>
        )}
        <RowDivider />

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
          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
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
      </Group>

      {/* Tags — kontextübergreifend, per Eingabe + Vorschläge. */}
      <View style={{ gap: Spacing.sm, paddingTop: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <TagIcon size={18} color={colors.text3} strokeWidth={2} />
          <TextInput
            value={tagDraft}
            onChangeText={(v) => setTagDraft(v.replace(/\s/g, ''))}
            placeholder="Tag hinzufügen"
            placeholderTextColor={colors.text3}
            autoCapitalize="none"
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={() => addTag(tagDraft)}
            accessibilityLabel="Tag hinzufügen"
            style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: Spacing.xs }, webNoOutline]}
          />
        </View>
        {(tags.length > 0 || suggestions.length > 0) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
            {tags.map((t) => (
              <Chip key={t} label={`#${t} ✕`} active accessibilityLabel={`Tag ${t} entfernen`} onPress={() => setTags((prev) => prev.filter((x) => x !== t))} />
            ))}
            {suggestions.map((t) => (
              <Chip key={t} label={`#${t}`} accessibilityLabel={`Tag ${t} hinzufügen`} onPress={() => addTag(t)} />
            ))}
          </View>
        )}
      </View>

      {/* Verknüpfte Notizen — nur im Bearbeiten-Modus (neue Aufgaben haben noch keine ID). */}
      {isEdit && task && (
        <View style={{ paddingTop: Spacing.lg }}>
          <LinkedNotes taskId={task.id} onNavigate={onClose} />
        </View>
      )}
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
      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
    >
      <Icon size={18} color={iconColor} strokeWidth={2} />
      <Type variant="body" style={{ flex: 1 }}>{label}</Type>
      <Type variant="label" tone={valueTone} numberOfLines={1} style={{ maxWidth: 170 }}>{value}</Type>
      <DisclosureChevron open={expanded} color={colors.text3} />
    </PressableScale>
  );
}

function ChipWrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>{children}</View>;
}
