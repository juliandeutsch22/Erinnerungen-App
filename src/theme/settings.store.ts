// settings.store.ts — UI-/App-Settings (zustand), lokal persistiert (kvStorage:
// nativ expo-sqlite, Web localStorage). Hält Theme-/Motion-Präferenz, die
// Standard-Uhrzeit für neue Erinnerungen und die Sammel-Notification-Präferenz.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/data/kvStorage';

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
  /** true, sobald der persistierte Zustand geladen wurde (verhindert Flash). */
  _hasHydrated: boolean;
  setThemePref: (p: ThemePref) => void;
  setMotionPref: (p: MotionPref) => void;
  setDefaultDueTime: (t: string) => void;
  setSummaryEnabled: (v: boolean) => void;
  setSummaryTime: (t: string) => void;
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
      _hasHydrated: false,
      setThemePref: (themePref) => set({ themePref }),
      setMotionPref: (motionPref) => set({ motionPref }),
      setDefaultDueTime: (defaultDueTime) => set({ defaultDueTime }),
      setSummaryEnabled: (summaryEnabled) => set({ summaryEnabled }),
      setSummaryTime: (summaryTime) => set({ summaryTime }),
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
      }),
      // state ist der rehydrierte Store inkl. Actions → kein Bezug auf useSettings
      // während der (ggf. synchronen) Erstellung nötig.
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
