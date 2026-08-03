// verwalter.tsx — „Die Woche ansehen". Der einzige Ort in der App, an dem die
// Arbeit VOR dir liegt statt hinter dir: ein Tipp, und der Assistent legt einen
// Entwurf für die kommende Woche vor — ein paar ruhige Zeilen plus konkrete
// Vorschläge, die du einzeln abwählen und mit einem Tipp übernehmen kannst.
//
// Bewusst KEIN Chat: einmal fragen, Entwurf lesen, bestätigen, fertig. Und
// bewusst keine Zahlen — die Leitplanke steht im Prompt (lib/verwalter.ts).
import { useRouter } from 'expo-router';
import { CalendarDays, Check, ChevronLeft, Sparkles } from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Backdrop } from '@/components/Backdrop';
import { GlassButton } from '@/components/GlassButton';
import { GlassPanel } from '@/components/GlassPanel';
import { LIST_COLORS } from '@/components/listMeta';
import { MarkdownText } from '@/components/MarkdownText';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { SchluesselWeg } from '@/components/SchluesselWeg';
import { Screen } from '@/components/Screen';
import { Type } from '@/components/Type';
import { useCreateAssistantEvents, useDeviceEvents } from '@/data/calendarQueries';
import { useToggleEventPerson } from '@/data/eventPersonQueries';
import { useCreatePerson, usePeople } from '@/data/personQueries';
import { useCreateNote } from '@/data/noteQueries';
import { useCompleteTask, useCreateList, useCreateTask, useDeleteTask, useLists, useTasks, useUpdateTask } from '@/data/queries';
import type { ChatMessage } from '@/data/types';
import { applyAssistantActions } from '@/lib/applyActions';
import { RUN_VERWALTER, useAssistantRuns } from '@/lib/assistantRun';
import {
  askAssistant,
  buildAppContext,
  describeAenderung,
  describeExtras,
  describeSchritte,
  extractActions,
  resolveTaskHandle,
  type AssistantAction,
  type ToolData,
} from '@/lib/assistant';
import { addDays, formatDueDate, todayStr } from '@/lib/dates';
import { hasCalendarPermission } from '@/lib/deviceCalendar';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { buildWeekPlanContext, weekWindow } from '@/lib/verwalter';
import { useColors } from '@/theme/ThemeProvider';
import { useSettings } from '@/theme/settings.store';
import { Spacing } from '@/theme/theme.tokens';

