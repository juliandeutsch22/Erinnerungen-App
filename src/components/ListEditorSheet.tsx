// ListEditorSheet.tsx — Liste anlegen/bearbeiten: Name, Icon (kuratiert),
// Akzentfarbe (Teal/Indigo-Familie). Löschen zweistufig, Standardliste nie.
import { CalendarClock, CalendarX2, CopyPlus, Trash2 } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { GlassButton } from '@/components/GlassButton';
import { LIST_COLORS, LIST_ICONS } from '@/components/listMeta';
import { MiniCalendar } from '@/components/MiniCalendar';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { getListRepository, getTaskRepository } from '@/data';
import { DEFAULT_LIST_ID } from '@/data/ListRepository';
import { queryKeys, useCreateList, useDeleteList, useTasks, useUpdateList } from '@/data/queries';
import type { List } from '@/data/types';
import { deadlineLabel, todayStr } from '@/lib/dates';
import { duplicateListWithTasks } from '@/lib/duplicateList';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

export function ListEditorSheet({ list, onClose }: { list: List | null; onClose: () => void }) {
  const colors = useColors();
  const createList = useCreateList();
  const updateList = useUpdateList();
  const deleteList = useDeleteList();

  const [name, setName] = useState(list?.name ?? '');
  const [icon, setIcon] = useState(list?.icon ?? 'inbox');
  const [color, setColor] = useState(list?.color ?? LIST_COLORS[0]);
  const [goal, setGoal] = useState(list?.goal ?? '');
  const [deadline, setDeadline] = useState<string | null>(list?.deadline ?? null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const qc = useQueryClient();
  const { data: allTasks } = useTasks();

  // Vorlagen-Duplikat: Kopie + frische Aufgaben in einem Rutsch anlegen.
  const duplicate = async () => {
    if (!list) return;
    const { list: copy, tasks: copiedTasks } = duplicateListWithTasks(list, allTasks ?? []);
    await getListRepository().create(copy);
    for (const t of copiedTasks) await getTaskRepository().create(t);
    await qc.invalidateQueries({ queryKey: queryKeys.lists });
    await qc.invalidateQueries({ queryKey: queryKeys.tasks });
    hapticSuccess();
    onClose();
  };

  const today = todayStr();
  const isEdit = list !== null;
  const canDelete = isEdit && list.id !== DEFAULT_LIST_ID;
  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const goalValue = goal.trim().length > 0 ? goal.trim() : null;
    if (isEdit) updateList.mutate({ id: list.id, patch: { name: name.trim(), icon, color, goal: goalValue, deadline } });
    else createList.mutate({ name: name.trim(), icon, color, goal: goalValue, deadline });
    onClose();
  };

  return (
    <BottomSheet visible title={isEdit ? 'Liste bearbeiten' : 'Neue Liste'} onClose={onClose}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name der Liste"
        placeholderTextColor={colors.text3}
        autoFocus={!isEdit}
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="Name der Liste"
        style={[
          { fontSize: T.xl, fontWeight: '600', color: colors.text, paddingVertical: Spacing.sm, marginBottom: Spacing.md },
          webNoOutline,
        ]}
      />

      <Type variant="label" tone="text2" style={{ marginBottom: Spacing.sm }}>Icon</Type>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg }}>
        {Object.entries(LIST_ICONS).map(([key, Icon]) => {
          const on = icon === key;
          return (
            <PressableScale
              key={key}
              accessibilityLabel={`Icon ${key}`}
              accessibilityState={{ selected: on }}
              onPress={() => {
                hapticSelect();
                setIcon(key);
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: R.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? `${color}1F` : colors.chip,
                borderWidth: 1.5,
                borderColor: on ? color : colors.chipBorder,
              }}
            >
              <Icon size={20} color={on ? color : colors.text3} strokeWidth={2} />
            </PressableScale>
          );
        })}
      </View>

      <Type variant="label" tone="text2" style={{ marginBottom: Spacing.sm }}>Farbe</Type>
      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl }}>
        {LIST_COLORS.map((c) => {
          const on = color === c;
          return (
            <PressableScale
              key={c}
              accessibilityLabel={`Farbe ${c}`}
              accessibilityState={{ selected: on }}
              onPress={() => {
                hapticSelect();
                setColor(c);
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: R.pill,
                backgroundColor: c,
                borderWidth: 2.5,
                borderColor: on ? colors.text : 'transparent',
              }}
            />
          );
        })}
      </View>

      {/* Projekt: optionales Ziel + Deadline machen die Liste zum Projekt. */}
      <Type variant="label" tone="text2" style={{ marginBottom: Spacing.sm }}>Ziel (optional)</Type>
      <TextInput
        value={goal}
        onChangeText={setGoal}
        placeholder="Worauf arbeitet diese Liste hin?"
        placeholderTextColor={colors.text3}
        accessibilityLabel="Ziel der Liste"
        style={[
          { fontSize: T.md, color: colors.text, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderColor: colors.border2, marginBottom: Spacing.lg },
          webNoOutline,
        ]}
      />

      <Type variant="label" tone="text2" style={{ marginBottom: Spacing.sm }}>Deadline (optional)</Type>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: showCalendar ? Spacing.md : Spacing.xl }}>
        <PressableScale
          accessibilityLabel="Deadline wählen"
          onPress={() => {
            hapticSelect();
            setShowCalendar((v) => !v);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: R.pill, backgroundColor: deadline ? `${color}1F` : colors.chip, borderWidth: 1, borderColor: deadline ? color : colors.chipBorder }}
        >
          <CalendarClock size={15} color={deadline ? color : colors.text3} strokeWidth={2} />
          <Type variant="label" tone={deadline ? 'text' : 'text3'}>
            {deadline ? deadlineLabel(deadline, today) : 'Keine Deadline'}
          </Type>
        </PressableScale>
        {deadline && (
          <PressableScale
            accessibilityLabel="Deadline entfernen"
            onPress={() => {
              hapticSelect();
              setDeadline(null);
              setShowCalendar(false);
            }}
            style={{ padding: Spacing.sm }}
          >
            <CalendarX2 size={16} color={colors.text3} strokeWidth={2} />
          </PressableScale>
        )}
      </View>
      {showCalendar && (
        <View style={{ marginBottom: Spacing.xl }}>
          <MiniCalendar
            selected={deadline}
            minDate={today}
            onSelect={(d) => {
              setDeadline(d);
              setShowCalendar(false);
            }}
          />
        </View>
      )}

      <GlassButton accessibilityLabel={isEdit ? 'Änderungen sichern' : 'Liste anlegen'} onPress={save} disabled={!canSave}>
        <Type variant="label" style={{ color: '#FFFFFF' }}>{isEdit ? 'Sichern' : 'Anlegen'}</Type>
      </GlassButton>

      {/* Vorlagen: Liste samt Aufgaben frisch duplizieren („Packliste Reise"). */}
      {isEdit && list && (
        <PressableScale
          accessibilityLabel="Liste duplizieren"
          onPress={() => void duplicate()}
          style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.md, marginTop: Spacing.sm }}
        >
          <CopyPlus size={15} color={colors.teal} strokeWidth={2} />
          <Type variant="label" tone="teal">Duplizieren — als frische Vorlage</Type>
        </PressableScale>
      )}

      {canDelete && (
        <PressableScale
          accessibilityLabel={confirmDelete ? 'Löschen bestätigen' : 'Liste löschen'}
          onPress={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            deleteList.mutate(list.id);
            onClose();
          }}
          style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.md, marginTop: Spacing.sm }}
        >
          <Trash2 size={15} color={confirmDelete ? colors.indigo : colors.text3} strokeWidth={2} />
          <Type variant="label" tone={confirmDelete ? 'indigo' : 'text3'}>
            {confirmDelete ? 'Samt Aufgaben in den Papierkorb? Tippe erneut.' : 'Löschen'}
          </Type>
        </PressableScale>
      )}
    </BottomSheet>
  );
}
