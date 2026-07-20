// journal.tsx — Verlauf der Abendbetrachtung: alle Einträge, neueste zuerst.
// Geschrieben wird nur auf „Heute" (JournalCard) — hier wird gelesen,
// wie in einem stillen Tagebuch geblättert.
import { useRouter } from 'expo-router';
import { ChevronLeft, MoonStar } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState } from '@/components/StateView';
import { Type } from '@/components/Type';
import { useJournal } from '@/data/journalQueries';
import { formatDueDate, todayStr } from '@/lib/dates';
import { journalStreak } from '@/lib/journalLogic';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export default function JournalScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: entries } = useJournal();
  const today = todayStr();

  const list = useMemo(() => (entries ?? []).filter((e) => e.text.trim().length > 0), [entries]);
  const streak = useMemo(() => journalStreak(entries ?? [], today), [entries, today]);

  const subtitle =
    (list.length === 1 ? '1 Eintrag' : `${list.length} Einträge`) +
    (streak >= 2 ? ` · ${streak} Abende in Folge` : '');

  return (
    <Screen withTabBar={false}>
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
                <Type variant="heading">{formatDueDate(e.date, today)}</Type>
                <Type variant="body" tone="text2" style={{ marginTop: Spacing.xs }}>{e.text.trim()}</Type>
              </View>
            ))}
          </GlassPanel>
        )}
      </Reveal>
    </Screen>
  );
}
