// QuickVoiceSheet.tsx — Sprach-Schnellzugriff für „muss schnell gehen"-Momente.
// Steigt als Sheet über „Heute" auf, hört SOFORT zu, und sobald du eine
// Sprechpause machst, geht das Gesagte automatisch an den Assistenten — KEIN
// Senden-Knopf. Zurück kommen die erkannten Aufgaben/Notizen als abwählbare
// Liste; EIN Tipp auf „Übernehmen" legt sie an. Danach kannst du weitersprechen
// (das Neue kommt hinzu) oder einzelne Vorschläge abwählen. Es wird KEIN Chat
// angelegt — rein, erfasst, fertig.
//
// Aufbau: QuickVoiceView ist rein präsentativ (pro Zustand ein Bild, im Web
// screenshot-bar); QuickVoiceSheet hält Zustand + Diktat + Assistent und rendert
// die View im (absturzsicheren) BottomSheet.
//
// Gleicher Stand wie Braindump und Chat: der Lauf lebt im Store
// (lib/assistantRun.ts), überlebt also das Schließen des Sheets; Vorschläge
// lassen sich vor dem Übernehmen zurechtrücken (ActionEditSheet); angewendet
// wird zentral über lib/applyActions. Bilder gibt es hier bewusst NICHT — man
// fotografiert nicht, während man spricht.
import { CalendarDays, Check, Mic, RotateCcw, Sparkles } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { ActionEditSheet, type EditTarget } from '@/components/ActionEditSheet';
import { BottomSheet } from '@/components/BottomSheet';
import { SchluesselWeg } from '@/components/SchluesselWeg';
import { betrifftSchluessel } from '@/lib/schluessel';
import { GlassButton } from '@/components/GlassButton';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useCreateAssistantEvents } from '@/data/calendarQueries';
import { useCreateNote } from '@/data/noteQueries';
import { useCompleteTask, useCreateList, useCreateTask, useDeleteTask, useLists, useUpdateTask } from '@/data/queries';
import type { ChatMessage } from '@/data/types';
import { type AssistantAction, askAssistant, buildBraindumpContext, describeExtras, describeSchritte, extractActions, hasCapturableActions, ortZusatz } from '@/lib/assistant';
import { applyAssistantActions } from '@/lib/applyActions';
import { RUN_QUICKVOICE, useAssistantRuns } from '@/lib/assistantRun';
import { formatDueDate, parseDateStr, todayStr } from '@/lib/dates';
import { useDictation } from '@/lib/dictation';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { useColors, useReducedMotion } from '@/theme/ThemeProvider';
import { useSettings } from '@/theme/settings.store';
import { LIST_COLORS } from '@/components/listMeta';
import { Spacing } from '@/theme/theme.tokens';

export type QuickVoicePhase = 'listening' | 'thinking' | 'result' | 'error' | 'done';

/** Großer, ruhig atmender Mikrofon-Kreis. Tippen beendet die Aufnahme früher
 *  bzw. startet (im Ergebnis) eine neue Äußerung. */
function MicOrb({ active, label, onPress }: { active: boolean; label: string; onPress?: () => void }) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (active && !reduced) {
      pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    } else {
      pulse.value = 0;
    }
  }, [active, reduced, pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: (1 - pulse.value) * 0.35, transform: [{ scale: 1 + pulse.value * 0.7 }] }));

  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} style={{ alignSelf: 'center', width: 104, height: 104, alignItems: 'center', justifyContent: 'center' }}>
      {active && !reduced && (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 104, height: 104, borderRadius: 52, backgroundColor: colors.teal }, ring]} />
      )}
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 42,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? `${colors.teal}26` : colors.bg2,
        }}
      >
        <Mic size={34} color={active ? colors.teal : colors.text3} strokeWidth={2} />
      </View>
    </PressableScale>
  );
}

/** Reine Darstellung eines Zustands — ohne Diktat/Assistent, damit im Web pro
 *  Zustand ein Screenshot entstehen kann. */
