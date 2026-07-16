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

// ↓↓↓ DIE EINZIGEN ZWEI MARKEN-HEX (Mediterran-Variante) ↓↓↓
// Erdig-warm wie Ton und Olivenbaum: Terrakotta trägt die Handlung,
// Salbei erdet Zweitinformationen (Überfällig, Termine, Info).
const ACCENT_A = '#C96A47'; // primär / CTA (warmes Terrakotta)
const ACCENT_B = '#74936B'; // sekundär / info (ruhiger Salbei)

// Light = DEFAULT (Trust, bei Tageslicht lesbar). Neutraltöne bewusst warm
// (Sand/Creme statt Blaugrau) — die halbe Wärme steckt im Grund, nicht im Akzent.
// Iron Rule: genau zwei Akzentfarben, alle semantischen Slots mappen darauf.
// WICHTIG: KEIN drittes Alarm-Rot — danger/warning mappen bewusst auf die Akzente.
export const lightColors = {
  teal: ACCENT_A,
  indigo: ACCENT_B,
  bg: '#F8F4EE',
  bg2: '#FFFFFF',
  bg3: '#F1EBE2',
  bg4: '#E7DFD3',
  // Chip = erhabene Glas-Well auf einer Panel-Fläche (statt flachem Grau).
  chip: 'rgba(255,255,255,0.62)',
  chipBorder: 'rgba(60,40,20,0.10)',
  border: 'rgba(60,40,20,0.10)',
  border2: 'rgba(60,40,20,0.16)',
  border3: 'rgba(60,40,20,0.28)',
  text: '#171210',
  text2: '#5A5148',
  text3: '#98908A',
  success: ACCENT_A,
  info: ACCENT_B,
  danger: ACCENT_A,
  warning: ACCENT_B,
};

// Dark = Gast: warme Erd-Dunkeltöne statt Grün-Schwarz; Akzente eine Stufe
// heller, damit sie auf Dunkel genauso ruhig leuchten wie Light auf Creme.
export const darkColors: typeof lightColors = {
  teal: '#DA8158',
  indigo: '#95B187',
  bg: '#000000',
  bg2: '#15100C',
  bg3: '#1C1712',
  bg4: '#251E17',
  chip: 'rgba(255,255,255,0.07)',
  chipBorder: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.12)',
  border2: 'rgba(255,255,255,0.20)',
  border3: 'rgba(255,255,255,0.32)',
  text: '#FFFFFF',
  text2: 'rgba(255,255,255,0.70)',
  text3: 'rgba(255,255,255,0.38)',
  success: '#DA8158',
  info: '#95B187',
  danger: '#DA8158',
  warning: '#95B187',
};

export type Colors = typeof lightColors;
export type ColorToken = keyof Colors;

// Schatten-Skala — mediterran flach: Flächen liegen wie Keramik auf dem Tisch,
// sie schweben nicht in einer Vitrine. Weiche, kurze Schatten statt tiefer Drops.
export const Shadow = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 5 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 26, elevation: 9 },
  glow: (c: string) => ({ shadowColor: c, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.32, shadowRadius: 18, elevation: 6 }),
} as const;
