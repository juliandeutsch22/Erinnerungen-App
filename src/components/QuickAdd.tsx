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
//
// Seit v1.53.0 (Stufe 2) kann man in die Zeile auch SPRECHEN (das Diktat füllt
// das Feld, man sieht das Gesagte vor dem Abschicken), Vorschläge einzeln
// abwählen und zurechtrücken — und die Weiche ÜBERSTIMMEN: über den sichtbaren
// Weg-Chip oder, als Abkürzung, mit einem langen Druck auf den Knopf.
import { CalendarDays, Check, Clock, Plus, Repeat, Sparkles, X } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionEditSheet, type EditTarget } from '@/components/ActionEditSheet';
import { Glass } from '@/components/Glass';
import { MicButton } from '@/components/MicButton';
import { OmniResult, omniZeilen } from '@/components/OmniResult';
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
import { type AssistantAction, askAssistant, buildAppContext, extractActions, type ToolData } from '@/lib/assistant';
import { RUN_ZEILE, useAssistantRuns } from '@/lib/assistantRun';
import { formatDueDate, todayStr } from '@/lib/dates';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
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
  /** Abgewählte Vorschläge und der gerade offene Schnell-Editor. */
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<EditTarget | null>(null);
  /** Weiche überstimmt? Gilt für genau diese Eingabe und wird beim Tippen
   *  wieder gelöst — eine dauerhafte Umschaltung wäre ein versteckter Modus,
   *  und Modi loszuwerden war der ganze Punkt. */
  const [ueberstimmt, setUeberstimmt] = useState(false);
  const [diktiert, setDiktiert] = useState(false);
  const diktatBasis = useRef('');
  /** Kurze Quittung an der Stelle, wo eben noch die Karte stand — sonst
   *  verschwindet sie einfach und man muss blind vertrauen. */
  const [quittung, setQuittung] = useState<string | null>(null);
  const quittungTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zeigeQuittung = (text: string) => {
    if (quittungTimer.current) clearTimeout(quittungTimer.current);
    setQuittung(text);
    quittungTimer.current = setTimeout(() => setQuittung(null), 3000);
  };

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
      setDeselected(new Set());
      finishRun(RUN_ZEILE, { clean, actions });
    } catch (e) {
      failRun(RUN_ZEILE, e instanceof Error ? e.message : 'Unbekannter Fehler.');
    }
  };

  const submit = (umkehren = false) => {
    const eingabe = text.trim();
    if (eingabe.length === 0) return;
    const roh = routeInput(eingabe, today, apiKey.length > 0);
    // Überstimmen dreht die Entscheidung — aber nie ins Netz, wenn es gar
    // keinen Schlüssel gibt.
    const nachAssistent = umkehren ? roh.ziel === 'lokal' : roh.ziel === 'assistent';
    const weiche = nachAssistent && apiKey.length > 0 ? { ...roh, ziel: 'assistent' as const } : roh;

    if (weiche.ziel === 'lokal' || !nachAssistent) {
      const aufgabe = roh.ziel === 'lokal' ? roh.aufgabe : parsed;
      // Die im Feld abgewählten Chips gewinnen über den Parser.
      const titel = aufgabe.title || eingabe;
      createTask.mutate({ listId, title: titel, dueDate, dueTime, rrule, tags: aufgabe.tags });
      hapticSuccess();
      setText('');
      setRemoved(NOTHING_REMOVED);
      setUeberstimmt(false);
      // Fokus behalten — nächster Gedanke sofort rein (unter 3 Sekunden).
      inputRef.current?.focus();
      return;
    }

    setText('');
    setRemoved(NOTHING_REMOVED);
    setUeberstimmt(false);
    void frage(eingabe, roh.ziel === 'assistent' ? roh.grund : 'auftrag');
  };

  const toggleZeile = (key: string) => {
    hapticSelect();
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** Schlüssel („a0") → Ziel des Schnell-Editors. */
  const oeffneEditor = (key: string) => {
    hapticSelect();
    const index = Number(key.slice(1));
    if (key.startsWith('a')) setEdit({ kind: 'aufgabe', index });
    else if (key.startsWith('t')) setEdit({ kind: 'termin', index });
    else if (key.startsWith('n')) setEdit({ kind: 'notiz', index });
  };

  const uebernehmen = async () => {
    const actions = run?.status === 'done' ? run.actions : null;
    if (!actions) return;
    hapticSuccess();
    const gewaehlt: AssistantAction = {
      ...actions,
      listen: actions.listen.filter((_, i) => !deselected.has(`l${i}`)),
      aenderungen: actions.aenderungen.filter((_, i) => !deselected.has(`x${i}`)),
      aufgaben: actions.aufgaben.filter((_, i) => !deselected.has(`a${i}`)),
      termine: actions.termine.filter((_, i) => !deselected.has(`t${i}`)),
      notizen: actions.notizen.filter((_, i) => !deselected.has(`n${i}`)),
    };
    let res;
    try {
      res = await applyAssistantActions(gewaehlt, {
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
    setDeselected(new Set());
    const teile = [
      res.projekte > 0 ? `${res.projekte} ${res.projekte === 1 ? 'Projekt' : 'Projekte'}` : '',
      res.aenderungen > 0 ? `${res.aenderungen} ${res.aenderungen === 1 ? 'Änderung' : 'Änderungen'}` : '',
      res.aufgaben > 0 ? `${res.aufgaben} ${res.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}` : '',
      res.termine > 0 ? `${res.termine} ${res.termine === 1 ? 'Termin' : 'Termine'}` : '',
      res.notizen > 0 ? `${res.notizen} ${res.notizen === 1 ? 'Notiz' : 'Notizen'}` : '',
    ].filter(Boolean);
    zeigeQuittung(teile.length > 0 ? `${teile.join(', ')} übernommen.` : 'Nichts zu übernehmen.');
  };

  // Einmal rechnen: der Knopf verrät damit VOR dem Tippen, was passieren wird.
  const weicheJetzt = useMemo(
    () => routeInput(text.trim(), today, apiKey.length > 0),
    [text, today, apiKey],
  );
  // Was der Knopf ZEIGT — inklusive eines etwaigen Überstimmens.
  const gehtLokal = weicheJetzt.ziel === 'lokal';
  const zeigtLokal = ueberstimmt ? !gehtLokal : gehtLokal;
  // Der Chip erscheint nur, wenn es überhaupt eine Wahl gibt: mit Text im Feld
  // und mit Schlüssel. Ohne Schlüssel führt nur ein Weg irgendwohin.
  const zeigtWegChip = text.trim().length > 0 && apiKey.length > 0;

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
          {!run && quittung && (
            <PopIn>
              <Glass
                variant="pill"
                intensity={85}
                style={[Shadow.sm, { alignSelf: 'flex-start' }]}
                contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: Spacing.sm + 2 }}
              >
                <Check size={13} color={colors.teal} strokeWidth={2.6} />
                <Type variant="caption" tone="teal">{quittung}</Type>
              </Glass>
            </PopIn>
          )}
          {run && (
            <PopIn>
              <OmniResult
                run={run}
                grund={grund}
                tasks={tasks ?? []}
                today={today}
                deselected={deselected}
                onToggle={toggleZeile}
                onEdit={oeffneEditor}
                onApply={() => void uebernehmen()}
                onDismiss={() => {
                  clearRun(RUN_ZEILE);
                  setDeselected(new Set());
                }}
              />
            </PopIn>
          )}
          {(chips.length > 0 || zeigtWegChip) && (
            <View style={{ flexDirection: 'row', gap: Spacing.xs, justifyContent: 'flex-start', paddingLeft: Spacing.sm }}>
              {/* Der Weg-Chip sagt SICHTBAR, wohin die Eingabe geht, und ist
                  antippbar. Eine versteckte Geste (langer Druck) wäre in einer
                  App, deren Prämisse „nichts zu lernen" ist, ein Widerspruch:
                  wer sie vergisst, für den gibt es die Funktion nicht mehr. */}
              {zeigtWegChip && (
                <PopIn>
                  <PressableScale
                    accessibilityLabel={
                      zeigtLokal ? 'Stattdessen den Assistenten fragen' : 'Stattdessen als Aufgabe anlegen'
                    }
                    onPress={() => {
                      hapticSelect();
                      setUeberstimmt((v) => !v);
                    }}
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
                      {zeigtLokal ? (
                        <Plus size={12} color={colors.text3} strokeWidth={2.2} />
                      ) : (
                        <Sparkles size={12} color={colors.teal} strokeWidth={2.2} />
                      )}
                      <Type variant="caption" tone={zeigtLokal ? 'text3' : 'teal'}>
                        {zeigtLokal ? 'wird angelegt' : 'geht an den Assistenten'}
                      </Type>
                    </Glass>
                  </PressableScale>
                </PopIn>
              )}
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
                setUeberstimmt(false);
                if (v.length === 0) setRemoved(NOTHING_REMOVED);
              }}
              placeholder={
                diktiert ? 'Ich höre zu …' : apiKey.length > 0 ? 'Was liegt an? Oder frag mich.' : 'Was liegt an?'
              }
              placeholderTextColor={colors.text3}
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={() => submit()}
              accessibilityLabel="Schnell hinzufügen"
              style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: 2 }, webNoOutline]}
            />
            {/* Das Mikrofon bleibt IMMER stehen — auch mit Text im Feld. Sonst
                könnte man nur anfangen zu sprechen, aber nichts nachlegen und
                nichts nachsprechen, wenn die Erkennung daneben lag; genau das
                ist beim Diktieren der häufigste Fall. Das Gesagte wird an den
                vorhandenen Stand angehängt. */}
            <MicButton
              size={30}
              onStart={() => {
                diktatBasis.current = text;
              }}
              onText={(transkript) => setText((diktatBasis.current ? `${diktatBasis.current.trimEnd()} ` : '') + transkript)}
              onListeningChange={setDiktiert}
            />
            {text.trim().length > 0 && (
              <PopIn>
                <PressableScale
                  // Das Symbol verrät VOR dem Tippen, was passieren wird:
                  // Plus = wird angelegt, Funke = der Assistent sieht es an.
                  accessibilityLabel={zeigtLokal ? 'Aufgabe anlegen' : 'An den Assistenten geben'}
                  onPress={() => submit(ueberstimmt)}
                  // Abkürzung für alle, die sie kennen — dieselbe Wirkung wie
                  // der Weg-Chip daneben. Sie kostet keine Fläche und ist NICHT
                  // der einzige Weg; als einziger wäre sie unauffindbar
                  // (v1.53.0/1) und damit falsch.
                  onLongPress={
                    zeigtWegChip
                      ? () => {
                          hapticSelect();
                          setUeberstimmt((v) => !v);
                        }
                      : undefined
                  }
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: R.pill,
                    backgroundColor: colors.teal,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {zeigtLokal ? (
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
      {/* Einen Vorschlag zurechtrücken, ohne ihn abzuwählen und neu zu tippen.
          Derselbe Editor wie im Braindump. */}
      {edit && run?.status === 'done' && run.actions && (
        <ActionEditSheet
          target={edit}
          actions={run.actions}
          lists={lists ?? []}
          onClose={() => setEdit(null)}
          onSave={(next) => finishRun(RUN_ZEILE, { clean: run.clean, actions: next })}
        />
      )}
    </View>
  );
}
