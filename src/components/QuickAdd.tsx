// QuickAdd.tsx — die EINE Zeile („Was liegt an?"), als Glass-Pill über der
// Tab-Bar (Fahrplan §3.4/§4).
//
// Sie war einmal nur eine Schnellerfassung. Seit v1.52.0 ist sie die einzige
// Tür für Text: man tippt hinein, was auch immer man will, und die App findet
// heraus, was es war (lib/inputRoute.ts). Man wählt KEINEN Modus mehr — das
// war die eigentliche Reibung, denn diese Entscheidung kam vor dem Denken.
//
//   „Milch kaufen morgen 10 Uhr"       → sofort angelegt, lokal, ohne Netz
//   „Was steht morgen an?"             → Antwort über der Zeile, kein Chat
//   „Verschieb den Zahnarzt auf Freitag" → Karte, ein Tipp bestätigt
//   drei Zeilen durcheinander          → sortiert wie im Braindump
//
// Die Reihenfolge ist nicht verhandelbar: Der lokale Parser sieht ZUERST hin.
// Ohne Schlüssel bleibt die Zeile deshalb genau so nutzbar wie vorher —
// erkannte Teile als Chips, Return legt an, kein Netz, keine Wartezeit.
import { CalendarDays, Clock, Plus, Repeat, Sparkles, X } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { OmniResult } from '@/components/OmniResult';
import { PopIn } from '@/components/PopIn';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { LIST_COLORS } from '@/components/listMeta';
import { useCreateAssistantEvents } from '@/data/calendarQueries';
import { useCreateNote, useNotes } from '@/data/noteQueries';
import { useCompleteTask, useCreateList, useCreateTask, useDeleteTask, useLists, useTasks, useUpdateTask } from '@/data/queries';
import { DEFAULT_LIST_ID } from '@/data/ListRepository';
import type { ChatMessage } from '@/data/types';
import type { DeviceEvent } from '@/lib/deviceCalendar';
import { applyAssistantActions } from '@/lib/applyActions';
import { askAssistant, buildAppContext, extractActions, type ToolData } from '@/lib/assistant';
import { RUN_ZEILE, useAssistantRuns } from '@/lib/assistantRun';
import { formatDueDate, todayStr } from '@/lib/dates';
import { hapticSuccess } from '@/lib/haptics';
import { routeInput, type AssistentGrund } from '@/lib/inputRoute';
import { parseQuickAdd } from '@/lib/quickAddParser';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { useSettings } from '@/theme/settings.store';
import { MAX_CONTENT_WIDTH, TAB_BAR_HEIGHT, webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Shadow, Spacing, T } from '@/theme/theme.tokens';

const RRULE_LABEL: Record<string, string> = {
  daily: 'Täglich',
  weekdays: 'Werktags',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
};

type Removed = { date: boolean; time: boolean; rrule: boolean };
const NOTHING_REMOVED: Removed = { date: false, time: false, rrule: false };

