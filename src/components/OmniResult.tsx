// OmniResult.tsx — was die EINE Zeile antwortet.
//
// Sitzt direkt über der Eingabezeile und zeigt genau einen von vier Zuständen:
// es läuft · eine Antwort · ein Vorschlag zum Bestätigen · ein Fehler.
// Danach verschwindet es wieder — es ist kein Bildschirm, sondern eine
// Rückmeldung.
//
// Seit v1.53.0 wie im Braindump: das KÄSTCHEN wählt ab, der TEXT öffnet den
// Schnell-Editor. Stimmt einer von drei Vorschlägen nicht, muss man nicht mehr
// alles verwerfen und neu tippen. Die Leitplanke bleibt: Ohne Tipp auf
// „Übernehmen" wird nichts geschrieben.
import { Check, X } from 'lucide-react-native';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { MarkdownText } from '@/components/MarkdownText';
import { PressableScale } from '@/components/PressableScale';
import { SchluesselWeg } from '@/components/SchluesselWeg';
import { betrifftSchluessel } from '@/lib/schluessel';
import { Type } from '@/components/Type';
import type { Task } from '@/data/types';
import { type AssistantAction, describeAenderung, describeExtras, describeSchritte, ortZusatz, terminDatum, resolveTaskHandle } from '@/lib/assistant';
import type { AssistantRun } from '@/lib/assistantRun';
import { formatDueDate } from '@/lib/dates';
import { warteText, type AssistentGrund } from '@/lib/inputRoute';
import { MAX_CONTENT_WIDTH } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Shadow, Spacing } from '@/theme/theme.tokens';

export type OmniZeile = {
  /** Schlüssel für die Abwahl — gleiche Sprache wie im Braindump. */
  key: string;
  titel: string;
  unter?: string;
  art: string;
  /** Projekte und Änderungen haben keinen Schnell-Editor. */
  editierbar: boolean;
};

/** Die Vorschläge als lesbare Zeilen — dieselbe Sprache wie im Braindump. */
export function omniZeilen(a: AssistantAction, tasks: Task[], today: string): OmniZeile[] {
  return [
    ...a.listen.map((l, i) => ({ key: `l${i}`, titel: l.name, unter: l.ziel ?? undefined, art: 'Projekt', editierbar: false })),
    ...a.aenderungen.map((c, i) => {
      const t = resolveTaskHandle(c.handle, tasks);
      // Unbekanntes Handle ehrlich anzeigen — es wird beim Übernehmen
      // übersprungen, statt still zu verschwinden.
      return {
        key: `x${i}`,
        titel: t ? t.title : 'Unbekannte Aufgabe',
        unter: t ? describeAenderung(c, (d) => formatDueDate(d, today)) : 'Nicht mehr gefunden — wird übersprungen',
        art: 'Änderung',
        editierbar: false,
      };
    }),
    ...a.aufgaben.map((t, i) => ({
      key: `a${i}`,
      titel: t.titel,
      unter:
        [t.datum ? formatDueDate(t.datum, today) : '', t.zeit ?? '', t.liste ? `→ ${t.liste}` : '', describeSchritte(t.schritte) ?? '', describeExtras(t) ?? '']
          .filter(Boolean)
          .join(' · ') || undefined,
      art: 'Aufgabe',
      editierbar: true,
    })),
    ...a.termine.map((t, i) => ({
      key: `t${i}`,
      titel: t.titel,
      unter: `${terminDatum(t, (d) => formatDueDate(d, today))}${t.start ? ` · ${t.start}` : ' · ganztägig'}${ortZusatz(t)}`,
      art: 'Termin',
      editierbar: true,
    })),
    ...a.notizen.map((n, i) => ({ key: `n${i}`, titel: n.split('\n')[0], art: 'Notiz', editierbar: true })),
  ];
}

