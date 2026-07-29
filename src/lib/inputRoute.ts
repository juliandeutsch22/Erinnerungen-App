// inputRoute.ts — der Weichensteller der EINEN Zeile.
//
// Bisher musste man sich VOR dem Tippen entscheiden, welche Art von Gedanke
// man hat: Eingabezeile (anlegen), Braindump (sortieren) oder Chat (fragen).
// Diese Entscheidung ist die eigentliche Reibung — sie kommt vor dem Denken,
// nicht danach. Hier fällt sie weg: man schreibt einfach, und diese Datei
// entscheidet, wohin es geht.
//
// Zwei Ausgänge, mehr braucht es nicht. Ob eine Assistenten-Anfrage eine
// ANTWORT oder einen Aktions-Block ergibt, weiß der Assistent selbst besser
// als eine Regex — hier wird nur unterschieden, ob es der lokale Parser
// alleine schafft.
//
// Die Reihenfolge ist nicht verhandelbar: **lokal zuerst.** Der Parser
// antwortet in Mikrosekunden, ohne Netz und ohne Schlüssel. Ohne Assistenten
// bleibt die Zeile deshalb genau so nutzbar wie vorher.
import { parseQuickAdd, type QuickAddResult } from '@/lib/quickAddParser';

export type InputRoute =
  /** Der lokale Parser hat eine saubere Aufgabe erkannt — sofort anlegen. */
  | { ziel: 'lokal'; aufgabe: QuickAddResult }
  /** Alles andere: Frage, Auftrag, Suche oder ein ganzer Wurf. */
  | { ziel: 'assistent'; grund: AssistentGrund };

export type AssistentGrund = 'frage' | 'auftrag' | 'wurf' | 'kein-titel';

/** Ab hier ist es kein Einzeiler mehr, sondern ein Wurf. */
export const WURF_LAENGE = 120;

// Fragewörter NUR am Anfang: „Was steht morgen an?" ist eine Frage,
// „Kläre was mit Anna" ist eine Aufgabe. Deutsche Fragen stellen das
// Fragewort voran — das ist die verlässlichste Stelle, um es zu erkennen.
const FRAGEWORT = /^\s*(was|wann|wo|wieso|warum|weshalb|wie|wer|welche[rsnm]?|wieviel)\b/i;

// Befehle ebenfalls nur am Anfang, und aus demselben Grund: Der deutsche
// Imperativ steht vorn. „Verschieb den Zahnarzt" ist ein Auftrag —
// „Zahnarzt verschieben" ist eine Aufgabe, die man sich notiert. Diese
// Unterscheidung trägt die ganze Weiche, deshalb steht sie hier so deutlich.
const BEFEHL =
  /^\s*(verschieb\w*|schieb\w*|hak\w*|erledig\w*|streich\w*|lösch\w*|loesch\w*|entfern\w*|benenn\w*|änder\w*|aender\w*|setz\w*|mach\w*|zeig\w*|such\w*|find\w*|nenn\w*|liste\b|plan\w*|sortier\w*|fass\w*)\b/i;

/**
 * Wohin mit dieser Eingabe?
 *
 * `assistentVerfuegbar` ist die Notbremse: ohne Schlüssel gibt es nur den
 * lokalen Weg. Eine Zeile, die ohne Assistent nichts mehr täte, wäre ein
 * Rückschritt gegenüber dem Zustand vor dieser Funktion.
 */
export function routeInput(input: string, today: string, assistentVerfuegbar: boolean): InputRoute {
  const roh = input.trim();
  const aufgabe = parseQuickAdd(roh, today);

  if (!assistentVerfuegbar) return { ziel: 'lokal', aufgabe };

  // Bleibt nach dem Parsen kein Titel übrig („morgen 10 Uhr"), gäbe es nichts
  // anzulegen — dann soll wenigstens jemand hinsehen.
  if (aufgabe.title.length === 0) return { ziel: 'assistent', grund: 'kein-titel' };

  if (roh.endsWith('?') || FRAGEWORT.test(roh)) return { ziel: 'assistent', grund: 'frage' };
  if (BEFEHL.test(roh)) return { ziel: 'assistent', grund: 'auftrag' };
  // Mehrere Zeilen oder ein langer Absatz sind ein Wurf, kein Einzeiler.
  if (roh.includes('\n') || roh.length > WURF_LAENGE) return { ziel: 'assistent', grund: 'wurf' };

  return { ziel: 'lokal', aufgabe };
}

/**
 * Drei Vorschläge für die leere Zeile — rein LOKAL abgeleitet, ohne Netz und
 * ohne Kosten.
 *
 * Warum es sie gibt: Die Zeile kann seit v1.52.0 weit mehr, als man ihr ansieht
 * — fragen, umbuchen, sortieren. Ein Platzhalter kann das nicht erzählen, und
 * ein Tutorial will diese App nicht sein. Drei ruhige Chips zeigen es beim
 * ersten Antippen und verschwinden, sobald man selbst tippt.
 *
 * Sie sind bewusst nur so schlau wie der Bestand: „Was ist überfällig?" steht
 * nur da, wenn wirklich etwas überfällig ist. Ein Vorschlag, der ins Leere
 * führt, wäre schlimmer als keiner — er kostet Wartezeit für ein „nichts".
 */
export function zeileVorschlaege(
  offeneAufgaben: { dueDate: string | null; completedAt: string | null }[],
  today: string,
): string[] {
  const offen = offeneAufgaben.filter((t) => t.completedAt === null);
  const ueberfaellig = offen.filter((t) => t.dueDate !== null && t.dueDate < today).length;
  const heute = offen.filter((t) => t.dueDate === today).length;

  const alle: string[] = [];
  if (ueberfaellig > 0) alle.push('Was ist überfällig?');
  // Sortieren lohnt erst, wenn der Tag voll genug ist, um unübersichtlich zu sein.
  if (heute >= 4) alle.push('Sortier meinen Tag');
  alle.push('Was steht morgen an?');
  return alle.slice(0, 3);
}

/** Was die Zeile während des Wartens über sich sagt. */
export function warteText(grund: AssistentGrund): string {
  switch (grund) {
    case 'frage':
      return 'Sehe nach …';
    case 'auftrag':
      return 'Einen Moment …';
    case 'wurf':
      return 'Sortiere …';
    default:
      return 'Einen Moment …';
  }
}
