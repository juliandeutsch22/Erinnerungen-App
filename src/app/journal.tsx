// journal.tsx — Verlauf der Abendbetrachtung: alle Einträge, neueste zuerst.
// Tippen öffnet einen Eintrag zum Nachbearbeiten; Löschen zweistufig —
// auch ein Tagebuch darf Seiten verlieren, aber nie aus Versehen.
import { useRouter } from 'expo-router';
import { ChevronLeft, MoonStar } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { GlassPanel } from '@/components/GlassPanel';
import { KeyboardDoneBar, keyboardDoneProps } from '@/components/KeyboardDone';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState } from '@/components/StateView';
import { Type } from '@/components/Type';
import { useJournal, useRemoveJournal, useSaveJournal } from '@/data/journalQueries';
import { formatDueDate, todayStr } from '@/lib/dates';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { journalStreak } from '@/lib/journalLogic';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

export default function JournalScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: entries } = useJournal();
  const save = useSaveJournal();
  const remove = useRemoveJournal();
  const today = todayStr();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const list = useMemo(() => (entries ?? []).filter((e) => e.text.trim().length > 0), [entries]);
  const streak = useMemo(() => journalStreak(entries ?? [], today), [entries, today]);

  const subtitle =
    (list.length === 1 ? '1 Eintrag' : `${list.length} Einträge`) +
    (streak >= 2 ? ` · ${streak} Abende in Folge` : '');

  const startEdit = (id: string, text: string) => {
    hapticSelect();
    setEditingId(id);
    setEditText(text);
    setConfirmDelete(false);
  };

  const finishEdit = (date: string) => {
    hapticSuccess();
    save.mutate({ date, text: editText });
    setEditingId(null);
  };

  const deleteEntry = (id: string) => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    hapticSuccess();
    remove.mutate(id);
    setEditingId(null);
    setConfirmDelete(false);
  };

  return (
    <Screen withTabBar={false} automaticallyAdjustKeyboardInsets>
      <Reveal>
        <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm, marginLeft: -Spacing.sm, alignSelf: 'flex-start' }}>
          <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
        </PressableScale>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
          <MoonStar size={24} color={colors.indigo} strokeWidth={2} />
          <Type variant="title">Abendbetrachtung</Type>
        </View>
        <Type variant="caption" tone="text3" style={{ marginTop: 2 }} tabular>{subtitle}</Type>
      </Reveal>

      <Reveal delay={60}>
        {list.length === 0 ? (
          <GlassPanel>
            <EmptyState
              icon={<MoonStar size={20} color={colors.indigo} strokeWidth={2} />}
              title="Noch keine Betrachtungen"
              body={'Abends erscheint auf „Heute" die Frage des Tages — ein paar ehrliche Zeilen genügen.'}
            />
          </GlassPanel>
        ) : (
          <GlassPanel>
            {list.map((e, i) => (
              <View key={e.id}>
                {i > 0 && <Seam marginVertical={Spacing.md} />}
                {editingId === e.id ? (
                  <View>
                    <Type variant="heading">{formatDueDate(e.date, today)}</Type>
                    <TextInput
                      value={editText}
                      onChangeText={setEditText}
                      multiline
                      autoFocus
                      scrollEnabled={false}
                      accessibilityLabel={`Betrachtung vom ${e.date} bearbeiten`}
                      {...keyboardDoneProps}
                      style={[
                        {
                          marginTop: Spacing.sm,
                          minHeight: 72,
                          textAlignVertical: 'top',
                          color: colors.text,
                          fontSize: T.md,
                          lineHeight: 22,
                          padding: Spacing.md,
                          borderRadius: R.md,
                          backgroundColor: colors.chip,
                        },
                        webNoOutline,
                      ]}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm }}>
                      <PressableScale
                        accessibilityLabel="Eintrag löschen"
                        onPress={() => deleteEntry(e.id)}
                        style={{ paddingVertical: Spacing.xs }}
                      >
                        <Type variant="caption" tone="indigo">
                          {confirmDelete ? 'Wirklich löschen? Nochmal tippen.' : 'Eintrag löschen'}
                        </Type>
                      </PressableScale>
                      <PressableScale
                        accessibilityLabel="Bearbeitung abschließen"
                        onPress={() => finishEdit(e.date)}
                        style={{ paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm }}
                      >
                        <Type variant="label" tone="teal">Fertig</Type>
                      </PressableScale>
                    </View>
                  </View>
                ) : (
                  <PressableScale
                    accessibilityLabel={`Betrachtung vom ${e.date} bearbeiten`}
                    onPress={() => startEdit(e.id, e.text)}
                    pressedScale={0.99}
                  >
                    <Type variant="heading">{formatDueDate(e.date, today)}</Type>
                    <Type variant="body" tone="text2" style={{ marginTop: Spacing.xs }}>{e.text.trim()}</Type>
                  </PressableScale>
                )}
              </View>
            ))}
          </GlassPanel>
        )}
      </Reveal>
      <KeyboardDoneBar />
    </Screen>
  );
}
