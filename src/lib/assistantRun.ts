// assistantRun.ts — laufende Assistenten-Anfragen leben AUSSERHALB der
// Bildschirme. Damit bricht nichts mehr ab, wenn man den Braindump verlässt,
// um in der Wartezeit etwas anderes zu tun; man kommt zurück und die Antwort
// liegt da.
//
// ⚠️ Historie, damit sie niemand falsch liest: Genau das gab es schon einmal
// (v1.24.0) und wurde in v1.24.1 zurückgenommen, weil es im Verdacht stand,
// den Chat am Gerät abstürzen zu lassen. Der Verdacht war FALSCH — die Ursache
// war ein `Easing` aus react-native in einem Reanimated-Worklet
// (motion.tokens.ts, gefunden und behoben in v1.27.2). Der Grund für die
// Rücknahme besteht also nicht mehr.
//
// Warum das trotzdem sicher ist: Die laufende Funktion schreibt AUSSCHLIESSLICH
// in diesen Store, nie in Komponenten-State. Ein unmontierter Bildschirm ist
// damit kein Sonderfall mehr, sondern schlicht ein Leser, der gerade nicht da
// ist. Bewusst NICHT persistiert: ein Lauf überlebt keinen App-Neustart, und
// das soll er auch nicht — eine halb fertige Anfrage nach einem Kaltstart
// fortzusetzen wäre eine Lüge.
import { create } from 'zustand';

import type { AssistantAction } from '@/lib/assistant';
import type { Wechsel } from '@/lib/zeileVerlauf';

export type RunStatus = 'running' | 'done' | 'error';

export type AssistantRun = {
  /** Womit der Lauf beschriftet wird, wenn anderswo darauf hingewiesen wird. */
  label: string;
  /** Die Eingabe, aus der der Lauf entstand (Braindump-Text, Transkript).
   *  Sie gehört in den Lauf, nicht in den Bildschirm: sonst überlebt zwar die
   *  ANTWORT das Verlassen, aber der abgetippte Wurf ist weg — und scheitert
   *  der Lauf, steht man vor einem leeren Feld und hat alles verloren. */
  input: string;
  status: RunStatus;
  /** Bisher eingetroffener Text (Streaming) — nur für die Wartezeit. */
  stream: string;
  /** Antworttext OHNE Aktions-Block. */
  clean: string;
  actions: AssistantAction | null;
  error: string | null;
  startedAt: number;
  /**
   * Abgeschlossene Runden VOR dieser Anfrage (nur die EINE Zeile benutzt das).
   *
   * Er hängt am Lauf und nicht am Bildschirm, damit er dasselbe Schicksal
   * teilt: `clear()` — also Karte schließen oder „Übernehmen" — räumt ihn mit
   * weg. Genau das macht es zu einer RUNDE und nicht zu einem Chat.
   */
  verlauf: Wechsel[];
};

/** Feste Schlüssel für die Bildschirme mit genau einem Lauf. */
export const RUN_BRAINDUMP = 'braindump';
export const RUN_VERWALTER = 'verwalter';
export const RUN_QUICKVOICE = 'quickvoice';
/** Die EINE Zeile über der Tab-Leiste. */
export const RUN_ZEILE = 'zeile';
/** Chats haben je einen eigenen Lauf. */
export const runKeyForChat = (chatId: string) => `chat:${chatId}`;

type RunStore = {
  runs: Record<string, AssistantRun>;
  begin: (key: string, label: string, input?: string, verlauf?: Wechsel[]) => void;
  delta: (key: string, text: string) => void;
  finish: (key: string, result: { clean: string; actions: AssistantAction | null }) => void;
  fail: (key: string, message: string) => void;
  clear: (key: string) => void;
};

export const useAssistantRuns = create<RunStore>((set) => ({
  runs: {},
  begin: (key, label, input = '', verlauf = []) =>
    set((s) => ({
      runs: {
        ...s.runs,
        [key]: { label, input, status: 'running', stream: '', clean: '', actions: null, error: null, startedAt: Date.now(), verlauf },
      },
    })),
  delta: (key, text) =>
    set((s) => {
      const run = s.runs[key];
      // Nach einem clear() kann noch ein Delta eintrudeln — dann nichts tun,
      // statt einen Geister-Lauf wiederzubeleben.
      if (!run || run.status !== 'running') return {};
      return { runs: { ...s.runs, [key]: { ...run, stream: run.stream + text } } };
    }),
  finish: (key, result) =>
    set((s) => {
      const run = s.runs[key];
      if (!run) return {};
      return { runs: { ...s.runs, [key]: { ...run, status: 'done', stream: '', ...result } } };
    }),
  fail: (key, message) =>
    set((s) => {
      const run = s.runs[key];
      if (!run) return {};
      return { runs: { ...s.runs, [key]: { ...run, status: 'error', stream: '', error: message } } };
    }),
  clear: (key) =>
    set((s) => {
      const { [key]: _weg, ...rest } = s.runs;
      return { runs: rest };
    }),
}));

/** Läuft gerade irgendetwas? Für den stillen Hinweis auf „Heute". */
export function anyRunning(runs: Record<string, AssistantRun>): boolean {
  return Object.values(runs).some((r) => r.status === 'running');
}

/** Was liegt fertig da, ohne dass man hingesehen hat? */
export function labelsOfRunning(runs: Record<string, AssistantRun>): string[] {
  return Object.values(runs)
    .filter((r) => r.status === 'running')
    .map((r) => r.label);
}
