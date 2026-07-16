// colorRebrand.ts — Zuordnung alter Listenfarben zur jeweils aktuellen
// Marken-Palette. Genutzt von der DB-Migration (db.ts) und vom Backup-Import.
// Die Einträge laufen als KETTE in Reihenfolge: v1.0 (Teal/Indigo) →
// v1.2 (Erdtöne) → v1.3 (Ägäis) — ein Durchlauf migriert jeden Stand.
export const COLOR_REBRAND: ReadonlyArray<readonly [string, string]> = [
  // Stufe 1: Teal/Indigo (v1.0) → Erdtöne (v1.2)
  ['#1FB6A6', '#C96A47'],
  ['#149286', '#A9532F'],
  ['#0E7C71', '#A9532F'],
  ['#5B6CFF', '#74936B'],
  ['#7C8AFF', '#4E7E9B'],
  ['#3D4ACC', '#4E7E9B'],
  // Stufe 2: Erdtöne (v1.2) → Ägäis (v1.3)
  ['#C96A47', '#2D5C8A'], // Terrakotta → Lapis
  ['#A9532F', '#1F4467'], // Ton → Tiefsee
  ['#C99A3F', '#B08A3C'], // Ocker → Ocker (gealtert)
  ['#74936B', '#7E8C5C'], // Salbei → Olive
  ['#5A7A50', '#5C6B42'], // Olive → Tiefe Olive
  ['#4E7E9B', '#4E8296'], // Meerblau → Meer-Türkis
];

/** Alte Markenfarbe → aktuelle (folgt der Kette); unbekannte bleiben. */
export function remapListColor(color: string): string {
  let c = color.toUpperCase();
  for (const [oldColor, newColor] of COLOR_REBRAND) {
    if (c === oldColor) c = newColor;
  }
  return c;
}
