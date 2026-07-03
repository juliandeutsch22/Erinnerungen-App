// theme.tokens.ts — Single Source of Truth (Cairn / Health-Variante)
//
// Abgeleitet aus dem VIBE-Brief, umgefärbt für den Health-Kontext (Build-Spec §7.3).
// Leitprinzip: Struktur 1:1 übernehmen, nur Akzent-Identität + Helligkeit + Glow-Dosis
// tauschen. NIE Hex/px im Komponenten-Code hardcoden — immer diese Tokens importieren.

// Typo-Größenskala
export const T = { xs: 10, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28, hero: 40 } as const;

// Spacing-Skala (großzügig = premium). Screen-Padding horizontal = Spacing.lg.
export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

// Border-Radii. Karten/Glas-Surfaces R.xl (28), Pills R.pill, Floating-Bars 28.
export const R = { xs: 8, sm: 12, md: 16, lg: 22, xl: 28, xxl: 36, pill: 999 } as const;

// ↓↓↓ DIE EINZIGEN ZWEI MARKEN-HEX (Health-Variante) ↓↓↓
const ACCENT_A = '#1FB6A6'; // primär / CTA / "vital" (ruhiges Teal)
const ACCENT_B = '#5B6CFF'; // sekundär / info (seriöses Indigo)

// Light = DEFAULT im Health-Kontext (Trust, bei Tageslicht lesbar).
// Iron Rule: genau zwei Akzentfarben, alle semantischen Slots mappen darauf.
// WICHTIG (Health): KEIN drittes Alarm-Rot — danger/warning mappen bewusst auf die Akzente.
export const lightColors = {
  teal: ACCENT_A,
  indigo: ACCENT_B,
  bg: '#F7F8F8',
  bg2: '#FFFFFF',
  bg3: '#F0F1F2',
  bg4: '#E5E6E8',
  // Chip = erhabene Glas-Well auf einer Panel-Fläche (statt flachem Grau).
  chip: 'rgba(255,255,255,0.62)',
  chipBorder: 'rgba(0,0,0,0.09)',
  border: 'rgba(0,0,0,0.09)',
  border2: 'rgba(0,0,0,0.15)',
  border3: 'rgba(0,0,0,0.26)',
  text: '#0B0B0C',
  text2: '#545458',
  text3: '#8E8E93',
  success: ACCENT_A,
  info: ACCENT_B,
  danger: ACCENT_A,
  warning: ACCENT_B,
};

// Dark = Gast (umgekehrte Gewichtung zum VIBE-Default).
export const darkColors: typeof lightColors = {
  teal: ACCENT_A,
  indigo: '#7C8AFF',
  bg: '#000000',
  bg2: '#0E1413',
  bg3: '#161B1A',
  bg4: '#1E2423',
  chip: 'rgba(255,255,255,0.07)',
  chipBorder: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.12)',
  border2: 'rgba(255,255,255,0.20)',
  border3: 'rgba(255,255,255,0.32)',
  text: '#FFFFFF',
  text2: 'rgba(255,255,255,0.70)',
  text3: 'rgba(255,255,255,0.38)',
  success: ACCENT_A,
  info: '#7C8AFF',
  danger: ACCENT_A,
  warning: '#7C8AFF',
};

export type Colors = typeof lightColors;
export type ColorToken = keyof Colors;

// Schatten-Skala. Opacity hier bewusst niedriger als im VIBE-Original
// (Light-first verträgt keine schweren Schwarzschatten). Glow = einzige Glow-Quelle,
// nur für genau EIN Hero-Element (Vitalitäts-Trend-Ring beim ersten Reveal).
export const Shadow = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 8 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.28, shadowRadius: 40, elevation: 14 },
  glow: (c: string) => ({ shadowColor: c, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8 }),
} as const;
