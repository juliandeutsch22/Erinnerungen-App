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
import { Check, Mic, Sparkles } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { BottomSheet } from '@/components/BottomSheet';
import { GlassButton } from '@/components/GlassButton';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useCreateNote } from '@/data/noteQueries';
import { useCreateTask } from '@/data/queries';
import type { ChatMessage } from '@/data/types';
import { type AssistantAction, askAssistant, buildBraindumpContext, extractActions } from '@/lib/assistant';
import { formatDueDate, parseDateStr, todayStr } from '@/lib/dates';
import { useDictation } from '@/lib/dictation';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { useColors, useReducedMotion } from '@/theme/ThemeProvider';
import { R, Spacing } from '@/theme/theme.tokens';

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
  actions,
  deselected,
  error,
  summary,
  today,
  denied = false,
  onToggleItem,
  onSpeakAgain,
  onOpenSettings,
}: {
  phase: QuickVoicePhase;
  interim: string;
  transcript: string;
  actions: AssistantAction | null;
  deselected: Set<string>;
  error: string | null;
  summary: string;
  today: string;
  /** Mikrofon-Berechtigung verweigert → ruhiger Hinweis statt endlosem „hört zu". */
  denied?: boolean;
  onToggleItem?: (key: string) => void;
  onSpeakAgain?: () => void;
  onOpenSettings?: () => void;
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
    return (
      <View style={{ gap: Spacing.md, paddingVertical: Spacing.lg, alignItems: 'center' }}>
        <MicOrb active={false} label="Assistent denkt nach" />
        <Type variant="eyebrow" tone="text3">Einen Moment</Type>
        {transcript.trim().length > 0 && (
          <Type variant="body" tone="text2" style={{ textAlign: 'center' }}>
            „{transcript.trim()}"
          </Type>
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
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={{ gap: Spacing.md, paddingVertical: Spacing.md }}>
        <Type variant="caption" tone="indigo">{error ?? 'Das hat nicht geklappt.'}</Type>
        <GlassButton accessibilityLabel="Noch einmal sprechen" onPress={onSpeakAgain}>
          <Mic size={17} color="#FFFFFF" strokeWidth={2.2} />
          <Type variant="label" style={{ color: '#FFFFFF' }}>Noch einmal sprechen</Type>
        </GlassButton>
      </View>
    );
  }

  // result
  const items: { key: string; title: string; sub?: string; kind: 'Aufgabe' | 'Notiz' }[] = [
    ...(actions?.aufgaben ?? []).map((a, i) => ({
      key: `a${i}`,
      title: a.titel,
      sub: a.datum || a.zeit ? `${a.datum ? formatDueDate(a.datum, today) : ''}${a.zeit ? ` · ${a.zeit}` : ''}` : undefined,
      kind: 'Aufgabe' as const,
    })),
    ...(actions?.notizen ?? []).map((n, i) => ({ key: `n${i}`, title: n.split('\n')[0], kind: 'Notiz' as const })),
  ];

  return (
    <View style={{ gap: Spacing.sm }}>
      {transcript.trim().length > 0 && (
        <Type variant="body" tone="text3" style={{ fontStyle: 'italic' }}>„{transcript.trim()}"</Type>
      )}
      <Type variant="eyebrow" tone="teal">Erkannt — antippen wählt ab</Type>
      <View style={{ gap: 2 }}>
        {items.map((it) => {
          const off = deselected.has(it.key);
          const round = it.kind === 'Notiz';
          return (
            <PressableScale
              key={it.key}
              accessibilityLabel={`${it.kind} ${it.title} ${off ? 'wieder auswählen' : 'abwählen'}`}
              onPress={() => onToggleItem?.(it.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 1, opacity: off ? 0.4 : 1 }}
            >
              <View
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
              </View>
              <View style={{ flex: 1 }}>
                <Type variant="body" numberOfLines={1}>{it.title}</Type>
                {it.sub && <Type variant="caption" tone="text3" tabular>{it.sub}</Type>}
              </View>
              <Type variant="caption" tone="text3">{it.kind}</Type>
            </PressableScale>
          );
        })}
        {items.length === 0 && (
          <Type variant="caption" tone="text3">Nichts Anzulegendes erkannt — sprich es etwas konkreter.</Type>
        )}
      </View>
      <PressableScale
        accessibilityLabel="Weiter sprechen"
        onPress={onSpeakAgain}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: Spacing.xs, marginTop: Spacing.xs }}
      >
        <Mic size={15} color={colors.teal} strokeWidth={2} />
        <Type variant="label" tone="teal">Weiter sprechen</Type>
      </PressableScale>
    </View>
  );
}

export function QuickVoiceSheet({ visible, onClose, apiKey }: { visible: boolean; onClose: () => void; apiKey: string }) {
  const createTask = useCreateTask();
  const createNote = useCreateNote();
  const today = todayStr();

  const [phase, setPhase] = useState<QuickVoicePhase>('listening');
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const [actions, setActions] = useState<AssistantAction | null>(null);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState('');

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
    setError(null);
    try {
      const msg: ChatMessage = { id: 'qv', chatId: 'qv', role: 'user', content: dump, createdAt: new Date().toISOString() };
      const answer = await askAssistant(apiKey, [msg], buildBraindumpContext(dateLabel));
      let parsed = extractActions(answer).actions;
      if (!parsed) {
        const retry = await askAssistant(apiKey, [msg], buildBraindumpContext(dateLabel, true));
        parsed = extractActions(retry).actions;
      }
      if (!parsed) {
        setError(`Konnte es nicht sortieren. Antwort: ${extractActions(answer).clean}`);
        setPhase('error');
      } else {
        setActions(parsed);
        setDeselected(new Set());
        setPhase('result');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler.');
      setPhase('error');
    }
  };

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
      setPhase('listening');
      setInterim('');
      setTranscript('');
      setActions(null);
      setDeselected(new Set());
      setError(null);
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

  const speakAgain = () => {
    if (listening) {
      // Läuft noch → beenden (die Pause-Logik übernimmt das Sortieren).
      toggle();
      return;
    }
    setPhase('listening');
    setError(null);
    if (available) toggle();
  };

  const selectedCount = actions ? actions.aufgaben.length + actions.notizen.length - deselected.size : 0;

  const confirm = async () => {
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
    const parts: string[] = [];
    if (tasks > 0) parts.push(`${tasks} ${tasks === 1 ? 'Aufgabe' : 'Aufgaben'}`);
    if (notes > 0) parts.push(`${notes} ${notes === 1 ? 'Notiz' : 'Notizen'}`);
    setSummary(`${parts.join(' und ') || 'Nichts'} angelegt.`);
    setPhase('done');
    setTimeout(onClose, 1100);
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

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} footer={footer}>
      <QuickVoiceView
        phase={phase}
        interim={interim}
        transcript={transcript}
        actions={actions}
        deselected={deselected}
        error={error}
        summary={summary}
        today={today}
        denied={denied}
        onToggleItem={toggleItem}
        onSpeakAgain={speakAgain}
        onOpenSettings={() => void Linking.openSettings()}
      />
    </BottomSheet>
  );
}
