// braindump.tsx — alles aus dem Kopf kippen, der Assistent sortiert:
// ein großes Feld, „Sortieren lassen" zerlegt den Wurf in Aufgaben (mit
// erkannten Daten) und Notizen. Vorschläge einzeln abwählbar, EIN Tipp
// übernimmt — nichts wird ohne Bestätigung angelegt. Der Braindump ist
// bewusst KEIN Chat: einmal rein, sortiert, fertig.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BrainCircuit, Check, ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { GlassButton } from '@/components/GlassButton';
import { GlassPanel } from '@/components/GlassPanel';
import { KeyboardDoneBar, keyboardDoneProps } from '@/components/KeyboardDone';
import { MicButton } from '@/components/MicButton';
import { PressableScale } from '@/components/PressableScale';
import { LoadingState } from '@/components/StateView';
import { Type } from '@/components/Type';
import { useCreateAssistantEvents } from '@/data/calendarQueries';
import { useCreateNote } from '@/data/noteQueries';
import { useCreateTask } from '@/data/queries';
import type { ChatMessage } from '@/data/types';
import { askAssistant, buildBraindumpContext, extractActions, type AssistantAction } from '@/lib/assistant';
import { formatDueDate, parseDateStr, todayStr } from '@/lib/dates';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { useSettings } from '@/theme/settings.store';
import { R, Spacing, T } from '@/theme/theme.tokens';

