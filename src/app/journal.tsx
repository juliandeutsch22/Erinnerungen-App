// journal.tsx — Verlauf der Abendbetrachtung: alle Einträge, neueste zuerst.
// Tippen öffnet einen Eintrag zum Nachbearbeiten; Löschen zweistufig —
// auch ein Tagebuch darf Seiten verlieren, aber nie aus Versehen.
import { useRouter } from 'expo-router';
import { ChevronLeft, MoonStar } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { DisclosureChevron } from '@/components/DisclosureChevron';
import { GlassPanel } from '@/components/GlassPanel';
import { InsetField } from '@/components/InsetField';
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
import { groupJournal, journalStreak } from '@/lib/journalLogic';
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
  const jahre = useMemo(() => groupJournal(entries ?? []), [entries]);

  // Was steht offen? Beim ersten Aufschlagen genau EINES: der neueste Monat.
  // Alles andere zugeklappt — ein Tagebuch schlägt man auch nicht auf allen
  // Seiten gleichzeitig auf. Das aktuelle Jahr ist dabei immer offen; ältere
  // Jahre sind eine Zeile, bis man sie anfasst.
  const neuesterMonat = jahre[0]?.monate[0]?.key;
  const [offeneMonate, setOffeneMonate] = useState<Set<string>>(new Set());
  const [offeneJahre, setOffeneJahre] = useState<Set<string>>(new Set());
  const initialisiert = useRef(false);
  useEffect(() => {
    if (initialisiert.current || jahre.length === 0) return;
    initialisiert.current = true;
    setOffeneJahre(new Set([jahre[0].key]));
    setOffeneMonate(new Set(neuesterMonat ? [neuesterMonat] : []));
  }, [jahre, neuesterMonat]);

  const umschalten = (menge: Set<string>, setzen: (s: Set<string>) => void, key: string) => {
    hapticSelect();
    const next = new Set(menge);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setzen(next);
  };

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
          <View style={{ gap: Spacing.md }}>
          {jahre.map((jahr) => {
            const jahrOffen = offeneJahre.has(jahr.key);
            return (
            <GlassPanel key={jahr.key}>
              {/* Die Jahreszeile erscheint nur, wenn es mehr als eines gibt —
                  im ersten Jahr wäre sie eine Überschrift ohne Gegenstück. */}
              {jahre.length > 1 && (
                <PressableScale
                  accessibilityLabel={`Jahr ${jahr.key} ${jahrOffen ? 'zuklappen' : 'aufklappen'}`}
                  accessibilityState={{ expanded: jahrOffen }}
                  onPress={() => umschalten(offeneJahre, setOffeneJahre, jahr.key)}
                  pressedScale={0.99}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs }}
                >
                  <Type variant="heading">{jahr.key}</Type>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <Type variant="caption" tone="text3" tabular>
                      {jahr.anzahl === 1 ? '1 Eintrag' : `${jahr.anzahl} Einträge`}
                    </Type>
                    <DisclosureChevron open={jahrOffen} color={colors.text3} />
                  </View>
                </PressableScale>
              )}

              {(jahre.length === 1 || jahrOffen) &&
                jahr.monate.map((monat, mi) => {
                  const monatOffen = offeneMonate.has(monat.key);
                  return (
                    <View key={monat.key}>
                      {(mi > 0 || jahre.length > 1) && <Seam marginVertical={Spacing.sm} />}
                      <PressableScale
                        accessibilityLabel={`${monat.label} ${jahr.key} ${monatOffen ? 'zuklappen' : 'aufklappen'}`}
                        accessibilityState={{ expanded: monatOffen }}
                        onPress={() => umschalten(offeneMonate, setOffeneMonate, monat.key)}
                        pressedScale={0.99}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs }}
                      >
                        <Type variant="eyebrow" tone={monatOffen ? 'indigo' : 'text3'}>{monat.label}</Type>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                          <Type variant="caption" tone="text3" tabular>{monat.eintraege.length}</Type>
                          <DisclosureChevron open={monatOffen} color={colors.text3} size={14} />
                        </View>
                      </PressableScale>

                      {monatOffen &&
                        monat.eintraege.map((e, i) => (
                          <View key={e.id} style={{ marginTop: i === 0 ? Spacing.sm : 0 }}>
                            {i > 0 && <Seam marginVertical={Spacing.md} />}
                            {editingId === e.id ? (
                  <View>
                    <Type variant="heading">{formatDueDate(e.date, today)}</Type>
                    {/* Dieselbe eingelassene Schreibfläche wie in der Abendkarte —
                        es ist dasselbe Feld, also darf es nicht anders aussehen. */}
                    <InsetField radius={R.lg} style={{ marginTop: Spacing.sm }}>
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
                            minHeight: 96,
                            textAlignVertical: 'top',
                            color: colors.text,
                            fontSize: T.md,
                            lineHeight: 26,
                            paddingHorizontal: Spacing.md,
                            paddingVertical: Spacing.md,
                          },
                          webNoOutline,
                        ]}
                      />
                    </InsetField>
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
                    </View>
                  );
                })}
            </GlassPanel>
            );
          })}
          </View>
        )}
      </Reveal>
      <KeyboardDoneBar />
    </Screen>
  );
}
