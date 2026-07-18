// PasteNoteSheet.tsx — Umzugshelfer für Apple Notizen: Da Apple keine API
// für die Notizen-App anbietet, geht der Umzug per Kopieren & Einfügen.
// Eingefügter Text wird zu EINER Notiz (erste Zeile = Titel); das Sheet
// bleibt offen, damit mehrere Notizen zügig nacheinander wandern können.
import { ClipboardPaste } from 'lucide-react-native';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { GlassButton } from '@/components/GlassButton';
import { Type } from '@/components/Type';
import { useCreateNote } from '@/data/noteQueries';
import { hapticSuccess } from '@/lib/haptics';
import { noteTitle } from '@/lib/noteLogic';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

export function PasteNoteSheet({ onClose }: { onClose: () => void }) {
  const colors = useColors();
  const createNote = useCreateNote();
  const [text, setText] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [lastTitle, setLastTitle] = useState<string | null>(null);

  const save = () => {
    const body = text.trim();
    if (!body) return;
    createNote.mutate(
      { body },
      {
        onSuccess: (note) => {
          hapticSuccess();
          setSavedCount((n) => n + 1);
          setLastTitle(noteTitle(note.body));
          setText('');
        },
      },
    );
  };

  return (
    <BottomSheet
      visible
      title="Notizen einfügen"
      onClose={onClose}
      footer={
        <GlassButton accessibilityLabel="Als Notiz speichern" onPress={save} disabled={text.trim().length === 0}>
          <ClipboardPaste size={17} color="#FFFFFF" strokeWidth={2.2} />
          <Type variant="label" style={{ color: '#FFFFFF' }}>Als Notiz speichern</Type>
        </GlassButton>
      }
    >
      <Type variant="caption" tone="text3">
        So wandert eine Apple-Notiz um: In der Notizen-App die Notiz öffnen, alles markieren und
        kopieren — hier einfügen und speichern. Die erste Zeile wird zum Titel. Das Fenster bleibt
        offen für die nächste Notiz.
      </Type>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Hier einfügen…"
        placeholderTextColor={colors.text3}
        multiline
        accessibilityLabel="Notiztext einfügen"
        style={[
          {
            marginTop: Spacing.md,
            minHeight: 140,
            maxHeight: 260,
            borderRadius: R.md,
            borderWidth: 1,
            borderColor: colors.chipBorder,
            backgroundColor: colors.chip,
            padding: Spacing.md,
            fontSize: T.md,
            lineHeight: T.md * 1.5,
            color: colors.text,
            textAlignVertical: 'top',
          },
          webNoOutline,
        ]}
      />
      {savedCount > 0 && (
        <View style={{ marginTop: Spacing.sm }}>
          <Type variant="caption" tone="teal" tabular>
            {savedCount === 1 ? '1 Notiz gespeichert' : `${savedCount} Notizen gespeichert`}
            {lastTitle ? ` — zuletzt: „${lastTitle}"` : ''}
          </Type>
        </View>
      )}
    </BottomSheet>
  );
}
