// ListEditorSheet.tsx — Liste anlegen/bearbeiten: Name, Icon (kuratiert),
// Akzentfarbe (Teal/Indigo-Familie). Löschen zweistufig, Standardliste nie.
import { Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { GlassButton } from '@/components/GlassButton';
import { LIST_COLORS, LIST_ICONS } from '@/components/listMeta';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { DEFAULT_LIST_ID } from '@/data/ListRepository';
import { useCreateList, useDeleteList, useUpdateList } from '@/data/queries';
import type { List } from '@/data/types';
import { hapticSelect } from '@/lib/haptics';
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = list !== null;
  const canDelete = isEdit && list.id !== DEFAULT_LIST_ID;
  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    if (isEdit) updateList.mutate({ id: list.id, patch: { name: name.trim(), icon, color } });
    else createList.mutate({ name: name.trim(), icon, color });
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
          { fontSize: T.lg, color: colors.text, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderColor: colors.border2, marginBottom: Spacing.lg },
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

      <GlassButton accessibilityLabel={isEdit ? 'Änderungen sichern' : 'Liste anlegen'} onPress={save} disabled={!canSave}>
        <Type variant="label" style={{ color: '#FFFFFF' }}>{isEdit ? 'Sichern' : 'Anlegen'}</Type>
      </GlassButton>

      {canDelete && (
        <PressableScale
          accessibilityLabel={confirmDelete ? 'Endgültig löschen' : 'Liste löschen'}
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
            {confirmDelete ? 'Liste samt Aufgaben löschen? Tippe erneut.' : 'Löschen'}
          </Type>
        </PressableScale>
      )}
    </BottomSheet>
  );
}
