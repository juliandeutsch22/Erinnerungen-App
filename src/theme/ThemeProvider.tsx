// ThemeProvider.tsx — stellt das aufgelöste Farbschema bereit.
//
// Health-Kontext: LIGHT-first. `system` löst zu Light auf, solange das OS nicht
// explizit dark meldet — aber der bewusste Default bleibt Light (Trust).
import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useReducedMotion as useRNReducedMotion } from 'react-native-reanimated';

import { Colors, darkColors, lightColors } from './theme.tokens';
import { useSettings } from './settings.store';

type Scheme = 'light' | 'dark';

type ThemeContextValue = {
  scheme: Scheme;
  colors: Colors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const osScheme = useRNColorScheme();
  const themePref = useSettings((s) => s.themePref);

  const scheme: Scheme = useMemo(() => {
    if (themePref === 'light') return 'light';
    if (themePref === 'dark') return 'dark';
    // 'system': Light-first im Health-Kontext — nur echtes OS-Dark schiebt nach dark.
    return osScheme === 'dark' ? 'dark' : 'light';
  }, [themePref, osScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, colors: scheme === 'dark' ? darkColors : lightColors }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/** Liefert die aufgelöste Farbpalette. Primärer Hook für Komponenten. */
export function useColors(): Colors {
  return useTheme().colors;
}

export function useScheme(): Scheme {
  return useTheme().scheme;
}

/**
 * Reduced Motion = OS-Pref ODER In-App-Setting (Build-Spec / VIBE §8).
 * Gate Bewegung + Partikel dahinter; Opacity/Color-Transitions dürfen bleiben.
 */
export function useReducedMotion(): boolean {
  const osReduced = useRNReducedMotion();
  const motionPref = useSettings((s) => s.motionPref);
  if (motionPref === 'reduced') return true;
  if (motionPref === 'full') return false;
  return osReduced;
}
