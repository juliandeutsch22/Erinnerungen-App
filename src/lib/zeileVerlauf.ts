// zeileVerlauf.ts — das Gedächtnis der EINEN Zeile, streng begrenzt.
//
// Bis v1.58 war jede Anfrage ein Einzelschuss: „Verschieb den Zahnarzt" →
// „welchen, du hast zwei?" konnte der Assistent gar nicht fragen, weil die
// Antwort darauf ihn ohne jeden Zusammenhang erreicht hätte. Das war die
// letzte offene Lücke von „Eine Zeile für alles".
//
// Es ist BEWUSST kein Chat geworden. Ein Chat hat einen Verlauf, den man
// pflegt, wiederfindet, löscht — dafür gibt es den Chat-Bildschirm. Hier geht
// es um eine RUNDE: man fragt nach, bekommt eine Antwort, und wenn die Karte
// zugeht, ist die Runde vorbei. Deshalb:
//
//  · Der Verlauf lebt im LAUF (`assistantRun`), nicht im Bildschirm und nicht
//    auf der Platte. Schließen der Karte oder „Übernehmen" räumt ihn mit weg.
//  · Er ist auf `VERLAUF_MAX` Runden gedeckelt. Was älter ist, fällt hinten
//    raus — sonst wächst jede Nachfrage die Wartezeit und das Kontingent.
//  · Bilder gehen NIE in den Verlauf. Sie gelten für genau die eine Anfrage,
//    zu der sie angehängt wurden (siehe `assistantImage.ts`).
import type { ChatMessage } from '@/data/types';

/** Eine abgeschlossene Runde: was gefragt wurde und was zurückkam. */
export type Wechsel = { frage: string; antwort: string };

/**
 * Wie viele Runden mitgehen. Drei ist die Grenze, ab der es ein Gespräch wäre
 * und kein Nachhaken mehr — und drei reichen für den Fall, für den es das gibt
 * („welchen?" → „den beim Zahnarzt" → „und den Termin auch verschieben?").
 */
export const VERLAUF_MAX = 3;

/** Höchstens so viele Vorschläge werden im Verlauf einzeln benannt. */
const VORSCHLAG_MAX = 8;

/**
 * Was der Assistent gesagt hat — so, wie es für die nächste Runde nützlich ist.
 *
 * Der rohe Aktions-Block geht NICHT zurück: er würde das Modell einladen, ihn
 * wortgleich zu wiederholen, und er kostet viel für wenig. Stattdessen eine
 * Zeile in der Sprache der App — genau das, was auch auf der Karte steht, samt
 * der Änderungen, die der Nutzer inzwischen daran vorgenommen hat.
 */
export function verlaufAntwort(
  clean: string,
  vorschlaege: { titel: string; unter?: string; art: string }[],
): string {
  const teile: string[] = [];
  const prosa = clean.trim();
  if (prosa.length > 0) teile.push(prosa);

  if (vorschlaege.length > 0) {
    const gezeigt = vorschlaege.slice(0, VORSCHLAG_MAX);
    const rest = vorschlaege.length - gezeigt.length;
    const liste = gezeigt.map((v) => `${v.art} „${v.titel}"${v.unter ? ` (${v.unter})` : ''}`).join('; ');
    teile.push(`Vorgeschlagen: ${liste}${rest > 0 ? ` … und ${rest} weitere` : ''}.`);
  }

  // Leer bleibt leer — eine erfundene Antwort wäre schlimmer als gar keine.
  return teile.join('\n\n');
}

/**
 * Die Nachrichtenkette für die nächste Anfrage: die letzten Runden, dann die
 * neue Frage. Die IDs sind Attrappen — `askAssistant` benutzt nur `role` und
 * `content`, und ein Lauf der Zeile legt bewusst keinen Chat an.
 */
export function verlaufNachrichten(verlauf: Wechsel[], neueFrage: string): ChatMessage[] {
  const jetzt = new Date().toISOString();
  const bau = (role: 'user' | 'assistant', content: string, i: number): ChatMessage => ({
    id: `zeile-${i}`,
    chatId: 'zeile',
    role,
    content,
    createdAt: jetzt,
  });

  const gekappt = verlauf.slice(-VERLAUF_MAX);
  const nachrichten: ChatMessage[] = [];
  for (const [i, w] of gekappt.entries()) {
    nachrichten.push(bau('user', w.frage, i * 2));
    nachrichten.push(bau('assistant', w.antwort, i * 2 + 1));
  }
  nachrichten.push(bau('user', neueFrage, gekappt.length * 2));
  return nachrichten;
}

/**
 * Den Verlauf um die gerade beendete Runde ergänzen — und dabei kappen.
 *
 * Eine Runde ohne Antwort wird NICHT aufgenommen: ein leerer Assistenten-Zug
 * im Verlauf verwirrt das Modell mehr, als er hilft.
 */
export function verlaufErweitern(bisher: Wechsel[], frage: string, antwort: string): Wechsel[] {
  if (frage.trim().length === 0 || antwort.trim().length === 0) return bisher.slice(-VERLAUF_MAX);
  return [...bisher, { frage: frage.trim(), antwort: antwort.trim() }].slice(-VERLAUF_MAX);
}
