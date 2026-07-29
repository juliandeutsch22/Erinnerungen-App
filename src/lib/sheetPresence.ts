// sheetPresence.ts — „liegt gerade etwas über dem Bildschirm?"
//
// Die EINE Zeile sitzt seit v1.55.0 auf mehreren Tabs, immer unten, immer
// absolut positioniert. Sobald ein Sheet aufgeht, hat sie dort nichts mehr zu
// suchen: Sheets sind RN-Modals und rendern in einer EIGENEN nativen
// View-Hierarchie über allem, die Zeile läge also dahinter — und würde bei
// offener Tastatur an einer unlogischen Stelle hinter dem Sheet hervorschauen.
//
// Warum ein Zähler und kein Boolean: Sheets können sich überlagern (aus einem
// Editor heraus ein zweites Sheet öffnen). Ein Boolean würde beim Schließen des
// oberen fälschlich „alles zu" melden, obwohl das untere noch steht.
//
// Warum zentral und nicht als Prop je Bildschirm: es gibt ein Dutzend Sheets
// und es werden mehr. Eine Liste von Bedingungen an vier Bildschirmen wäre
// genau die Sorte Buchhaltung, die man beim dreizehnten Sheet vergisst.
import { useEffect } from 'react';
import { create } from 'zustand';

type SheetPresence = {
  /** Wie viele Overlays gerade offen sind. */
  offen: number;
  an: () => void;
  aus: () => void;
};

export const useSheetPresence = create<SheetPresence>((set) => ({
  offen: 0,
  an: () => set((s) => ({ offen: s.offen + 1 })),
  aus: () => set((s) => ({ offen: Math.max(0, s.offen - 1) })),
}));

/**
 * Meldet ein Overlay an, solange es sichtbar ist. Gehört in JEDE Komponente,
 * die etwas über den Bildschirm legt — Sheets, Viewer, Reorder.
 *
 * Die Abmeldung läuft über die Aufräumfunktion, greift also auch dann, wenn die
 * Komponente verschwindet, ohne vorher `visible=false` zu sehen (der häufigere
 * Fall: der Bildschirm rendert das Sheet gar nicht mehr).
 */
export function useSheetRegistration(visible: boolean) {
  useEffect(() => {
    if (!visible) return;
    const { an, aus } = useSheetPresence.getState();
    an();
    return aus;
  }, [visible]);
}

/** Liegt gerade irgendein Overlay über dem Bildschirm? */
export function useSheetOffen(): boolean {
  return useSheetPresence((s) => s.offen > 0);
}
