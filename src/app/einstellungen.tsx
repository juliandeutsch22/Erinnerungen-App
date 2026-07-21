// einstellungen.tsx — Zahnrad-Ziel (Fahrplan §4): Theme, Bewegung,
// Standard-Uhrzeit, Sammel-Notification, JSON-Backup (Export/Import §3.8).
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ChevronLeft, ClipboardPaste, CloudDownload, Download, FolderOpen, Upload } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { DisclosureChevron } from '@/components/DisclosureChevron';
import { authenticateAppLock, canUseAppLock } from '@/lib/appLock';
import { GlassButton } from '@/components/GlassButton';
import { ImportRemindersSheet } from '@/components/ImportRemindersSheet';
import { PasteNoteSheet } from '@/components/PasteNoteSheet';
import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { Type } from '@/components/Type';
import { type BackupBundle, describeSummary, exportToJsonString, importBackup, shareBackup, summarizeBundle } from '@/data/backup';
import {
  extFromUri,
  fileBackupAvailable,
  pickBackupFile,
  readPhotoBase64,
  saveAndShareBackup,
  writePhotoFromBase64,
} from '@/lib/backupFile';
import { queryKeys } from '@/data/queries';
import { requestReschedule, rescheduleJournalReminder } from '@/lib/notifications';
import { listBackups, readBackup, runAutoBackup } from '@/lib/autoBackup';
import { readDocumentBase64, writeDocumentFromBase64 } from '@/lib/documents';
import { deviceRemindersAvailable } from '@/lib/deviceReminders';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { setSecureKey } from '@/lib/secureKey';
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
const JOURNAL_TIMES = ['20:00', '21:00', '22:00'];

// Abschnitts-Überschriften in der Antiqua — dieselbe Stimme wie überall in der App.
const sectionStyle = { fontSize: T.lg + 2, lineHeight: (T.lg + 2) * 1.25 } as const;