export default function BraindumpScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const apiKey = useSettings((s) => s.geminiApiKey);
  const createTask = useCreateTask();
  const createNote = useCreateNote();
  const createEvents = useCreateAssistantEvents();
  const today = todayStr();

  // Geteilter Text (iOS-Kurzbefehl → stille://braindump?text=…) füllt das Feld
  // einmalig vor — der Nutzer prüft und lässt sortieren.
  const { text: sharedText } = useLocalSearchParams<{ text?: string }>();
  const [text, setText] = useState('');
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && typeof sharedText === 'string' && sharedText.trim().length > 0) {
      seeded.current = true;
      setText(sharedText);
    }
  }, [sharedText]);
  const dictBaseRef = useRef('');
  const [dictating, setDictating] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<AssistantAction | null>(null);
  // Abwählbare Vorschläge: 'a0', 'a1', … Aufgaben; 'n0', … Notizen.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<string | null>(null);

  const sort = async () => {
    const dump = text.trim();
    if (!dump || pending) return;
    setPending(true);
    setError(null);
    setActions(null);
    setDone(null);
    try {
      const dateLabel = `${parseDateStr(today).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${today})`;
      const msg: ChatMessage = { id: 'dump', chatId: 'dump', role: 'user', content: dump, createdAt: new Date().toISOString() };
      const answer = await askAssistant(apiKey, [msg], buildBraindumpContext(dateLabel));
      let parsed = extractActions(answer).actions;
      // Manche Modelle vergessen den Block — EIN strikter Zweitversuch, der ihn erzwingt.
      if (!parsed) {
        const retry = await askAssistant(apiKey, [msg], buildBraindumpContext(dateLabel, true));
        parsed = extractActions(retry).actions;
      }
      if (!parsed) {
        // Auch der Zweitversuch scheiterte → die Roh-Antwort zeigen statt Sackgasse,
        // damit nichts verloren geht (der Nutzer sieht wenigstens die Einschätzung).
        setError(
          `Der Assistent konnte es nicht automatisch sortieren. Seine Antwort:\n\n${extractActions(answer).clean}`,
        );
      } else {
        setActions(parsed);
        setDeselected(new Set());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler.');
    } finally {
      setPending(false);
    }
  };

  const toggle = (key: string) => {
    hapticSelect();
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const apply = async () => {
    if (!actions) return;
    hapticSuccess();
    let tasks = 0;
    let notes = 0;
    for (let i = 0; i < actions.aufgaben.length; i += 1) {
      if (deselected.has(`a${i}`)) continue;
      const a = actions.aufgaben[i];
      await createTask.mutateAsync({ listId: 'default', title: a.titel, dueDate: a.datum ?? null, dueTime: a.zeit ?? null });
      tasks += 1;
    }
    for (let i = 0; i < actions.notizen.length; i += 1) {
      if (deselected.has(`n${i}`)) continue;
      await createNote.mutateAsync({ body: actions.notizen[i] });
      notes += 1;
    }
    const termine = actions.termine.filter((_, i) => !deselected.has(`t${i}`));
    const events = termine.length > 0 ? await createEvents(termine) : 0;
    setActions(null);
    setText('');
    const parts = [
      `${tasks} ${tasks === 1 ? 'Aufgabe' : 'Aufgaben'}`,
      ...(events > 0 ? [`${events} ${events === 1 ? 'Termin' : 'Termine'}`] : []),
      `${notes} ${notes === 1 ? 'Notiz' : 'Notizen'}`,
    ];
    setDone(`${parts.join(', ')} angelegt. Kopf frei.`);
  };

  const selectedCount = actions
    ? actions.aufgaben.length + actions.termine.length + actions.notizen.length - deselected.size
    : 0;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ paddingTop: insets.top + Spacing.sm, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm }}>
              <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
            </PressableScale>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <BrainCircuit size={20} color={colors.teal} strokeWidth={2} />
              <Type variant="heading">Braindump</Type>
            </View>
          </View>
          {/* Diktat: gesprochenes direkt ins Feld (On-Device). */}
          {!pending && (
            <MicButton
              onStart={() => {
                dictBaseRef.current = text;
              }}
              onText={(transcript) =>
                setText((dictBaseRef.current ? `${dictBaseRef.current.trimEnd()} ` : '') + transcript)
              }
              onListeningChange={setDictating}
            />
          )}
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          alwaysBounceVertical
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + Spacing.xl, gap: Spacing.md }}
        >
          <Type variant="caption" tone="text3">
            Kipp alles ab, was im Kopf ist — durcheinander ist okay. Der Assistent macht daraus
            Aufgaben (mit erkannten Daten) und Notizen; du bestätigst, bevor etwas angelegt wird.
          </Type>

          <View style={{ backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: R.lg }}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder={
                dictating
                  ? 'Ich höre zu … sprich einfach los.'
                  : 'Milch kaufen, morgen Zahnarzt anrufen,\nGeschenkidee für Anna: Kochbuch,\nReifen wechseln vor dem Winter…'
              }
              placeholderTextColor={colors.text3}
              textAlignVertical="top"
              accessibilityLabel="Braindump-Text"
              editable={!pending}
              scrollEnabled={false}
              rejectResponderTermination={false}
              {...keyboardDoneProps}
              style={[
                { minHeight: 150, fontSize: T.md + 1, lineHeight: (T.md + 1) * 1.5, color: colors.text, padding: Spacing.md },
                webNoOutline,
              ]}
            />
          </View>

          {apiKey.length === 0 ? (
            <Type variant="caption" tone="text3">
              Für den Braindump brauchst du den Assistenten — Schlüssel unter Einstellungen → Assistent.
            </Type>
          ) : (
            <GlassButton accessibilityLabel="Sortieren lassen" onPress={() => void sort()} disabled={text.trim().length === 0 || pending}>
              <BrainCircuit size={17} color="#FFFFFF" strokeWidth={2.2} />
              <Type variant="label" style={{ color: '#FFFFFF' }}>Sortieren lassen</Type>
            </GlassButton>
          )}

          {pending && <LoadingState label="Assistent sortiert…" />}
          {error && <Type variant="caption" tone="indigo">{error}</Type>}
          {done && <Type variant="label" tone="teal">{done}</Type>}

          {actions && (
            <GlassPanel>
              <Type variant="eyebrow" tone="teal">Vorschläge — antippen wählt ab</Type>
              <View style={{ marginTop: Spacing.sm, gap: 2 }}>
                {actions.aufgaben.map((a, i) => {
                  const off = deselected.has(`a${i}`);
                  return (
                    <PressableScale
                      key={`a${i}`}
                      accessibilityLabel={`Aufgabe ${a.titel} ${off ? 'wieder auswählen' : 'abwählen'}`}
                      onPress={() => toggle(`a${i}`)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 1, opacity: off ? 0.4 : 1 }}
                    >
                      <View style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: off ? colors.border3 : colors.teal, backgroundColor: off ? 'transparent' : colors.teal, alignItems: 'center', justifyContent: 'center' }}>
                        {!off && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Type variant="body" numberOfLines={1}>{a.titel}</Type>
                        {(a.datum || a.zeit) && (
                          <Type variant="caption" tone="text3" tabular>
                            {a.datum ? formatDueDate(a.datum, today) : ''}{a.zeit ? ` · ${a.zeit}` : ''}
                          </Type>
                        )}
                      </View>
                      <Type variant="caption" tone="text3">Aufgabe</Type>
                    </PressableScale>
                  );
                })}
                {actions.termine.map((t, i) => {
                  const off = deselected.has(`t${i}`);
                  return (
                    <PressableScale
                      key={`t${i}`}
                      accessibilityLabel={`Termin ${t.titel} ${off ? 'wieder auswählen' : 'abwählen'}`}
                      onPress={() => toggle(`t${i}`)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 1, opacity: off ? 0.4 : 1 }}
                    >
                      <View style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: off ? colors.border3 : colors.teal, backgroundColor: off ? 'transparent' : colors.teal, alignItems: 'center', justifyContent: 'center' }}>
                        {!off && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Type variant="body" numberOfLines={1}>{t.titel}</Type>
                        <Type variant="caption" tone="text3" tabular>
                          {formatDueDate(t.datum, today)}{t.start ? ` · ${t.start}${t.ende ? `–${t.ende}` : ''}` : ' · ganztägig'}
                        </Type>
                      </View>
                      <Type variant="caption" tone="text3">Termin</Type>
                    </PressableScale>
                  );
                })}
                {actions.notizen.map((n, i) => {
                  const off = deselected.has(`n${i}`);
                  return (
                    <PressableScale
                      key={`n${i}`}
                      accessibilityLabel={`Notiz ${n.split('\n')[0]} ${off ? 'wieder auswählen' : 'abwählen'}`}
                      onPress={() => toggle(`n${i}`)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 1, opacity: off ? 0.4 : 1 }}
                    >
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: off ? colors.border3 : colors.teal, backgroundColor: off ? 'transparent' : colors.teal, alignItems: 'center', justifyContent: 'center' }}>
                        {!off && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Type variant="body" numberOfLines={1}>{n.split('\n')[0]}</Type>
                        {n.includes('\n') && <Type variant="caption" tone="text3" numberOfLines={1}>{n.split('\n').slice(1).join(' · ')}</Type>}
                      </View>
                      <Type variant="caption" tone="text3">Notiz</Type>
                    </PressableScale>
                  );
                })}
              </View>
              <GlassButton
                accessibilityLabel="Auswahl übernehmen"
                onPress={() => void apply()}
                disabled={selectedCount === 0}
                style={{ marginTop: Spacing.md }}
              >
                <Type variant="label" style={{ color: '#FFFFFF' }}>
                  {selectedCount === 1 ? '1 Vorschlag übernehmen' : `${selectedCount} Vorschläge übernehmen`}
                </Type>
              </GlassButton>
            </GlassPanel>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <KeyboardDoneBar />
    </View>
  );
}
