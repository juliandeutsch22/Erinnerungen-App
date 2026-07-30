// sheetPresence.ts — „liegt gerade etwas über dem Bildschirm?" und
// „darf jetzt schon das nächste aufgehen?"
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
//
// ── Das Tor (v1.67.0) ─────────────────────────────────────────────────────
//
// Seit v1.58.2 wusste das Projekt: wer ein Sheet schließt und im SELBEN
// React-Commit das nächste öffnet, präsentiert auf iOS einen View-Controller,
// während der vorherige noch entlassen wird — im besten Fall hängt das Sheet,
// im schlechteren stürzt die App ab (§8.54). Die Gegenmaßnahme war eine
// gemerkte Regel: „an dieser Stelle 340 ms warten". Genau eine Stelle hielt
// sie ein.
//
// Eine Regel, die man an jeder neuen Aufrufstelle wieder einhalten muss, ist
// keine Lösung, sondern eine Wette. Deshalb liegt die Wartezeit jetzt HIER:
// jedes Sheet stempelt beim Verschwinden eine kurze Sperre, und jedes Sheet
// fragt beim Erscheinen, ob die Sperre schon abgelaufen ist. Wer künftig ein
// Sheet aus einem Sheet öffnet, muss nichts mehr wissen.
//
// ⚠️ Am Web-Harnisch ist der GRUND nicht sichtbar (dort sind Modals gewöhnliche
// Overlays ohne View-Controller-Lebenszyklus), die WIRKUNG aber schon: das
// zweite Sheet geht messbar später auf. Genau das prüft `scratchpad/sheets.mjs`.
import { useEffect, useState } from 'react';
import { create } from 'zustand';

/**
 * Pause zwischen dem Verschwinden eines Sheets und dem Erscheinen des nächsten.
 *
 * RN-Modals sind auf iOS echte View-Controller; `animationType="slide"` braucht
 * rund 300 ms zum Entlassen. 340 ms lassen der Animation Luft, ohne dass sich
 * die Übergabe zäh anfühlt.
 */
export const MODAL_UEBERGABE_MS = 340;

type SheetPresence = {
  /** Wie viele Overlays gerade offen sind. */
  offen: number;
  /** Bis wann kein neues Sheet präsentiert werden darf (ms seit Epoche). */
  sperreBis: number;
  an: () => void;
  aus: () => void;
  /** Ein Sheet geht — das nächste wartet. */
  sperren: () => void;
};

export const useSheetPresence = create<SheetPresence>((set) => ({
  offen: 0,
  sperreBis: 0,
  an: () => set((s) => ({ offen: s.offen + 1 })),
  aus: () => set((s) => ({ offen: Math.max(0, s.offen - 1) })),
  sperren: () => set({ sperreBis: Date.now() + MODAL_UEBERGABE_MS }),
}));

/**
 * Wie lange muss ein Sheet, das JETZT aufgehen will, noch warten?
 *
 * Rein und ohne Store, damit die Rechnung prüfbar bleibt — inklusive der
 * beiden Ränder, an denen man sich vertut: eine abgelaufene Sperre darf keine
 * negative Wartezeit ergeben, und eine Sperre aus der Zukunft (Uhr zurück-
 * gestellt) darf nicht ewig blockieren.
 */
export function restSperre(sperreBis: number, jetzt: number): number {
  const rest = sperreBis - jetzt;
  if (rest <= 0) return 0;
  return Math.min(rest, MODAL_UEBERGABE_MS);
}

/**
 * Meldet ein Overlay an, solange es sichtbar ist, UND sagt, ob es schon
 * präsentiert werden darf. Gehört in JEDE Komponente, die etwas über den
 * Bildschirm legt — Sheets, Viewer, Reorder.
 *
 * Die Abmeldung läuft über die Aufräumfunktion, greift also auch dann, wenn die
 * Komponente verschwindet, ohne vorher `visible=false` zu sehen (der häufigere
 * Fall: der Bildschirm rendert das Sheet gar nicht mehr). Dieselbe Aufräum-
 * funktion stempelt die Sperre für das nächste Sheet.
 *
 * Die Reihenfolge stimmt von selbst: React führt in einem Commit ERST alle
 * Aufräumfunktionen aus und DANN alle neuen Effekte. Schließt ein Sheet und
 * öffnet im selben Zug das nächste, ist die Sperre also schon gesetzt, wenn
 * das nächste fragt.
 */
export function useSheetTor(sichtbar: boolean): boolean {
  const [darfZeigen, setDarfZeigen] = useState(false);

  useEffect(() => {
    if (!sichtbar) {
      setDarfZeigen(false);
      return undefined;
    }
    const { an, aus, sperren } = useSheetPresence.getState();
    // Die Zeile zieht sich SOFORT zurück, auch wenn das Sheet noch wartet —
    // sonst blitzte sie in der Übergabe kurz auf.
    an();

    const warte = restSperre(useSheetPresence.getState().sperreBis, Date.now());
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (warte === 0) setDarfZeigen(true);
    else timer = setTimeout(() => setDarfZeigen(true), warte);

    return () => {
      if (timer) clearTimeout(timer);
      aus();
      sperren();
    };
  }, [sichtbar]);

  return darfZeigen;
}

/** Liegt gerade irgendein Overlay über dem Bildschirm? */
export function useSheetOffen(): boolean {
  return useSheetPresence((s) => s.offen > 0);
}
