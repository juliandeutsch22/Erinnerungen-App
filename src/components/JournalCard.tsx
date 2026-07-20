// JournalCard.tsx — Abendbetrachtung auf „Heute": die Seneca-Frage als
// Abend-Ritual. Ein Eintrag pro Tag, Autosave beim Tippen (600 ms Ruhe),
// stille Kette („N Abende in Folge") ohne Schuld-Zähler.
import { useRouter } from 'expo-router';
import { ChevronRight, MoonStar } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { GlassPanel } from '@/components/GlassPanel';
import { KeyboardDoneBar, keyboardDoneProps } from '@/components/KeyboardDone';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useJournal, useSaveJournal } from '@/data/journalQueries';
import { journalStreak } from '@/lib/journalLogic';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

export const JOURNAL_PROMPT = 'Was lief heute gut? Was habe ich gelernt?';

export function JournalCard({ today, onFocusInput }: { today: string; onFocusInput?: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const { data: entries } = useJournal();
  const save = useSaveJournal();

  const todayEntry = useMemo(() => (entries ?? []).find((e) => e.date === today), [entries, today]);
  // null = Bestand noch nicht geladen — erst dann das Feld füllen, damit
  // ein später eintreffender Eintrag nichts Getipptes überschreibt.
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (entries !== undefined) setText((cur) => (cur === null ? (todayEntry?.text ?? '') : cur));
  }, [entries, todayEntry]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChange = (t: string) => {
    setText(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      save.mutate({ date: today, text: t });
    }, 600);
  };
  // Beim Verlassen sofort sichern, statt den letzten Gedanken zu verlieren.
  const latest = useRef({ text, save, today });
  latest.current = { text, save, today };
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        const { text: t, save: s, today: d } = latest.current;
        if (t !== null) s.mutate({ date: d, text: t });
      }
    },
    [],
  );

  // Nur bei aktivem Feld nachscrollen — sonst würde schon der Seitenaufbau
  // (initiale Größenmessung) die Heute-Seite ans Ende ziehen.
  const [focused, setFocused] = useState(false);

  const streak = useMemo(() => journalStreak(entries ?? [], today), [entries, today]);
  const hasHistory = (entries ?? []).some((e) => e.text.trim().length > 0);

  return (
    <GlassPanel>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <MoonStar size={14} color={colors.indigo} strokeWidth={2} />
          <Type variant="eyebrow" tone="text3">Abendbetrachtung</Type>
        </View>
        {streak >= 2 && (
          <Type variant="caption" tone="teal" tabular>{streak} Abende in Folge</Type>
        )}
      </View>
      <Type variant="caption" tone="text3" style={{ marginTop: Spacing.xs }}>{JOURNAL_PROMPT}</Type>
      <TextInput
        accessibilityLabel="Abendbetrachtung schreiben"
        value={text ?? ''}
        onChangeText={onChange}
        onFocus={() => {
          setFocused(true);
          onFocusInput?.();
        }}
        onBlur={() => setFocused(false)}
        // Neue Zeile → Feld wächst nach unten → Karte über der Tastatur halten.
        onContentSizeChange={() => {
          if (focused) onFocusInput?.();
        }}
        multiline
        scrollEnabled={false}
        placeholder="Ein paar ehrliche Zeilen genügen …"
        placeholderTextColor={colors.text3}
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
      <KeyboardDoneBar />
      {hasHistory && (
        <PressableScale
          accessibilityLabel="Alle Betrachtungen öffnen"
          onPress={() => router.push('/journal')}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm, paddingVertical: Spacing.xs }}
        >
          <Type variant="caption" tone="text3">Alle Betrachtungen</Type>
          <ChevronRight size={14} color={colors.text3} strokeWidth={2} />
        </PressableScale>
      )}
    </GlassPanel>
  );
}
