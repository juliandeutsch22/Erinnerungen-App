// schluessel.ts — wo der Gemini-Schlüssel herkommt und wann man den Weg zeigt.
//
// Bewusst OHNE React/Expo-Import: die Entscheidung „lohnt hier ein Weg zum
// Schlüssel?" ist reine Logik und wird an fünf Stellen getroffen. Läge sie in
// der Komponente, ließe sie sich nur über einen Renderer prüfen — und genau
// solche Prädikate sind es, die still kaputtgehen, wenn jemand einen Satz
// umformuliert. Die Darstellung liegt in `components/SchluesselWeg.tsx`.
//
// Der Schlüssel selbst kommt hier NIE vor: er lebt im Keychain (secureKey.ts).
// Hier steht nur die Adresse, an der man einen bekommt.

/** Wo der Schlüssel entsteht. Einzige Quelle dieser Adresse in der App. */
export const SCHLUESSEL_URL = 'https://aistudio.google.com/apikey';

/**
 * Redet eine Meldung vom Schlüssel? Dann lohnt der Weg dorthin.
 *
 * Bewusst am deutschen Wort und nicht am HTTP-Status: die Meldung ist das,
 * was der Nutzer sieht, und sie kommt inzwischen aus mehreren Quellen
 * (`describeError`, Anlege-Fehler, abgebrochene Läufe) — der Status ist an den
 * Anzeigestellen längst weg.
 *
 * Ein erschöpftes Kontingent (429) nennt zwar „Gratis-Schlüssel", aber dort
 * hilft kein neuer Schlüssel, sondern Warten. Ein Knopf „Schlüssel erstellen"
 * wäre da ein falscher Rat — deshalb fällt der Fall heraus.
 */
export function betrifftSchluessel(meldung: string | null | undefined): boolean {
  if (!meldung) return false;
  if (meldung.includes('Kontingent')) return false;
  return meldung.includes('Schlüssel');
}