export function QuickVoiceView({
  phase,
  interim,
  transcript,
  stream = '',
  actions,
  deselected,
  error,
  summary,
  today,
  denied = false,
  hasEvents = false,
  onToggleItem,
  onEditItem,
  onSpeakAgain,
  onSpeakFresh,
  onOpenSettings,
  onOpenCalendar,
  onSchluesselWeg,
}: {
  phase: QuickVoicePhase;
  interim: string;
  transcript: string;
  /** Laufende Assistenten-Antwort (Streaming) — macht das Warten lebendig. */
  stream?: string;
  actions: AssistantAction | null;
  deselected: Set<string>;
  error: string | null;
  summary: string;
  today: string;
  /** Mikrofon-Berechtigung verweigert → ruhiger Hinweis statt endlosem „hört zu". */
  denied?: boolean;
  /** Im Ergebnis wurden Termine angelegt → „Im Kalender ansehen" anbieten. */
  hasEvents?: boolean;
  onToggleItem?: (key: string) => void;
  /** Auf den Text tippen rückt den Vorschlag zurecht (Projekte ausgenommen). */
  onEditItem?: (key: string) => void;
  /** Ergänzen (anhängen) — auch: Aufnahme früher beenden, Fehler erneut. */
  onSpeakAgain?: () => void;
  /** Neu — verwirft das Erkannte und hört frisch zu. */
  onSpeakFresh?: () => void;
  onOpenSettings?: () => void;
  onOpenCalendar?: () => void;
  /** Das Sheet schließen, bevor der Schlüssel-Weg woandershin führt — ein
   *  offenes RN-Modal bliebe sonst über dem neuen Bildschirm stehen. */
  onSchluesselWeg?: () => void;
}) {
  const colors = useColors();

  if (phase === 'listening' && denied) {
    return (
      <View style={{ gap: Spacing.md, paddingVertical: Spacing.lg, alignItems: 'center' }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' }}>
          <Mic size={34} color={colors.text3} strokeWidth={2} />
        </View>
        <Type variant="eyebrow" tone="text3">Mikrofon nötig</Type>
        <Type variant="body" tone="text2" style={{ textAlign: 'center' }}>
          Für den Sprach-Schnellzugriff braucht Stoa Zugriff aufs Mikrofon. Du kannst ihn in den Einstellungen erlauben.
        </Type>
        <GlassButton accessibilityLabel="Einstellungen öffnen" onPress={onOpenSettings}>
          <Type variant="label" style={{ color: '#FFFFFF' }}>Einstellungen öffnen</Type>
        </GlassButton>
      </View>
    );
  }

  if (phase === 'listening') {
    const heard = interim.trim();
    return (
      <View style={{ gap: Spacing.lg, paddingVertical: Spacing.md, alignItems: 'center' }}>
        <MicOrb active label="Aufnahme beenden" onPress={onSpeakAgain} />
        <Type variant="eyebrow" tone="teal">Ich höre zu</Type>
        <Type variant="body" tone={heard ? 'text' : 'text3'} style={{ textAlign: 'center', minHeight: 48 }}>
          {heard || 'Sprich einfach los — „Zahnarzt morgen 10 Uhr".'}
        </Type>
        <Type variant="caption" tone="text3" style={{ textAlign: 'center' }}>
          Eine kurze Pause beendet die Aufnahme automatisch.
        </Type>
      </View>
    );
  }

  if (phase === 'thinking') {
    // Sobald der Assistent zu schreiben beginnt, treten seine Worte an die
    // Stelle des Gehörten — dieselbe Wartezeit fühlt sich viel kürzer an.
    const leading = stream.split('```')[0].trim();
    return (
      <View style={{ gap: Spacing.md, paddingVertical: Spacing.lg, alignItems: 'center' }}>
        <MicOrb active={false} label="Assistent denkt nach" />
        <Type variant="eyebrow" tone="text3">Einen Moment</Type>
        {leading.length > 0 ? (
          <Type variant="body" tone="text" style={{ textAlign: 'center' }}>{leading}</Type>
        ) : (
          transcript.trim().length > 0 && (
            <Type variant="body" tone="text2" style={{ textAlign: 'center' }}>
              „{transcript.trim()}"
            </Type>
          )
        )}
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={{ gap: Spacing.md, paddingVertical: Spacing.xl, alignItems: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.teal}26`, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={30} color={colors.teal} strokeWidth={2.4} />
        </View>
        <Type variant="body" tone="text" style={{ textAlign: 'center' }}>{summary}</Type>
        {hasEvents && (
          <PressableScale
            accessibilityLabel="Im Kalender ansehen"
            onPress={onOpenCalendar}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.xs }}
          >
            <CalendarDays size={15} color={colors.teal} strokeWidth={2} />
            <Type variant="label" tone="teal">Im Kalender ansehen</Type>
          </PressableScale>
        )}
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={{ gap: Spacing.md, paddingVertical: Spacing.md }}>
        <Type variant="caption" tone="indigo">{error ?? 'Das hat nicht geklappt.'}</Type>
        {/* Beim Schlüssel hilft „noch einmal sprechen" nicht — nur der Weg dorthin. */}
        {betrifftSchluessel(error) && <SchluesselWeg onWeg={onSchluesselWeg} />}
        <GlassButton accessibilityLabel="Noch einmal sprechen" onPress={onSpeakAgain}>
          <Mic size={17} color="#FFFFFF" strokeWidth={2.2} />
          <Type variant="label" style={{ color: '#FFFFFF' }}>Noch einmal sprechen</Type>
        </GlassButton>
      </View>
    );
  }

  // result
  const items: { key: string; title: string; sub?: string; kind: 'Aufgabe' | 'Termin' | 'Notiz' | 'Projekt'; editable: boolean }[] = [
    ...(actions?.listen ?? []).map((l, i) => ({
      key: `l${i}`,
      title: l.name,
      sub: [l.ziel ?? '', l.deadline ? `bis ${formatDueDate(l.deadline, today)}` : ''].filter(Boolean).join(' · ') || undefined,
      kind: 'Projekt' as const,
      // Ein Projekt ist das Dach, kein Einzelvorschlag — dafür gibt es keinen
      // Schnell-Editor; abwählen genügt.
      editable: false,
    })),
    ...(actions?.aufgaben ?? []).map((a, i) => ({
      key: `a${i}`,
      title: a.titel,
      // Datum/Zeit und — wenn der Assistent eine Liste vorschlägt — auch das
      // Ziel zeigen: du siehst vor dem Bestätigen, wo es landet.
      sub:
        [a.datum ? formatDueDate(a.datum, today) : '', a.zeit ?? '', a.liste ? `→ ${a.liste}` : '', describeSchritte(a.schritte) ?? '', describeExtras(a) ?? '']
          .filter(Boolean)
          .join(' · ') || undefined,
      kind: 'Aufgabe' as const,
      editable: true,
    })),
    ...(actions?.termine ?? []).map((t, i) => ({
      key: `t${i}`,
      title: t.titel,
      sub: `${formatDueDate(t.datum, today)}${t.start ? ` · ${t.start}${t.ende ? `–${t.ende}` : ''}` : ' · ganztägig'}${ortZusatz(t)}`,
      kind: 'Termin' as const,
      editable: true,
    })),
    ...(actions?.notizen ?? []).map((n, i) => ({ key: `n${i}`, title: n.split('\n')[0], kind: 'Notiz' as const, editable: true })),
  ];

  return (
    <View style={{ gap: Spacing.sm }}>
      {transcript.trim().length > 0 && (
        <Type variant="body" tone="text3" style={{ fontStyle: 'italic' }}>„{transcript.trim()}"</Type>
      )}
      <Type variant="eyebrow" tone="teal">Erkannt — Kästchen wählt ab, Text ändert</Type>
      <View style={{ gap: 2 }}>
        {items.map((it) => {
          const off = deselected.has(it.key);
          const round = it.kind === 'Notiz';
          const zeile = (
            <>
              <Type variant="body" numberOfLines={1}>{it.title}</Type>
              {it.sub && <Type variant="caption" tone="text3" tabular>{it.sub}</Type>}
            </>
          );
          return (
            <View
              key={it.key}
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 1, opacity: off ? 0.4 : 1 }}
            >
              <PressableScale
                accessibilityLabel={`${it.kind} ${it.title} ${off ? 'wieder auswählen' : 'abwählen'}`}
                onPress={() => onToggleItem?.(it.key)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: round ? 9 : 5,
                  borderWidth: 1.5,
                  borderColor: off ? colors.border3 : colors.teal,
                  backgroundColor: off ? 'transparent' : colors.teal,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!off && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </PressableScale>
              {it.editable ? (
                <PressableScale
                  accessibilityLabel={`${it.kind} ${it.title} ändern`}
                  onPress={() => onEditItem?.(it.key)}
                  pressedScale={0.99}
                  style={{ flex: 1 }}
                >
                  {zeile}
                </PressableScale>
              ) : (
                <View style={{ flex: 1 }}>{zeile}</View>
              )}
              <Type variant="caption" tone="text3">{it.kind}</Type>
            </View>
          );
        })}
        {items.length === 0 && (
          <Type variant="caption" tone="text3">Nichts Anzulegendes erkannt — sprich es etwas konkreter.</Type>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginTop: Spacing.xs }}>
        <PressableScale
          accessibilityLabel="Ergänzen — weiter sprechen"
          onPress={onSpeakAgain}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.xs }}
        >
          <Mic size={15} color={colors.teal} strokeWidth={2} />
          <Type variant="label" tone="teal">Ergänzen</Type>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Neu — das Erkannte verwerfen und frisch sprechen"
          onPress={onSpeakFresh}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.xs }}
        >
          <RotateCcw size={14} color={colors.text3} strokeWidth={2} />
          <Type variant="label" tone="text3">Neu</Type>
        </PressableScale>
      </View>
    </View>
  );
}

export function QuickVoiceSheet({ visible, onClose, apiKey }: { visible: boolean; onClose: () => void; apiKey: string }) {
  const memory = useSettings((s) => s.assistantMemory);
  const router = useRouter();
  const createTask = useCreateTask();
  const createList = useCreateList();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const createNote = useCreateNote();
  const createEvents = useCreateAssistantEvents();
  const { data: lists } = useLists();
  const today = todayStr();

  const [phase, setPhase] = useState<QuickVoicePhase>('listening');
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [localError, setLocalError] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [createdEvents, setCreatedEvents] = useState(0);
  const [edit, setEdit] = useState<EditTarget | null>(null);

  // Der Lauf lebt im Store, nicht im Sheet — schließt man das Sheet, während
  // der Assistent sortiert, läuft er weiter und liegt beim Öffnen fertig da.
  const run = useAssistantRuns((s) => s.runs[RUN_QUICKVOICE]);
  const beginRun = useAssistantRuns((s) => s.begin);
  const deltaRun = useAssistantRuns((s) => s.delta);
  const finishRun = useAssistantRuns((s) => s.finish);
  const failRun = useAssistantRuns((s) => s.fail);
  const clearRun = useAssistantRuns((s) => s.clear);
  const actions = run?.status === 'done' ? run.actions : null;
  const stream = run?.stream ?? '';
  const error = (run?.status === 'error' ? run.error : null) ?? localError;

  const interimRef = useRef('');
  const transcriptRef = useRef('');
  const prevListening = useRef(false);
  const started = useRef(false);

  const { available, listening, denied, toggle } = useDictation({
    onText: (t) => {
      interimRef.current = t;
      setInterim(t);
    },
  });

  const dateLabel = `${parseDateStr(today).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${today})`;

  const sort = async (dump: string) => {
    setPhase('thinking');
    setLocalError(null);
    beginRun(RUN_QUICKVOICE, 'Diktat', dump);
    try {
      const listNames = (lists ?? []).filter((l) => !l.deletedAt).map((l) => l.name);
      const msg: ChatMessage = { id: 'qv', chatId: 'qv', role: 'user', content: dump, createdAt: new Date().toISOString() };
      const answer = await askAssistant(apiKey, [msg], buildBraindumpContext(dateLabel, false, listNames), memory, {
        // Wie im Braindump: kurzer Prompt, verbindlicher JSON-Block, kleines
        // Modell zuerst. Bilder gibt es hier bewusst nicht — man fotografiert
        // nicht, während man spricht.
        mode: 'erfassen',
        json: true,
        onDelta: (delta) => deltaRun(RUN_QUICKVOICE, delta),
      });
      let parsed = extractActions(answer).actions;
      // „aenderungen" kann hier niemand anwenden (kein App-Überblick, keine
      // Handles) — ein Block, der NUR daraus besteht, zählt als leer, sonst
      // stünde da eine Vorschlagskarte ohne Zeilen mit totem Knopf.
      if (parsed && !hasCapturableActions(parsed)) parsed = null;
      if (!parsed) {
        const retry = await askAssistant(apiKey, [msg], buildBraindumpContext(dateLabel, true, listNames), memory, {
          mode: 'erfassen',
          json: true,
        });
        const zweiter = extractActions(retry).actions;
        parsed = zweiter && hasCapturableActions(zweiter) ? zweiter : null;
      }
      if (!parsed) {
        failRun(RUN_QUICKVOICE, `Konnte es nicht sortieren. Antwort: ${extractActions(answer).clean}`);
      } else {
        finishRun(RUN_QUICKVOICE, { clean: '', actions: parsed });
        setDeselected(new Set());
      }
    } catch (e) {
      failRun(RUN_QUICKVOICE, e instanceof Error ? e.message : 'Unbekannter Fehler.');
    }
  };

  // Der Store führt die Phase — auch dann, wenn das Ergebnis eintrifft, während
  // niemand hinsieht. Nach clearRun() (Übernehmen/Neu) greift er nicht mehr.
  useEffect(() => {
    if (!visible || !run) return;
    if (run.status === 'running') setPhase('thinking');
    else if (run.status === 'done') setPhase('result');
    else setPhase('error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, run?.status]);

  // Eine beendete Äußerung (Sprechpause) → anhängen und automatisch sortieren.
  useEffect(() => {
    if (prevListening.current && !listening) {
      const spoken = interimRef.current.trim();
      interimRef.current = '';
      setInterim('');
      if (spoken) {
        const next = (transcriptRef.current ? `${transcriptRef.current} ` : '') + spoken;
        transcriptRef.current = next;
        setTranscript(next);
        void sort(next);
      }
    }
    prevListening.current = listening;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  // Beim Öffnen: Zustand zurücksetzen und sofort zuhören. Beim Schließen: stoppen.
  useEffect(() => {
    if (visible) {
      // Liegt noch ein Lauf von vorhin da (man hat zwischendurch zugemacht),
      // wird er gezeigt statt weggeworfen — die Phase setzt der Effekt oben.
      const offen = useAssistantRuns.getState().runs[RUN_QUICKVOICE];
      if (offen) {
        // Das Gesagte gehört dazu: es steht über dem Ergebnis und ist die
        // Grundlage fürs „Ergänzen". Ohne das spräche man ins Leere weiter.
        transcriptRef.current = offen.input;
        setTranscript(offen.input);
        return undefined;
      }
      setPhase('listening');
      setInterim('');
      setTranscript('');
      setDeselected(new Set());
      setLocalError(null);
      setSummary('');
      interimRef.current = '';
      transcriptRef.current = '';
      started.current = false;
      // Nach dem Mount einmal starten (available ist ggf. erst dann true).
      const t = setTimeout(() => {
        if (!started.current && available && !listening) {
          started.current = true;
          toggle();
        }
      }, 120);
      return () => clearTimeout(t);
    }
    if (listening) toggle();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, available]);

  const toggleItem = (key: string) => {
    hapticSelect();
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Ergänzen: weiter sprechen, das Neue wird an den bisherigen Wurf angehängt.
  const speakAgain = () => {
    if (listening) {
      // Läuft noch → beenden (die Pause-Logik übernimmt das Sortieren).
      toggle();
      return;
    }
    setPhase('listening');
    setLocalError(null);
    if (available) toggle();
  };

  // Neu: das bisher Erkannte verwerfen und frisch zuhören.
  const speakFresh = () => {
    interimRef.current = '';
    transcriptRef.current = '';
    setInterim('');
    setTranscript('');
    clearRun(RUN_QUICKVOICE);
    setDeselected(new Set());
    setLocalError(null);
    setPhase('listening');
    if (available && !listening) toggle();
  };

  // Punkt 7: Kommt man aus den Einstellungen zurück (Berechtigung erlaubt),
  // beim App-Fokus erneut zuhören — statt schließen/neu öffnen zu müssen.
  useEffect(() => {
    if (!visible) return undefined;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && denied && phase === 'listening' && !listening) toggle();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, denied, phase, listening]);

  const selectedCount = actions
    ? actions.listen.length + actions.aufgaben.length + actions.termine.length + actions.notizen.length - deselected.size
    : 0;

  const confirm = async () => {
    if (!actions) return;
    hapticSuccess();
    // Anwenden liegt zentral in lib/applyActions — dieselbe Reihenfolge und
    // dieselben Schutzregeln wie im Braindump und beim Verwalter.
    const gewaehlt: AssistantAction = {
      ...actions,
      listen: actions.listen.filter((_, i) => !deselected.has(`l${i}`)),
      aufgaben: actions.aufgaben.filter((_, i) => !deselected.has(`a${i}`)),
      termine: actions.termine.filter((_, i) => !deselected.has(`t${i}`)),
      notizen: actions.notizen.filter((_, i) => !deselected.has(`n${i}`)),
      aenderungen: [],
    };
    // Scheitert eine Mutation, MUSS das sichtbar werden — sonst tut der Knopf
    // scheinbar nichts und niemand erfährt, warum.
    let res;
    try {
    res = await applyAssistantActions(gewaehlt, {
        lists: lists ?? [],
        tasks: [],
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
      failRun(RUN_QUICKVOICE, `Konnte es nicht anlegen: ${e instanceof Error ? e.message : 'Unbekannter Fehler.'}`);
      return;
    }
    const parts: string[] = [];
    if (res.projekte > 0) parts.push(`${res.projekte} ${res.projekte === 1 ? 'Projekt' : 'Projekte'}`);
    if (res.aufgaben > 0) parts.push(`${res.aufgaben} ${res.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}`);
    if (res.termine > 0) parts.push(`${res.termine} ${res.termine === 1 ? 'Termin im Kalender' : 'Termine im Kalender'}`);
    if (res.notizen > 0) parts.push(`${res.notizen} ${res.notizen === 1 ? 'Notiz' : 'Notizen'}`);
    setSummary(`${parts.join(' und ') || 'Nichts'} angelegt.`);
    setCreatedEvents(res.termine);
    clearRun(RUN_QUICKVOICE);
    setPhase('done');
    // Mit Terminen bleibt das „Erledigt" stehen (Tipp „Im Kalender ansehen"); sonst schnell weiter.
    if (res.termine === 0) setTimeout(onClose, 1100);
  };

  const title =
    phase === 'listening' && denied
      ? 'Mikrofon'
      : phase === 'result'
        ? 'Bereit'
        : phase === 'thinking'
          ? 'Einen Moment'
          : phase === 'done'
            ? 'Erledigt'
            : 'Sprich';

  const footer =
    phase === 'result' ? (
      <GlassButton accessibilityLabel="Auswahl übernehmen" onPress={() => void confirm()} disabled={selectedCount === 0}>
        <Sparkles size={16} color="#FFFFFF" strokeWidth={2.2} />
        <Type variant="label" style={{ color: '#FFFFFF' }}>
          {selectedCount === 1 ? '1 übernehmen' : `${selectedCount} übernehmen`}
        </Type>
      </GlassButton>
    ) : undefined;

  // Auf den Text tippen öffnet den Schnell-Editor. Bewusst NICHT als zweites
  // Sheet über dem ersten: zwei gleichzeitige RN-Modals sind auf dem Gerät
  // heikel — das Sprach-Sheet tritt so lange zurück.
  const openEdit = (key: string) => {
    hapticSelect();
    const index = Number(key.slice(1));
    if (key.startsWith('a')) setEdit({ kind: 'aufgabe', index });
    else if (key.startsWith('t')) setEdit({ kind: 'termin', index });
    else if (key.startsWith('n')) setEdit({ kind: 'notiz', index });
  };

  return (
    <>
      <BottomSheet visible={visible && !edit} onClose={onClose} title={title} footer={footer}>
        <QuickVoiceView
          phase={phase}
          interim={interim}
          transcript={transcript}
          stream={stream}
          actions={actions}
          deselected={deselected}
          error={error}
          summary={summary}
          today={today}
          denied={denied}
          hasEvents={createdEvents > 0}
          onToggleItem={toggleItem}
          onEditItem={openEdit}
          onSpeakAgain={speakAgain}
          onSpeakFresh={speakFresh}
          onOpenSettings={() => void Linking.openSettings()}
          onSchluesselWeg={onClose}
          onOpenCalendar={() => {
            onClose();
            router.push('/kalender');
          }}
        />
      </BottomSheet>
      {edit && actions && (
        <ActionEditSheet
          target={edit}
          actions={actions}
          lists={lists ?? []}
          onClose={() => setEdit(null)}
          onSave={(next) => finishRun(RUN_QUICKVOICE, { clean: run?.clean ?? '', actions: next })}
        />
      )}
    </>
  );
}
