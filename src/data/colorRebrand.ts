// colorRebrand.ts — Zuordnung der alten Teal/Indigo-Listenfarben zur
// mediterranen Erdton-Palette (v1.2). Genutzt von der DB-Migration (db.ts)
// und vom Backup-Import, damit auch alte Backups warm ankommen.
export const COLOR_REBRAND: ReadonlyArray<readonly [string, string]> = [
  ['#1FB6A6', '#C96A47'], // Teal → Terrakotta
  ['#149286', '#A9532F'], // dunkles Teal → Ton
  ['#0E7C71', '#A9532F'], // tiefstes Teal → Ton
  ['#5B6CFF', '#74936B'], // Indigo → Salbei
  ['#7C8AFF', '#4E7E9B'], // helles Indigo → Meerblau
  ['#3D4ACC', '#4E7E9B'], // tiefes Indigo → Meerblau
];

const MAP = new Map(COLOR_REBRAND);

/** Alte Markenfarbe → neue; unbekannte Farben bleiben unverändert. */
export function remapListColor(color: string): string {
  return MAP.get(color.toUpperCase()) ?? color;
}