export function OmniResult({
  run,
  grund,
  tasks,
  today,
  deselected,
  onToggle,
  onEdit,
  onApply,
  onDismiss,
}: {
  run: AssistantRun;
  grund: AssistentGrund;
  tasks: Task[];
  today: string;
  /** Abgewählte Vorschläge (Schlüssel aus `omniZeilen`). */
  deselected: Set<string>;
  onToggle: (key: string) => void;
  onEdit: (key: string) => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const colors = useColors();
  const actions = run.status === 'done' ? run.actions : null;
  const zeilen = actions ? omniZeilen(actions, tasks, today) : [];
  const gewaehlt = zeilen.filter((z) => !deselected.has(z.key)).length;

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
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm }}>
            <Type variant="caption" tone="indigo" style={{ flex: 1 }}>{run.error}</Type>
            {schliessen}
          </View>
          {/* Sagt die Meldung „Schlüssel", muss von hier ein Weg dorthin gehen —
              sonst steht der Nutzer mit einem Auftrag ohne Adresse da. Die Karte
              geht dabei zu: sie läge sonst über dem neuen Bildschirm. */}
          {betrifftSchluessel(run.error) && <SchluesselWeg onWeg={onDismiss} />}
        </>
      )}

      {run.status === 'done' && (
        <>
          {/* Kopf FEST, Inhalt scrollt, Knopf FEST — wie im BottomSheet.
              Vorher scrollte nur die Vorschlagsliste; eine lange Antwort hatte
              gar keinen Scrollbereich und lief unter die Eingabezeile. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm }}>
            <Type variant="eyebrow" tone="teal" numberOfLines={1} style={{ flex: 1 }}>
              {zeilen.length > 0 ? 'Vorschlag — Kästchen wählt ab, Text ändert' : 'Antwort'}
            </Type>
            {schliessen}
          </View>
          <ScrollView
            style={{ maxHeight: 260 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.xs }}
          >
            {run.clean.trim().length > 0 && <MarkdownText markdown={run.clean.trim()} />}
            <View style={{ gap: 2 }}>
                {zeilen.map((z) => {
                  const aus = deselected.has(z.key);
                  const inhalt = (
                    <>
                      <Type variant="body" numberOfLines={1}>{z.titel}</Type>
                      {z.unter && <Type variant="caption" tone="text3" numberOfLines={1} tabular>{z.unter}</Type>}
                    </>
                  );
                  return (
                    <View
                      key={z.key}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2, opacity: aus ? 0.4 : 1 }}
                    >
                      <PressableScale
                        accessibilityLabel={`${z.art} ${z.titel} ${aus ? 'wieder auswählen' : 'abwählen'}`}
                        onPress={() => onToggle(z.key)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: z.art === 'Notiz' ? 9 : 5,
                          borderWidth: 1.5,
                          borderColor: aus ? colors.border3 : colors.teal,
                          backgroundColor: aus ? 'transparent' : colors.teal,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {!aus && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </PressableScale>
                      {z.editierbar ? (
                        <PressableScale
                          accessibilityLabel={`${z.art} ${z.titel} ändern`}
                          onPress={() => onEdit(z.key)}
                          pressedScale={0.99}
                          style={{ flex: 1 }}
                        >
                          {inhalt}
                        </PressableScale>
                      ) : (
                        <View style={{ flex: 1 }}>{inhalt}</View>
                      )}
                      <Type variant="caption" tone="text3">{z.art}</Type>
                    </View>
                  );
                })}
            </View>
          </ScrollView>
          {zeilen.length > 0 && (
              <PressableScale
                accessibilityLabel="Vorschlag übernehmen"
                onPress={gewaehlt > 0 ? onApply : undefined}
                style={{
                  opacity: gewaehlt > 0 ? 1 : 0.4,
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
                  {gewaehlt === 1 ? 'Übernehmen' : `${gewaehlt} übernehmen`}
                </Type>
              </PressableScale>
          )}
        </>
      )}
    </Glass>
  );
}
