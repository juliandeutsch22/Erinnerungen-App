// zeileDraft.ts — was in der EINEN Zeile steht, gehört nicht dem Bildschirm.
//
// Seit v1.55.0 sitzt die Zeile auf vier Tabs. Mit lokalem State hätte jeder Tab
// seinen eigenen Entwurf: man tippt auf „Notizen" einen halben Gedanken, wechselt
// zu „Listen" — und die Zeile ist dort leer. Das wären vier Zeilen, die gleich
// aussehen, und damit genau das Gegenteil der Idee.
//
// Der Lauf (`assistantRun.ts`) liegt aus demselben Grund schon im Store. Hier
// kommt dazu, was VOR dem Abschicken im Feld steht: Text, abgewählte Chips,
// angehängte Bilder und ein etwaiges Überstimmen der Weiche.
//
// Bewusst NICHT persistiert: ein halber Satz von vorgestern beim App-Start wäre
// Müll, kein Entwurf. Der Zustand lebt, solange die App lebt.
import { create } from 'zustand';

import type { AssistantImage } from '@/lib/assistant';

/** Vom Nutzer abgewählte Parser-Funde — sie gewinnen über den Parser. */
export type Removed = { date: boolean; time: boolean; rrule: boolean };
export const NOTHING_REMOVED: Removed = { date: false, time: false, rrule: false };

type ZeileDraft = {
  text: string;
  removed: Removed;
  bilder: AssistantImage[];
  /** Gilt für genau diese Eingabe, wird beim Tippen wieder gelöst. */
  ueberstimmt: boolean;
  setText: (t: string) => void;
  setRemoved: (r: Removed | ((prev: Removed) => Removed)) => void;
  setBilder: (b: AssistantImage[] | ((prev: AssistantImage[]) => AssistantImage[])) => void;
  setUeberstimmt: (v: boolean | ((prev: boolean) => boolean)) => void;
  /** Nach dem Abschicken: alles zurück auf Anfang. */
  leeren: () => void;
};

export const useZeileDraft = create<ZeileDraft>((set) => ({
  text: '',
  removed: NOTHING_REMOVED,
  bilder: [],
  ueberstimmt: false,
  setText: (t) => set({ text: t }),
  setRemoved: (r) => set((s) => ({ removed: typeof r === 'function' ? r(s.removed) : r })),
  setBilder: (b) => set((s) => ({ bilder: typeof b === 'function' ? b(s.bilder) : b })),
  setUeberstimmt: (v) => set((s) => ({ ueberstimmt: typeof v === 'function' ? v(s.ueberstimmt) : v })),
  leeren: () => set({ text: '', removed: NOTHING_REMOVED, bilder: [], ueberstimmt: false }),
}));
