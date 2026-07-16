// theme.tokens.ts — Single Source of Truth (Cairn / Health-Variante)
//
// Abgeleitet aus dem VIBE-Brief, umgefärbt für den Health-Kontext (Build-Spec §7.3).
// Leitprinzip: Struktur 1:1 übernehmen, nur Akzent-Identität + Helligkeit + Glow-Dosis
// tauschen. NIE Hex/px im Komponenten-Code hardcoden — immer diese Tokens importieren.

// Typo-Größenskala
export const T = { xs: 10, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28, hero: 40 } as const;

// Spacing-Skala (großzügig = premium). Screen-Padding horizontal = Spacing.lg.
export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

// Border-Radii — Steintafeln sind kantiger als Glas-Slabs (leicht reduziert).
export const R = { xs: 7, sm: 10, md: 13, lg: 16, xl: 18, xxl: 24, pill: 999 } as const;

// ↓↓↓ DIE EINZIGEN ZWEI MARKEN-HEX (Antikes Griechenland) ↓↓↓
// Marmor & Ägäis: gealtertes Lapis-Blau trägt die Handlung, der Oliven-Zweig
// erdet Zweitinformationen (Überfällig, Termine, Info).
const ACCENT_A = '#2B5FA6'; // primär / CTA (Santorini-Kuppel-Blau)
const ACCENT_B = '#7E8C5C'; // sekundär / info (Oliven-Zweig)

// Light = DEFAULT: Marmor/Elfenbein-Neutraltöne (nie reines Weiß — Stein).
// Iron Rule: genau zwei Akzentfarben, alle semantischen Slots mappen darauf.
// WICHTIG: KEIN drittes Alarm-Rot — danger/warning mappen bewusst auf die Akzente.
export const lightColors = {
  teal: ACCENT_A,
  indigo: ACCENT_B,
  bg: '#F4F1E8',
  bg2: '#FDFBF4',
  bg3: '#EFEBDF',
  bg4: '#E5E0D1',
  // Chip = ruhige Stein-Well auf der Marmor-Tafel (solide, kein Alpha-Weiß).
  chip: '#EFEBDE',
  chipBorder: 'rgba(50,50,40,0.12)',
  border: 'rgba(50,50,40,0.12)',
  border2: 'rgba(50,50,40,0.18)',
  border3: 'rgba(50,50,40,0.30)',
  text: '#1E1D18',
  text2: '#565349',
  text3: '#93907F',
  success: ACCENT_A,
  info: ACCENT_B,
  danger: ACCENT_A,
  warning: ACCENT_B,
};

// Dark = Nacht über der Ägäis: dunkler Schiefer-Marmor, Akzente eine Stufe
// heller, damit sie auf Dunkel genauso ruhig leuchten wie Light auf Elfenbein.
export const darkColors: typeof lightColors = {
  teal: '#7BA7DC',
  indigo: '#9DAF7E',
  bg: '#000000',
  bg2: '#101315',
  bg3: '#171B1E',
  bg4: '#1F2429',
  chip: 'rgba(255,255,255,0.07)',
  chipBorder: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.12)',
  border2: 'rgba(255,255,255,0.20)',
  border3: 'rgba(255,255,255,0.32)',
  text: '#FFFFFF',
  text2: 'rgba(255,255,255,0.70)',
  text3: 'rgba(255,255,255,0.38)',
  success: '#7BA7DC',
  info: '#9DAF7E',
  danger: '#7BA7DC',
  warning: '#9DAF7E',
};

export type Colors = typeof lightColors;
export type ColorToken = keyof Colors;

// Schatten-Skala — Steintafeln liegen flach auf dem Grund, sie schweben nicht.
// Hauchdünne Schatten; die Kante (Meißel-Grat) trägt die Plastizität.
export const Shadow = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 5, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 12, elevation: 3 },
  glow: (c: string) => ({ shadowColor: c, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 3 }),
} as const;
