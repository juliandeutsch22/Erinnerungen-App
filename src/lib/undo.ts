// undo.ts — EIN Schritt zurück.
//
// Warum es das braucht: Abhaken, in den Papierkorb legen und „Überfällige auf
// heute holen" passieren mit EINEM Tipp, und zwei davon fassen mehrere Aufgaben
// auf einmal an. Bisher gab es dafür nur den Papierkorb (und für ein
// versehentlich abgehaktes Wiederholungs-Datum gar nichts) — man musste von
// Hand rekonstruieren, was man gerade angerichtet hat.
//
// Bewusst nur EIN Schritt und ohne Verlauf: Ein Undo-Stapel lädt zum
// Herumprobieren ein, und genau das soll diese App nicht sein. Es ist ein
// Sicherheitsnetz für den Fehlgriff, keine Zeitmaschine.
//
// Ebenfalls bewusst NICHT rückgängig zu machen: das Übernehmen von
// Assistenten-Vorschlägen. Das ist kein Fehlgriff, sondern eine bestätigte
// Handlung — sie hat ihre eigene Bremse in der Vorschlagskarte.
import { create } from 'zustand';

/** Wie lange das Angebot stehen bleibt. Lang genug zum Lesen, kurz genug,
 *  dass es nicht im Weg steht. */
export const UNDO_MS = 6000;

export type UndoEntry = {
  /** Was rückgängig gemacht würde — im Perfekt, so wie es passiert ist. */
  label: string;
  run: () => Promise<void> | void;
  /** Zeitstempel; die Leiste blendet sich danach selbst aus. */
  at: number;
};

type UndoStore = {
  entry: UndoEntry | null;
  remember: (label: string, run: () => Promise<void> | void) => void;
  clear: () => void;
};

export const useUndo = create<UndoStore>((set) => ({
  entry: null,
  remember: (label, run) => set({ entry: { label, run, at: Date.now() } }),
  clear: () => set({ entry: null }),
}));

/**
 * Einen rückgängig machbaren Schritt merken. Bewusst als freie Funktion und
 * nicht als Hook: gerufen wird sie aus den Mutationen in data/queries.ts, also
 * außerhalb der React-Baumstruktur.
 */
export function rememberUndo(label: string, run: () => Promise<void> | void): void {
  useUndo.getState().remember(label, run);
}

/** Nach dem Ausführen ist das Angebot verbraucht — auch wenn es schiefging,
 *  denn ein zweiter Versuch träfe auf einen anderen Stand. */
export async function runUndo(): Promise<void> {
  const { entry, clear } = useUndo.getState();
  clear();
  await entry?.run();
}
