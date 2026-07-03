// einstellungen.tsx — Zahnrad-Ziel (Fahrplan §4): Theme, Bewegung,
// Standard-Uhrzeit, Sammel-Notification, JSON-Backup (Export/Import §3.8).
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft, Download, Upload } from 'lucide-react-native';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { GlassButton } from '@/components/GlassButton';
import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { Type } from '@/components/Type';
import { exportToJsonString, importBackup, shareBackup } from '@/data/backup';
import { queryKeys } from '@/data/queries';
import { requestReschedule } from '@/lib/notifications';
import { hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { MotionPref, ThemePref, useSettings } from '@/theme/settings.store';
import { R, Spacing, T } from '@/theme/theme.tokens';

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];
const MOTIONS: { value: MotionPref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'full', label: 'Voll' },
  { value: 'reduced', label: 'Reduziert' },
];
const DEFAULT_TIMES = ['08:00', '09:00', '12:00', '18:00'];
const SUMMARY_TIMES = ['07:00', '08:00', '09:00', '10:00'];

export default function EinstellungenScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();

  const themePref = useSettings((s) => s.themePref);
  const motionPref = useSettings((s) => s.motionPref);
  const defaultDueTime = useSettings((s) => s.defaultDueTime);
  const summaryEnabled = useSettings((s) => s.summaryEnabled);
  const summaryTime = useSettings((s) => s.summaryTime);
  const setThemePref = useSettings((s) => s.setThemePref);
  const setMotionPref = useSettings((s) => s.setMotionPref);
  const setDefaultDueTime = useSettings((s) => s.setDefaultDueTime);
  const setSummaryEnabled = useSettings((s) => s.setSummaryEnabled);
  const setSummaryTime = useSettings((s) => s.setSummaryTime);

  const [importText, setImportText] = useState('');
  const [confirmImport, setConfirmImport] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const doExport = async () => {
    const json = await exportToJsonString();
    await shareBackup(json);
  };

  const doImport = async () => {
    if (!confirmImport) {
      setConfirmImport(true);
      return;
    }
    setConfirmImport(false);
    try {
      const { lists, tasks } = await importBackup(importText);
      await qc.invalidateQueries({ queryKey: queryKeys.tasks });
      await qc.invalidateQueries({ queryKey: queryKeys.lists });
      requestReschedule();
      hapticSuccess();
      setImportText('');
      setFeedback(`Wiederhergestellt: ${lists} Listen, ${tasks} Aufgaben.`);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Import fehlgeschlagen.');
    }
  };

  return (
    // Import-Feld liegt am Seitenende → iOS-Tastatur-Insets, damit es beim
    // Tippen sichtbar bleibt (scrollt automatisch über die Tastatur).
    <Screen withTabBar={false} automaticallyAdjustKeyboardInsets>
      <Reveal>
        <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm, marginLeft: -Spacing.sm, alignSelf: 'flex-start' }}>
          <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
        </PressableScale>
        <Type variant="title" style={{ marginTop: Spacing.xs }}>Einstellungen</Type>
      </Reveal>

      <Reveal delay={80}>
        <GlassPanel>
          <Type variant="label" tone="text2">Erscheinungsbild</Type>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
            {THEMES.map((t) => (
              <Chip key={t.value} label={t.label} active={themePref === t.value} onPress={() => setThemePref(t.value)} />
            ))}
          </View>

          <Seam />

          <Type variant="label" tone="text2">Bewegung</Type>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
            {MOTIONS.map((m) => (
              <Chip key={m.value} label={m.label} active={motionPref === m.value} onPress={() => setMotionPref(m.value)} />
            ))}
          </View>

          <Seam />

          <Type variant="label" tone="text2">Standard-Uhrzeit</Type>
          <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
            Vorschlag für „Eigene Uhrzeit" im Editor.
          </Type>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm }}>
            {DEFAULT_TIMES.map((t) => (
              <Chip key={t} label={t} active={defaultDueTime === t} onPress={() => setDefaultDueTime(t)} />
            ))}
          </View>

          <Seam />

          <Type variant="label" tone="text2">Sammel-Erinnerung</Type>
          <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
            Eine Mitteilung „X Dinge für heute" für Aufgaben ohne Uhrzeit.
          </Type>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm }}>
            <Chip
              label={summaryEnabled ? 'An' : 'Aus'}
              active={summaryEnabled}
              onPress={() => {
                setSummaryEnabled(!summaryEnabled);
                requestReschedule();
              }}
            />
            {summaryEnabled &&
              SUMMARY_TIMES.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={summaryTime === t}
                  onPress={() => {
                    setSummaryTime(t);
                    requestReschedule();
                  }}
                />
              ))}
          </View>
        </GlassPanel>
      </Reveal>

      <Reveal delay={140}>
        <GlassPanel>
          <Type variant="label" tone="text2">Backup</Type>
          <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
            JSON-Export deiner Listen und Aufgaben — wichtig vor dem Nachsignieren (7-Tage-Zyklus).
          </Type>
          <GlassButton
            size="sm"
            accessibilityLabel="Backup exportieren"
            onPress={() => void doExport()}
            style={{ marginTop: Spacing.md, alignSelf: 'flex-start' }}
          >
            <Download size={15} color="#FFFFFF" strokeWidth={2.2} />
            <Type variant="label" style={{ color: '#FFFFFF' }}>Exportieren</Type>
          </GlassButton>

          <Seam />

          <Type variant="label" tone="text2">Wiederherstellen</Type>
          <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
            Backup-JSON hier einfügen. Ersetzt den kompletten Bestand.
          </Type>
          <TextInput
            value={importText}
            onChangeText={(v) => {
              setImportText(v);
              setConfirmImport(false);
              setFeedback(null);
            }}
            placeholder='{"app":"stille", …}'
            placeholderTextColor={colors.text3}
            multiline
            accessibilityLabel="Backup-JSON"
            style={[
              {
                marginTop: Spacing.sm,
                minHeight: 72,
                maxHeight: 140,
                borderRadius: R.md,
                borderWidth: 1,
                borderColor: colors.chipBorder,
                backgroundColor: colors.chip,
                padding: Spacing.sm,
                fontSize: T.sm,
                color: colors.text,
                textAlignVertical: 'top',
              },
              webNoOutline,
            ]}
          />
          <GlassButton
            size="sm"
            variant={confirmImport ? 'primary' : 'secondary'}
            tone="indigo"
            accessibilityLabel="Backup importieren"
            onPress={() => void doImport()}
            disabled={importText.trim().length === 0}
            style={{ marginTop: Spacing.md, alignSelf: 'flex-start' }}
          >
            <Upload size={15} color={confirmImport ? '#FFFFFF' : colors.indigo} strokeWidth={2.2} />
            <Type variant="label" style={{ color: confirmImport ? '#FFFFFF' : colors.indigo }}>
              {confirmImport ? 'Wirklich ersetzen? Tippe erneut.' : 'Importieren'}
            </Type>
          </GlassButton>
          {feedback && (
            <Type variant="caption" tone="text2" style={{ marginTop: Spacing.sm }}>
              {feedback}
            </Type>
          )}
        </GlassPanel>
      </Reveal>
    </Screen>
  );
}