export default function VerwalterScreen() {
  const colors = useColors();
  const router = useRouter();
  const today = todayStr();
  const apiKey = useSettings((s) => s.geminiApiKey);
  const memory = useSettings((s) => s.assistantMemory);

  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const { data: people } = usePeople();
  const createPerson = useCreatePerson();
  const linkEventPerson = useToggleEventPerson();
  const [calGranted, setCalGranted] = useState(false);
  React.useEffect(() => {
    void hasCalendarPermission().then(setCalGranted);
  }, []);
  const { data: events } = useDeviceEvents(today, addDays(today, 14), calGranted);

  const createTask = useCreateTask();
  const createList = useCreateList();
  const createNote = useCreateNote();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const createEvents = useCreateAssistantEvents();

  // Der Lauf lebt im Store — der Entwurf ueberlebt es, wenn man zwischendurch
  // woanders hingeht (siehe lib/assistantRun.ts).
  const run = useAssistantRuns((s2) => s2.runs[RUN_VERWALTER]);
  const beginRun = useAssistantRuns((s2) => s2.begin);
  const deltaRun = useAssistantRuns((s2) => s2.delta);
  const finishRun = useAssistantRuns((s2) => s2.finish);
  const failRun = useAssistantRuns((s2) => s2.fail);
  const clearRun = useAssistantRuns((s2) => s2.clear);
  const pending = run?.status === 'running';
  const stream = run?.stream ?? '';
  const text = run?.status === 'done' ? run.clean : null;
  const actions = run?.status === 'done' ? run.actions : null;
  const error = run?.status === 'error' ? run.error : null;
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<string | null>(null);

  const ansehen = async () => {
    if (pending) return;
    setDone(null);
    beginRun(RUN_VERWALTER, 'Die Woche');
    try {
      const appContext = buildAppContext({
        events: events ?? [],
        tasks: tasks ?? [],
        lists: lists ?? [],
        notes: [],
        people: people ?? [],
        today,
        calendarDenied: !calGranted,
      });
      const msg: ChatMessage = {
        id: 'woche',
        chatId: 'woche',
        role: 'user',
        content: 'Sieh dir bitte meine kommende Woche an.',
        createdAt: new Date().toISOString(),
      };
      // Werkzeuge sind hier ausdrücklich erlaubt: Der Verwalter soll in ein
      // Projekt hineinsehen dürfen, statt aus dem gekappten Überblick zu raten.
      const toolData: ToolData = { tasks: tasks ?? [], lists: lists ?? [], notes: [], today };
      const answer = await askAssistant(apiKey, [msg], [buildWeekPlanContext(today), appContext].join('\n\n'), memory, {
        toolData,
        onDelta: (delta) => deltaRun(RUN_VERWALTER, delta),
      });
      const { clean, actions: parsed } = extractActions(answer);
      finishRun(RUN_VERWALTER, { clean, actions: parsed });
      setDeselected(new Set());
    } catch (e) {
      failRun(RUN_VERWALTER, e instanceof Error ? e.message : 'Unbekannter Fehler.');
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

  const uebernehmen = async () => {
    if (!actions) return;
    hapticSuccess();
    const gewaehlt: AssistantAction = {
      ...actions,
      aenderungen: actions.aenderungen.filter((_, i) => !deselected.has(`x${i}`)),
      aufgaben: actions.aufgaben.filter((_, i) => !deselected.has(`a${i}`)),
      termine: actions.termine.filter((_, i) => !deselected.has(`t${i}`)),
      notizen: actions.notizen.filter((_, i) => !deselected.has(`n${i}`)),
      listen: actions.listen.filter((_, i) => !deselected.has(`l${i}`)),
    };
    // Scheitert eine Mutation, MUSS das sichtbar werden — sonst tut der Knopf
    // scheinbar nichts und niemand erfährt, warum.
    let res;
    try {
    res = await applyAssistantActions(gewaehlt, {
        lists: lists ?? [],
        tasks: tasks ?? [],
        today,
        people: people ?? [],
        createList: (input) => createList.mutateAsync(input),
        createPerson: (input) => createPerson.mutateAsync(input),
        createTask: (input) => createTask.mutateAsync(input),
        createNote: (body) => createNote.mutateAsync({ body }),
        updateTask: (id, patch) => updateTask.mutateAsync({ id, patch }),
        completeTask: (t) => completeTask.mutateAsync(t),
        trashTask: (id) => deleteTask.mutateAsync(id),
        createEvents: (termine) => createEvents(termine),
        linkEventPerson: (eventId, personId) => linkEventPerson.mutateAsync({ eventId, personId, dran: false }),
        colorAt: (i) => LIST_COLORS[i % LIST_COLORS.length],
      });
    } catch (e) {
      failRun(RUN_VERWALTER, `Konnte es nicht übernehmen: ${e instanceof Error ? e.message : 'Unbekannter Fehler.'}`);
      return;
    }
    const teile = [
      res.aenderungen > 0 ? `${res.aenderungen} ${res.aenderungen === 1 ? 'Änderung' : 'Änderungen'}` : '',
      res.aufgaben > 0 ? `${res.aufgaben} ${res.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}` : '',
      res.termine > 0 ? `${res.termine} ${res.termine === 1 ? 'Termin' : 'Termine'}` : '',
      res.notizen > 0 ? `${res.notizen} ${res.notizen === 1 ? 'Notiz' : 'Notizen'}` : '',
    ].filter(Boolean);
    clearRun(RUN_VERWALTER);
    setDone(teile.length > 0 ? `${teile.join(', ')} übernommen. Die Woche steht.` : 'Nichts übernommen.');
  };

  const anzahl = actions
    ? actions.aenderungen.length + actions.aufgaben.length + actions.termine.length + actions.notizen.length + actions.listen.length - deselected.size
    : 0;

  /** Eine Vorschlagszeile — dieselbe Grammatik wie im Braindump. */
  const zeile = (key: string, titel: string, unter: string | null) => {
    const off = deselected.has(key);
    return (
      <PressableScale
        key={key}
        accessibilityLabel={`${titel} ${off ? 'wieder auswählen' : 'abwählen'}`}
        onPress={() => toggle(key)}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.xs + 1, opacity: off ? 0.4 : 1 }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            marginTop: 2,
            borderRadius: 5,
            borderWidth: 1.5,
            borderColor: off ? colors.border3 : colors.teal,
            backgroundColor: off ? 'transparent' : colors.teal,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!off && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
        </View>
        <View style={{ flex: 1 }}>
          <Type variant="body" numberOfLines={2}>{titel}</Type>
          {unter && <Type variant="caption" tone="text3" numberOfLines={2}>{unter}</Type>}
        </View>
      </PressableScale>
    );
  };

  const { label } = weekWindow(today);

  return (
    <Screen withTabBar={false}>
      <Backdrop columns={false} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm }}>
        <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm, marginLeft: -Spacing.sm }}>
          <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
        </PressableScale>
        <CalendarDays size={20} color={colors.teal} strokeWidth={2} />
        <Type variant="heading">Die Woche</Type>
      </View>

      <Reveal>
        <Type variant="caption" tone="text3">{label}</Type>
      </Reveal>

      {apiKey.length === 0 ? (
        <Reveal delay={40}>
          <View style={{ marginTop: Spacing.md }}>
            <Type variant="caption" tone="text3">
              Dafür brauchst du den Assistenten. Er nutzt deinen eigenen Google-Schlüssel und bleibt
              aus, bis du einen hinterlegst.
            </Type>
            {/* Die letzte Stelle, die die Wege-Runde (§8.56) übersehen hat: hier
                stand ein Verweis auf die Einstellungen ohne Weg dorthin. */}
            <SchluesselWeg />
          </View>
        </Reveal>
      ) : (
        <>
          {!actions && !text && (
            <Reveal delay={40}>
              <Type variant="body" tone="text2" style={{ marginTop: Spacing.md }}>
                Der Assistent sieht sich deine Termine, offenen Aufgaben und Projekt-Deadlines an und
                sagt dir, wo es eng wird. Was er vorschlägt, wählst du einzeln ab oder übernimmst mit
                einem Tipp — von allein passiert nichts.
              </Type>
              <GlassButton accessibilityLabel="Die Woche ansehen" onPress={() => void ansehen()} disabled={pending} style={{ marginTop: Spacing.lg }}>
                <Sparkles size={17} color="#FFFFFF" strokeWidth={2.2} />
                <Type variant="label" style={{ color: '#FFFFFF' }}>Die Woche ansehen</Type>
              </GlassButton>
            </Reveal>
          )}

          {pending && (
            <View style={{ marginTop: Spacing.lg }}>
              <Type variant="body" tone="text2">
                {stream.split('```')[0].trim() || 'Einen Moment — ich sehe mir die Woche an.'}
              </Type>
            </View>
          )}

          {text && !pending && (
            <Reveal delay={40}>
              <GlassPanel style={{ marginTop: Spacing.md }}>
                <MarkdownText markdown={text} />
              </GlassPanel>
            </Reveal>
          )}

          {actions && !pending && (
            <Reveal delay={80}>
              <GlassPanel style={{ marginTop: Spacing.md }}>
                <Type variant="eyebrow" tone="teal">Vorschläge — antippen wählt ab</Type>
                <View style={{ marginTop: Spacing.sm, gap: 2 }}>
                  {actions.aenderungen.map((c, i) => {
                    const t = resolveTaskHandle(c.handle, tasks ?? []);
                    return zeile(
                      `x${i}`,
                      t ? t.title : 'Unbekannte Aufgabe',
                      t ? describeAenderung(c, (d) => formatDueDate(d, today)) : 'Nicht mehr gefunden — wird übersprungen',
                    );
                  })}
                  {actions.listen.map((l, i) => zeile(`l${i}`, l.name, 'Neues Projekt'))}
                  {actions.aufgaben.map((a, i) =>
                    zeile(
                      `a${i}`,
                      a.titel,
                      [
                        a.datum ? formatDueDate(a.datum, today) : '',
                        describeSchritte(a.schritte) ?? '',
                        describeExtras(a) ?? '',
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Neue Aufgabe',
                    ),
                  )}
                  {actions.termine.map((t, i) =>
                    zeile(`t${i}`, t.titel, `Termin · ${formatDueDate(t.datum, today)}${t.start ? ` · ${t.start} Uhr` : ''}`),
                  )}
                  {actions.notizen.map((n, i) => zeile(`n${i}`, n.split('\n')[0], 'Notiz'))}
                </View>
                <GlassButton
                  accessibilityLabel="Auswahl übernehmen"
                  onPress={() => void uebernehmen()}
                  disabled={anzahl === 0}
                  style={{ marginTop: Spacing.md }}
                >
                  <Check size={17} color="#FFFFFF" strokeWidth={2.4} />
                  <Type variant="label" style={{ color: '#FFFFFF' }}>
                    {anzahl === 1 ? '1 übernehmen' : `${anzahl} übernehmen`}
                  </Type>
                </GlassButton>
              </GlassPanel>
            </Reveal>
          )}

          {done && (
            <Reveal delay={40}>
              <Type variant="label" tone="teal" style={{ marginTop: Spacing.md }}>{done}</Type>
            </Reveal>
          )}

          {error && (
            <Reveal delay={40}>
              <Type variant="body" tone="text2" style={{ marginTop: Spacing.md }}>{error}</Type>
            </Reveal>
          )}
        </>
      )}
    </Screen>
  );
}
