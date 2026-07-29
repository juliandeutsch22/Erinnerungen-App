// layout.ts — Layout-Konstanten. Floating-Tab-Bar ist position:absolute, daher
// MUSS jeder scrollbare Screen unten TAB_BAR_SAFE_BOTTOM Padding setzen, sonst
// verschwindet das letzte Item unter der Bar (VIBE §11).
import { Platform } from 'react-native';

export const TAB_BAR_SAFE_BOTTOM = Platform.select({ ios: 116, android: 90, default: 100 });

// Höhe der sichtbaren Bar-Fläche (ohne Safe-Area-Inset).
export const TAB_BAR_HEIGHT = 64;

// Zusätzlicher Fußraum für die EINE Zeile, die ÜBER der Tab-Bar schwebt.
// Jeder Bildschirm, der `<QuickAdd/>` zeigt, muss ihn zu TAB_BAR_SAFE_BOTTOM
// addieren — sonst verschwindet der letzte Eintrag darunter. Bemessen an der
// Pille (~58 px) plus Luft, damit auch die Chip-Reihe darüber Platz hat.
export const QUICK_ADD_CLEARANCE = 84;

// Maximale Inhaltsbreite (Web/Tablet): hält Zeilen lesbar, zentriert den Content.
export const MAX_CONTENT_WIDTH = 720;

// Web-Focus-Ring auf TextInput unterdrücken (RN-Web rendert Browser-Default-Outline).
export const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;