// Version + Build aus der App-Config — damit man am Gerät sieht, welcher Build läuft.
const build = Constants.expoConfig?.ios?.buildNumber;
const appVersion = `${Constants.expoConfig?.version ?? '?'}${build ? ` (${build})` : ''}`;

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
  const journalReminderEnabled = useSettings((s) => s.journalReminderEnabled);
  const journalReminderTime = useSettings((s) => s.journalReminderTime);
  const setJournalReminderEnabled = useSettings((s) => s.setJournalReminderEnabled);
  const setJournalReminderTime = useSettings((s) => s.setJournalReminderTime);
  const assistantContextEnabled = useSettings((s) => s.assistantContextEnabled);
  const setAssistantContextEnabled = useSettings((s) => s.setAssistantContextEnabled);
  const setSavedFilters = useSettings((s) => s.setSavedFilters);
  const appLockEnabled = useSettings((s) => s.appLockEnabled);
  const setAppLockEnabled = useSettings((s) => s.setAppLockEnabled);

  // Sperre nur anbieten, wenn das Gerät Biometrie/Code kann (Web: nie).
  const [lockOfferable, setLockOfferable] = useState(false);
  useEffect(() => {
    void canUseAppLock().then(setLockOfferable);
  }, []);

  const [importText, setImportText] = useState('');
  // Das rohe JSON-Feld bleibt eingeklappt — es ist der Notausgang, nicht der Weg.
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showReminderImport, setShowReminderImport] = useState(false);
  const [showPasteNote, setShowPasteNote] = useState(false);
  const geminiApiKey = useSettings((s) => s.geminiApiKey);
  const setGeminiApiKey = useSettings((s) => s.setGeminiApiKey);
  const lastAutoBackupAt = useSettings((s) => s.lastAutoBackupAt);
  const setLastAutoBackupAt = useSettings((s) => s.setLastAutoBackupAt);

  // Schlüssel: In-Memory-Kopie + Keychain als Quelle.
  const onChangeApiKey = (v: string) => {
    setGeminiApiKey(v);
    void setSecureKey(v.trim());
  };

  const autoBackupLabel = (() => {
    if (!fileBackupAvailable) return null;
    if (!lastAutoBackupAt) return 'Automatisches Backup: noch keins — läuft beim nächsten Start.';
    const days = Math.floor((Date.now() - Date.parse(lastAutoBackupAt)) / 86400000);
    const when = days <= 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`;
    return `Automatisches Backup: ${when} · wöchentlich in Dateien → Stoa → Backups.`;
  })();

  const doAutoBackupNow = async () => {
    const name = await runAutoBackup(useSettings.getState().savedFilters);
    if (name) {
      setLastAutoBackupAt(new Date().toISOString());
      hapticSuccess();
      setFeedback(`Backup „${name}" gespeichert (Dateien → Stoa → Backups).`);
    } else {
      setFeedback('Backup fehlgeschlagen — bitte manuell sichern.');
    }
  };

  const doExport = async () => {
    const json = await exportToJsonString({
      savedFilters: useSettings.getState().savedFilters,
      readPhotoBase64,
      extFromUri,
      readDocumentBase64,
    });
    if (fileBackupAvailable) await saveAndShareBackup(json);
    else await shareBackup(json);
    // Ehrlicher Bericht: was drin ist — und welche Dokumente ohne Inhalt blieben.
    try {
      setFeedback(describeSummary(summarizeBundle(JSON.parse(json) as BackupBundle)));
    } catch {
      /* Bericht ist Komfort — der Export selbst ist durch */
    }
  };

  // Gemeinsame Wiederherstellung — aus Datei, Stand oder eingefügtem Text.
  // Vorher wird der AKTUELLE Bestand als Schutz-Backup weggeschrieben:
  // ein Restore ist damit selbst risikofrei rückgängig machbar.
  const runImport = async (json: string) => {
    try {
      if (fileBackupAvailable) {
        const name = await runAutoBackup(useSettings.getState().savedFilters);
        if (name) setLastAutoBackupAt(new Date().toISOString());
      }
      const { lists, tasks, filters, photos, documents } = await importBackup(json, {
        setSavedFilters,
        writePhotoFromBase64,
        writeDocumentFromBase64,
      });
      await qc.invalidateQueries();
      requestReschedule();
      hapticSuccess();
      setImportText('');
      setConfirmImport(false);
      const extras = [filters ? `${filters} Filter` : '', photos ? `${photos} Fotos` : '', documents ? `${documents} Dokumente` : ''].filter(Boolean);
      setFeedback(`Wiederhergestellt: ${lists} Listen, ${tasks} Aufgaben${extras.length ? ', ' + extras.join(', ') : ''}.`);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Import fehlgeschlagen.');
    }
  };

  const doImportFile = async () => {
    setFeedback(null);
    try {
      const json = await pickBackupFile();
      if (json) await runImport(json);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Import fehlgeschlagen.');
    }
  };

  const doImport = async () => {
    if (!confirmImport) {
      setConfirmImport(true);
      return;
    }
    await runImport(importText);
  };

  // Wiederherstellen direkt aus einem Auto-Backup-Stand (zweistufig).
  const backupEntries = fileBackupAvailable ? listBackups() : [];
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const restoreFromBackup = async (name: string) => {
    if (confirmRestore !== name) {
      hapticSelect();
      setConfirmRestore(name);
      return;
    }
    setConfirmRestore(null);
    setFeedback(null);
    // WICHTIG: erst lesen, dann Schutz-Backup (runImport) — sonst überschreibt
    // das Schutz-Backup den heutigen Stand, bevor er gelesen wurde.
    const json = await readBackup(name);
    if (!json) {
      setFeedback('Backup-Datei konnte nicht gelesen werden.');
      return;
    }
    await runImport(json);
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
          <Type variant="heading" style={sectionStyle}>Erscheinungsbild</Type>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
            {THEMES.map((t) => (
              <Chip key={t.value} label={t.label} active={themePref === t.value} onPress={() => setThemePref(t.value)} />
            ))}
          </View>

          <Seam />

          <Type variant="heading" style={sectionStyle}>Bewegung</Type>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
            {MOTIONS.map((m) => (
              <Chip key={m.value} label={m.label} active={motionPref === m.value} onPress={() => setMotionPref(m.value)} />
            ))}
          </View>

          {lockOfferable && (
            <>
              <Seam />
              <Type variant="heading" style={sectionStyle}>Sperre</Type>
              <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
                Beim Öffnen mit Face ID (oder Gerätecode) entsperren — dein Journal und deine Notizen bleiben privat.
              </Type>
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                <Chip
                  label={appLockEnabled ? 'An' : 'Aus'}
                  active={appLockEnabled}
                  onPress={() => {
                    if (appLockEnabled) {
                      // Ausschalten erst nach erfolgreicher Prüfung — sonst
                      // könnte jemand die Sperre einfach abschalten.
                      void authenticateAppLock().then((ok) => {
                        if (ok) setAppLockEnabled(false);
                      });
                    } else {
                      // Einschalten gleich einmal testen, damit klar ist, dass es geht.
                      void authenticateAppLock().then((ok) => {
                        if (ok) setAppLockEnabled(true);
                      });
                    }
                  }}
                />
              </View>
            </>
          )}

          <Seam />

          <Type variant="heading" style={sectionStyle}>Standard-Uhrzeit</Type>
          <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
            Vorschlag für „Eigene Uhrzeit" im Editor.
          </Type>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm }}>
            {DEFAULT_TIMES.map((t) => (
              <Chip key={t} label={t} active={defaultDueTime === t} onPress={() => setDefaultDueTime(t)} />
            ))}
          </View>

          <Seam />

          <Type variant="heading" style={sectionStyle}>Sammel-Erinnerung</Type>
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

          <Seam />

          <Type variant="heading" style={sectionStyle}>Abendbetrachtung</Type>
          <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
            Eine stille tägliche Erinnerung an die Frage des Abends.
          </Type>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm }}>
            <Chip
              label={journalReminderEnabled ? 'An' : 'Aus'}
              active={journalReminderEnabled}
              onPress={() => {
                const next = !journalReminderEnabled;
                setJournalReminderEnabled(next);
                void rescheduleJournalReminder(next, journalReminderTime);
              }}
            />
            {journalReminderEnabled &&
              JOURNAL_TIMES.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={journalReminderTime === t}
                  onPress={() => {
                    setJournalReminderTime(t);
                    void rescheduleJournalReminder(true, t);
                  }}
                />
              ))}
          </View>
        </GlassPanel>
      </Reveal>

      <Reveal delay={140}>
        <GlassPanel>
          <Type variant="heading" style={sectionStyle}>Backup</Type>
          <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
            Sichert Listen, Aufgaben, Notizen, Chats, Filter, Termin-Fotos, Dokumente und
            Abendbetrachtungen in einer Datei — wichtig
            vor dem Nachsignieren (7-Tage-Zyklus) oder einer Neuinstallation.
            Dokumente über 10 MB liegen nur als Verknüpfung im Backup.
          </Type>
          {autoBackupLabel && (
            <PressableScale accessibilityLabel="Backup jetzt ausführen" onPress={() => void doAutoBackupNow()}>
              <Type variant="caption" tone="teal" style={{ marginTop: Spacing.sm }}>
                {autoBackupLabel} Tippen sichert sofort.
              </Type>
            </PressableScale>
          )}
          <GlassButton
            size="sm"
            accessibilityLabel="Backup exportieren"
            onPress={() => void doExport()}
            style={{ marginTop: Spacing.md, alignSelf: 'flex-start' }}
          >
            <Download size={15} color="#FFFFFF" strokeWidth={2.2} />
            <Type variant="label" style={{ color: '#FFFFFF' }}>Sichern</Type>
          </GlassButton>

          <Seam />

          <Type variant="heading" style={sectionStyle}>Wiederherstellen</Type>
          <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
            Ersetzt den kompletten Bestand durch ein Backup.
          </Type>
          {fileBackupAvailable && (
            <GlassButton
              size="sm"
              variant="secondary"
              tone="indigo"
              accessibilityLabel="Backup aus Datei wählen"
              onPress={() => void doImportFile()}
              style={{ marginTop: Spacing.md, alignSelf: 'flex-start' }}
            >
              <FolderOpen size={15} color={colors.indigo} strokeWidth={2.2} />
              <Type variant="label" style={{ color: colors.indigo }}>Aus Datei wählen</Type>
            </GlassButton>
          )}
          {backupEntries.length > 0 && (
            <View style={{ marginTop: Spacing.md, gap: 2 }}>
              <Type variant="caption" tone="text3">Oder einen automatischen Stand zurückspielen:</Type>
              {backupEntries.map((b) => (
                <PressableScale
                  key={b.name}
                  accessibilityLabel={`Backup vom ${b.date} wiederherstellen`}
                  onPress={() => void restoreFromBackup(b.name)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 }}
                >
                  <Download size={13} color={confirmRestore === b.name ? colors.indigo : colors.text3} strokeWidth={2} />
                  <Type variant="caption" tone={confirmRestore === b.name ? 'indigo' : 'text2'} tabular>
                    {confirmRestore === b.name ? `${b.date} — Bestand ersetzen? Tippe erneut.` : b.date}
                  </Type>
                </PressableScale>
              ))}
            </View>
          )}
          <PressableScale
            accessibilityLabel={showJsonImport ? 'JSON-Einfügen einklappen' : 'Backup-JSON direkt einfügen'}
            onPress={() => {
              hapticSelect();
              setShowJsonImport((v) => !v);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md }}
          >
            <Type variant="caption" tone="text3">
              Oder Backup-JSON direkt einfügen{fileBackupAvailable ? ' (ohne Fotos)' : ''}
            </Type>
            <DisclosureChevron open={showJsonImport} color={colors.text3} />
          </PressableScale>
          {showJsonImport && (<>
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
          </>)}
          {feedback && (
            <Type variant="caption" tone="text2" style={{ marginTop: Spacing.sm }}>
              {feedback}
            </Type>
          )}
        </GlassPanel>
      </Reveal>

      <Reveal delay={170}>
        <GlassPanel>
          <Type variant="heading" style={sectionStyle}>Umzug von Apple-Apps</Type>
          {deviceRemindersAvailable && (
            <>
              <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
                Holt deine offenen Apple-Erinnerungen als Aufgaben herüber — rein lesend, beliebig
                wiederholbar, ohne Duplikate.
              </Type>
              <GlassButton
                size="sm"
                accessibilityLabel="Aus Apple Erinnerungen importieren"
                onPress={() => setShowReminderImport(true)}
                style={{ marginTop: Spacing.md, alignSelf: 'flex-start' }}
              >
                <CloudDownload size={15} color="#FFFFFF" strokeWidth={2.2} />
                <Type variant="label" style={{ color: '#FFFFFF' }}>Aus Apple Erinnerungen</Type>
              </GlassButton>
              <Seam />
            </>
          )}
          <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
            Apple Notizen haben keine Schnittstelle — der Umzug geht per Kopieren &amp; Einfügen,
            Notiz für Notiz.
          </Type>
          <GlassButton
            size="sm"
            variant="secondary"
            accessibilityLabel="Notizen einfügen"
            onPress={() => setShowPasteNote(true)}
            style={{ marginTop: Spacing.md, alignSelf: 'flex-start' }}
          >
            <ClipboardPaste size={15} color={colors.teal} strokeWidth={2.2} />
            <Type variant="label" tone="teal">Notizen einfügen</Type>
          </GlassButton>
        </GlassPanel>
      </Reveal>

      <Reveal delay={190}>
        <GlassPanel>
          <Type variant="heading" style={sectionStyle}>Assistent</Type>
          <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
            Nutzt deinen eigenen Google-Gemini-Schlüssel (dauerhaft kostenloses Kontingent) — Anfragen
            gehen direkt vom Gerät an Google, ohne Mittelsmann. Schlüssel erstellen:
            aistudio.google.com/apikey. Ohne Schlüssel bleibt die App vollständig offline.
          </Type>
          <TextInput
            value={geminiApiKey}
            onChangeText={onChangeApiKey}
            placeholder="Gemini-API-Schlüssel einfügen…"
            placeholderTextColor={colors.text3}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            accessibilityLabel="Gemini-API-Schlüssel"
            style={[
              {
                marginTop: Spacing.md,
                borderRadius: R.md,
                borderWidth: 1,
                borderColor: colors.chipBorder,
                backgroundColor: colors.chip,
                padding: Spacing.sm,
                fontSize: T.sm,
                color: colors.text,
              },
              webNoOutline,
            ]}
          />
          {geminiApiKey.length > 0 && (
            <Type variant="caption" tone="teal" style={{ marginTop: Spacing.sm }}>
              Assistent aktiv — Einstieg über ✨ auf „Heute" oder aus einem Termin heraus.
            </Type>
          )}

          {geminiApiKey.length > 0 && (
            <>
              <Seam />
              <Type variant="heading" style={sectionStyle}>App-Überblick</Type>
              <Type variant="caption" tone="text3" style={{ marginTop: 2 }}>
                Der Assistent sieht bei jeder Frage Termine (~5 Wochen), offene Aufgaben, Listen und
                Notiz-Titel — so kann er „Was steht diese Woche an?" direkt beantworten. Die
                Abendbetrachtung bleibt immer außen vor.
              </Type>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm }}>
                <Chip
                  label={assistantContextEnabled ? 'An' : 'Aus'}
                  active={assistantContextEnabled}
                  onPress={() => setAssistantContextEnabled(!assistantContextEnabled)}
                />
              </View>
            </>
          )}
        </GlassPanel>
      </Reveal>

      <Reveal delay={200}>
        <Type variant="caption" tone="text3" style={{ textAlign: 'center', marginTop: Spacing.sm }}>
          Stoa · Version {appVersion}
        </Type>
      </Reveal>

      {showReminderImport && <ImportRemindersSheet onClose={() => setShowReminderImport(false)} />}
      {showPasteNote && <PasteNoteSheet onClose={() => setShowPasteNote(false)} />}
    </Screen>
  );
}
