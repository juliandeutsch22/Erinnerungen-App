// OmniResult.tsx — was die EINE Zeile antwortet.
//
// Sitzt direkt über der Eingabezeile und zeigt genau einen von vier Zuständen:
// es läuft · eine Antwort · ein Vorschlag zum Bestätigen · ein Fehler.
// Danach verschwindet es wieder — es ist kein Bildschirm, sondern eine
// Rückmeldung.
//
// Bewusst OHNE Einzelabwahl: In dieser Zeile geht es um ein, zwei Dinge. Wer
// abwählen oder zurechtrücken will, ist im Braindump besser aufgehoben; hier
// zählt Tempo, und „Verwerfen" plus neu tippen ist schneller als Kästchen.
// Die Leitplanke bleibt trotzdem gewahrt: Ohne Tipp auf „Übernehmen" wird
// nichts geschrieben.
import { Check, X } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { Glass } from '@/components/Glass';
import { MarkdownText } from '@/components/MarkdownText';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import type { Task } from '@/data/types';
import { type AssistantAction, describeAenderung, describeExtras, describeSchritte, resolveTaskHandle } from '@/lib/assistant';
import type { AssistantRun } from '@/lib/assistantRun';
import { formatDueDate } from '@/lib/dates';
import { warteText, type AssistentGrund } from '@/lib/inputRoute';
import { MAX_CONTENT_WIDTH } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Shadow, Spacing } from '@/theme/theme.tokens';

export type OmniZeile = { titel: string; unter?: string; art: string };

/** Die Vorschläge als lesbare Zeilen — dieselbe Sprache wie im Braindump. */
export function omniZeilen(a: AssistantAction, tasks: Task[], today: string): OmniZeile[] {
  return [
    ...a.listen.map((l) => ({ titel: l.name, unter: l.ziel ?? undefined, art: 'Projekt' })),
    ...a.aenderungen.map((c) => {
      const t = resolveTaskHandle(c.handle, tasks);
      // Unbekanntes Handle ehrlich anzeigen — es wird beim Übernehmen
      // übersprungen, statt still zu verschwinden.
      return {
        titel: t ? t.title : 'Unbekannte Aufgabe',
        unter: t ? describeAenderung(c, (d) => formatDueDate(d, today)) : 'Nicht mehr gefunden — wird übersprungen',
        art: 'Änderung',
      };
    }),
    ...a.aufgaben.map((t) => ({
      titel: t.titel,
      unter:
        [t.datum ? formatDueDate(t.datum, today) : '', t.zeit ?? '', t.liste ? `→ ${t.liste}` : '', describeSchritte(t.schritte) ?? '', describeExtras(t) ?? '']
          .filter(Boolean)
          .join(' · ') || undefined,
      art: 'Aufgabe',
    })),
    ...a.termine.map((t) => ({
      titel: t.titel,
      unter: `${formatDueDate(t.datum, today)}${t.start ? ` · ${t.start}` : ' · ganztägig'}`,
      art: 'Termin',
    })),
    ...a.notizen.map((n) => ({ titel: n.split('\n')[0], art: 'Notiz' })),
  ];
}

export function OmniResult({
  run,
  grund,
  tasks,
  today,
  onApply,
  onDismiss,
}: {
  run: AssistantRun;
  grund: AssistentGrund;
  tasks: Task[];
  today: string;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const colors = useColors();
  const actions = run.status === 'done' ? run.actions : null;
  const zeilen = actions ? omniZeilen(actions, tasks, today) : [];

  const schliessen = (
    <PressableScale accessibilityLabel="Antwort schließen" onPress={onDismiss} style={{ padding: Spacing.xs }}>
      <X size={15} color={colors.text3} strokeWidth={2.2} />
    </PressableScale>
  );

  return (
    <Glass
      variant="card"
      intensity={85}
      style={[Shadow.md, { width: '100%', maxWidth: MAX_CONTENT_WIDTH }]}
      contentStyle={{ padding: Spacing.md, gap: Spacing.xs }}
    >
      {run.status === 'running' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm }}>
          {/* Sobald Worte eintreffen, treten sie an die Stelle des Hinweises —
              dieselbe Wartezeit fühlt sich dann viel kürzer an. */}
          <Type variant="caption" tone="text3" numberOfLines={3} style={{ flex: 1 }}>
            {run.stream.split('```')[0].trim() || warteText(grund)}
          </Type>
          {schliessen}
        </View>
      )}

      {run.status === 'error' && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm }}>
          <Type variant="caption" tone="indigo" style={{ flex: 1 }}>{run.error}</Type>
          {schliessen}
        </View>
      )}

      {run.status === 'done' && (
        <>
          {run.clean.trim().length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <MarkdownText markdown={run.clean.trim()} />
              </View>
              {schliessen}
            </View>
          )}

          {zeilen.length > 0 && (
            <>
              {run.clean.trim().length === 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Type variant="eyebrow" tone="teal">Vorschlag</Type>
                  {schliessen}
                </View>
              )}
              <View style={{ gap: 2 }}>
                {zeilen.map((z, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2 }}>
                    <View style={{ flex: 1 }}>
                      <Type variant="body" numberOfLines={1}>{z.titel}</Type>
                      {z.unter && <Type variant="caption" tone="text3" numberOfLines={1} tabular>{z.unter}</Type>}
                    </View>
                    <Type variant="caption" tone="text3">{z.art}</Type>
                  </View>
                ))}
              </View>
              <PressableScale
                accessibilityLabel="Vorschlag übernehmen"
                onPress={onApply}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginTop: Spacing.xs,
                  paddingVertical: Spacing.sm,
                  borderRadius: 999,
                  backgroundColor: colors.teal,
                }}
              >
                <Check size={15} color="#FFFFFF" strokeWidth={2.6} />
                <Type variant="label" style={{ color: '#FFFFFF' }}>
                  {zeilen.length === 1 ? 'Übernehmen' : `${zeilen.length} übernehmen`}
                </Type>
              </PressableScale>
            </>
          )}
        </>
      )}
    </Glass>
  );
}
