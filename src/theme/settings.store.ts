// settings.store.ts — UI-/App-Settings (zustand), lokal persistiert (kvStorage:
// nativ expo-sqlite, Web localStorage). Hält Theme-/Motion-Präferenz, die
// Standard-Uhrzeit für neue Erinnerungen und die Sammel-Notification-Präferenz.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/data/kvStorage';
import type { SavedFilter } from '@/lib/taskFilters';

export type ThemePref = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'reduced' | 'full';

type SettingsState = {
  themePref: ThemePref;
  motionPref: MotionPref;
  /** Standard-Uhrzeit ('HH:MM') für neue Erinnerungen mit Datum, aber ohne explizite Zeit. */
  defaultDueTime: string;
  /** Sammel-Notification „X Dinge für heute" aktiv? (Uhrzeit: summaryTime) */
  summaryEnabled: boolean;
  summaryTime: string;
  /** Gespeicherte Smart-Filter (Feature: eigene Ansichten). */
  savedFilters: SavedFilter[];
  /** Bereits importierte Apple-Erinnerungs-IDs (Dedupe bei erneutem Import). */
  importedReminderIds: string[];
  /** Gemini-API-Schlüssel für den Assistenten (leer = Feature aus).
   *  Liegt NICHT im normalen Persist — Quelle ist die Keychain (secureKey.ts),
   *  hier nur die In-Memory-Kopie für die UI. */
  geminiApiKey: string;
  /** Zeitpunkt des letzten automatischen Backups (ISO, '' = noch nie). */
  lastAutoBackupAt: string;
  /** Tägliche Erinnerung an die Abendbetrachtung (Uhrzeit: journalReminderTime). */
  journalReminderEnabled: boolean;
  journalReminderTime: string;
  /** Assistent bekommt bei jedem Senden den App-Überblick mit
   *  (Termine/Aufgaben/Listen/Notiz-Titel — nie das Journal). */
  assistantContextEnabled: boolean;
  /** true, sobald der persistierte Zustand geladen wurde (verhindert Flash). */
  _hasHydrated: boolean;
  setThemePref: (p: ThemePref) => void;
  setMotionPref: (p: MotionPref) => void;
  setDefaultDueTime: (t: string) => void;
  setSummaryEnabled: (v: boolean) => void;
  setSummaryTime: (t: string) => void;
  addSavedFilter: (f: SavedFilter) => void;
  removeSavedFilter: (id: string) => void;
  /** Ersetzt alle Filter (Backup-Wiederherstellung). */
  setSavedFilters: (f: SavedFilter[]) => void;
  addImportedReminderIds: (ids: string[]) => void;
  setGeminiApiKey: (key: string) => void;
  setLastAutoBackupAt: (at: string) => void;
  setJournalReminderEnabled: (v: boolean) => void;
  setJournalReminderTime: (t: string) => void;
  setAssistantContextEnabled: (v: boolean) => void;
  setHasHydrated: (v: boolean) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      themePref: 'system',
      motionPref: 'system',
      defaultDueTime: '09:00',
      summaryEnabled: true,
      summaryTime: '09:00',
      savedFilters: [],
      importedReminderIds: [],
      geminiApiKey: '',
      lastAutoBackupAt: '',
      journalReminderEnabled: false,
      journalReminderTime: '21:00',
      assistantContextEnabled: true,
      _hasHydrated: false,
      setThemePref: (themePref) => set({ themePref }),
      setMotionPref: (motionPref) => set({ motionPref }),
      setDefaultDueTime: (defaultDueTime) => set({ defaultDueTime }),
      setSummaryEnabled: (summaryEnabled) => set({ summaryEnabled }),
      setSummaryTime: (summaryTime) => set({ summaryTime }),
      addSavedFilter: (f) => set((s) => ({ savedFilters: [...s.savedFilters, f] })),
      removeSavedFilter: (id) => set((s) => ({ savedFilters: s.savedFilters.filter((x) => x.id !== id) })),
      setSavedFilters: (savedFilters) => set({ savedFilters }),
      addImportedReminderIds: (ids) =>
        set((s) => ({ importedReminderIds: [...new Set([...s.importedReminderIds, ...ids])] })),
      setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey: geminiApiKey.trim() }),
      setLastAutoBackupAt: (lastAutoBackupAt) => set({ lastAutoBackupAt }),
      setJournalReminderEnabled: (journalReminderEnabled) => set({ journalReminderEnabled }),
      setJournalReminderTime: (journalReminderTime) => set({ journalReminderTime }),
      setAssistantContextEnabled: (assistantContextEnabled) => set({ assistantContextEnabled }),
      setHasHydrated: (_hasHydrated) => set({ _hasHydrated }),
    }),
    {
      name: 'stille.settings',
      storage: createJSONStorage(() => kvStorage),
      // Nur Präferenzen persistieren, nicht die (transiente) Hydration-Marke.
      partialize: (s) => ({
        themePref: s.themePref,
        motionPref: s.motionPref,
        defaultDueTime: s.defaultDueTime,
        summaryEnabled: s.summaryEnabled,
        summaryTime: s.summaryTime,
        savedFilters: s.savedFilters,
        importedReminderIds: s.importedReminderIds,
        lastAutoBackupAt: s.lastAutoBackupAt,
        journalReminderEnabled: s.journalReminderEnabled,
        journalReminderTime: s.journalReminderTime,
        assistantContextEnabled: s.assistantContextEnabled,
        // geminiApiKey bewusst NICHT persistieren — Quelle ist die Keychain.
      }),
      // state ist der rehydrierte Store inkl. Actions → kein Bezug auf useSettings
      // während der (ggf. synchronen) Erstellung nötig.
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