export function QuickAdd({
  listId = DEFAULT_LIST_ID,
  /** Termine des Geräts für den App-Überblick — „Heute" hat sie ohnehin
   *  geladen, deshalb werden sie hereingereicht statt hier neu geholt. */
  events = [],
  calendarDenied = false,
}: {
  listId?: string;
  events?: DeviceEvent[];
  calendarDenied?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const createTask = useCreateTask();
  const createList = useCreateList();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const createNote = useCreateNote();
  const createEvents = useCreateAssistantEvents();
  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const { data: notes } = useNotes();

  const apiKey = useSettings((s) => s.geminiApiKey);
  const memory = useSettings((s) => s.assistantMemory);
  const contextEnabled = useSettings((s) => s.assistantContextEnabled);

  const run = useAssistantRuns((s) => s.runs[RUN_ZEILE]);
  const beginRun = useAssistantRuns((s) => s.begin);
  const deltaRun = useAssistantRuns((s) => s.delta);
  const finishRun = useAssistantRuns((s) => s.finish);
  const failRun = useAssistantRuns((s) => s.fail);
  const clearRun = useAssistantRuns((s) => s.clear);
  const [grund, setGrund] = useState<AssistentGrund>('auftrag');

  const [text, setText] = useState('');
  const [removed, setRemoved] = useState<Removed>(NOTHING_REMOVED);

  const today = todayStr();
  const parsed = useMemo(() => parseQuickAdd(text, today), [text, today]);
  const dueDate = removed.date ? null : parsed.dueDate;
  const dueTime = removed.date || removed.time ? null : parsed.dueTime;
  const rrule = removed.date || removed.rrule ? null : parsed.rrule;

  /** Der Weg an den Assistenten. Der Lauf lebt im Store, überlebt also das
   *  Wegtippen und einen Bildschirmwechsel. */
  const frage = async (eingabe: string, warum: AssistentGrund) => {
    setGrund(warum);
    beginRun(RUN_ZEILE, 'Zeile', eingabe);
    try {
      const kontext = contextEnabled
        ? buildAppContext({ events, tasks: tasks ?? [], lists: lists ?? [], notes: notes ?? [], today, calendarDenied })
        : null;
      // Werkzeuge am SELBEN Schalter wie der Überblick — wer ihn ausschaltet,
      // will nicht, dass stattdessen nachgeschlagen wird.
      const toolData: ToolData | null = contextEnabled
        ? { tasks: tasks ?? [], lists: lists ?? [], notes: notes ?? [], today }
        : null;
      const msg: ChatMessage = {
        id: 'zeile', chatId: 'zeile', role: 'user', content: eingabe, createdAt: new Date().toISOString(),
      };
      const antwort = await askAssistant(apiKey, [msg], kontext, memory, {
        toolData,
        onDelta: (d) => deltaRun(RUN_ZEILE, d),
      });
      const { clean, actions } = extractActions(antwort);
      finishRun(RUN_ZEILE, { clean, actions });
    } catch (e) {
      failRun(RUN_ZEILE, e instanceof Error ? e.message : 'Unbekannter Fehler.');
    }
  };

  const submit = () => {
    const eingabe = text.trim();
    if (eingabe.length === 0) return;
    const weiche = routeInput(eingabe, today, apiKey.length > 0);

    if (weiche.ziel === 'lokal') {
      // Die im Feld abgewählten Chips gewinnen über den Parser.
      createTask.mutate({ listId, title: weiche.aufgabe.title, dueDate, dueTime, rrule, tags: weiche.aufgabe.tags });
      hapticSuccess();
      setText('');
      setRemoved(NOTHING_REMOVED);
      // Fokus behalten — nächster Gedanke sofort rein (unter 3 Sekunden).
      inputRef.current?.focus();
      return;
    }

    setText('');
    setRemoved(NOTHING_REMOVED);
    void frage(eingabe, weiche.grund);
  };

  const uebernehmen = async () => {
    const actions = run?.status === 'done' ? run.actions : null;
    if (!actions) return;
    hapticSuccess();
    try {
      await applyAssistantActions(actions, {
        lists: lists ?? [],
        tasks: tasks ?? [],
        today,
        createList: (input) => createList.mutateAsync(input),
        createTask: (input) => createTask.mutateAsync(input),
        createNote: (body) => createNote.mutateAsync({ body }),
        updateTask: (id, patch) => updateTask.mutateAsync({ id, patch }),
        completeTask: (t) => completeTask.mutateAsync(t),
        trashTask: (id) => deleteTask.mutateAsync(id),
        createEvents: (termine) => createEvents(termine),
        colorAt: (i) => LIST_COLORS[i % LIST_COLORS.length],
      });
    } catch (e) {
      failRun(RUN_ZEILE, `Konnte es nicht anlegen: ${e instanceof Error ? e.message : 'Unbekannter Fehler.'}`);
      return;
    }
    clearRun(RUN_ZEILE);
  };

  // Einmal rechnen: der Knopf verrät damit VOR dem Tippen, was passieren wird.
  const weicheJetzt = useMemo(
    () => routeInput(text.trim(), today, apiKey.length > 0),
    [text, today, apiKey],
  );
  const gehtLokal = weicheJetzt.ziel === 'lokal';

  const chips: { key: keyof Removed; icon: typeof Clock; label: string }[] = [];
  if (dueDate) chips.push({ key: 'date', icon: CalendarDays, label: formatDueDate(dueDate, today) });
  if (dueTime) chips.push({ key: 'time', icon: Clock, label: dueTime });
  if (rrule) chips.push({ key: 'rrule', icon: Repeat, label: RRULE_LABEL[rrule] ?? 'Wiederholung' });

  // Tastatur: gemessene Höhe statt KeyboardAvoidingView (bei position:absolute
  // unzuverlässig — die Pill wanderte an unlogische Stellen). Tastatur offen →
  // Pill sitzt direkt darüber; zu → über der schwebenden Tab-Bar.
  const keyboard = useKeyboardHeight();
  const restingBottom = Math.max(insets.bottom, Spacing.md) + TAB_BAR_HEIGHT + Spacing.sm;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <View
        pointerEvents="box-none"
        style={{
          alignItems: 'center',
          paddingHorizontal: Spacing.lg,
          paddingBottom: keyboard > 0 ? keyboard + Spacing.sm : restingBottom,
        }}
      >
        <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: Spacing.xs }}>
          {run && (
            <PopIn>
              <OmniResult
                run={run}
                grund={grund}
                tasks={tasks ?? []}
                today={today}
                onApply={() => void uebernehmen()}
                onDismiss={() => clearRun(RUN_ZEILE)}
              />
            </PopIn>
          )}
          {chips.length > 0 && (
            <View style={{ flexDirection: 'row', gap: Spacing.xs, justifyContent: 'flex-start', paddingLeft: Spacing.sm }}>
              {chips.map((c) => (
                <PopIn key={c.key}>
                  <PressableScale
                    accessibilityLabel={`${c.label} entfernen`}
                    onPress={() => setRemoved((r) => ({ ...r, [c.key]: true }))}
                  >
                    <Glass
                      variant="pill"
                      style={Shadow.sm}
                      contentStyle={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: Spacing.xs,
                        paddingVertical: 6,
                        paddingHorizontal: Spacing.sm + 2,
                      }}
                    >
                      <c.icon size={12} color={colors.teal} strokeWidth={2.2} />
                      <Type variant="caption" tone="teal">{c.label}</Type>
                      <X size={11} color={colors.text3} strokeWidth={2.2} />
                    </Glass>
                  </PressableScale>
                </PopIn>
              ))}
            </View>
          )}
          <Glass
            variant="pill"
            intensity={85}
            style={Shadow.md}
            contentStyle={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              paddingVertical: Spacing.sm + 2,
              paddingHorizontal: Spacing.md,
            }}
          >
            <Plus size={18} color={colors.text3} strokeWidth={2.2} />
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (v.length === 0) setRemoved(NOTHING_REMOVED);
              }}
              placeholder={apiKey.length > 0 ? 'Was liegt an? Oder frag mich.' : 'Was liegt an?'}
              placeholderTextColor={colors.text3}
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={submit}
              accessibilityLabel="Schnell hinzufügen"
              style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: 2 }, webNoOutline]}
            />
            {text.trim().length > 0 && (
              <PopIn>
                <PressableScale
                  // Das Symbol verrät VOR dem Tippen, was passieren wird:
                  // Plus = wird angelegt, Funke = der Assistent sieht es an.
                  accessibilityLabel={gehtLokal ? 'Aufgabe anlegen' : 'An den Assistenten geben'}
                  onPress={submit}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: R.pill,
                    backgroundColor: colors.teal,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {gehtLokal ? (
                    <Plus size={17} color="#FFFFFF" strokeWidth={2.6} />
                  ) : (
                    <Sparkles size={16} color="#FFFFFF" strokeWidth={2.4} />
                  )}
                </PressableScale>
              </PopIn>
            )}
          </Glass>
        </View>
      </View>
    </View>
  );
}
