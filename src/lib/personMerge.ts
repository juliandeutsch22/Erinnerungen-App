// personMerge.ts — trifft EINE Person auf einen zweiten Eintrag desselben
// Namens: welche ist gemeint, und was bekommt sie nachgereicht?
//
// Warum das hier als reine Funktion liegt und nicht im Hook, wo es entstand:
// an dieser Logik hängt die ganze Rechtfertigung dafür, dass es ZWEI Wege zu
// einer Person gibt. Der schnelle Weg im Aufgaben- oder Termin-Editor legt nur
// einen Namen an. Das ist nur dann keine Sackgasse, wenn derselbe Name später
// — beim Import aus dem Adressbuch oder im Personen-Editor — dieselbe Person
// FINDET und ihr Nummer und E-Mail nachreicht, statt eine zweite anzulegen.
// Eine Behauptung, die eine App trägt, gehört getestet.
import type { NewPerson, Person } from '@/data/types';
import { normalizePersonName } from '@/data/types';

/**
 * Wen meint dieser Eintrag? Die Adressbuch-Herkunft schlägt den Namen: derselbe
 * Kontakt zweimal importiert bleibt EINE Person, auch wenn er im Adressbuch
 * inzwischen anders heißt (Heirat, Tippfehler, Firma umbenannt).
 */
export function findePerson(alle: Person[], input: NewPerson): Person | undefined {
  const ueberHerkunft = input.contactId ? alle.find((p) => p.contactId === input.contactId) : undefined;
  if (ueberHerkunft) return ueberHerkunft;
  const name = normalizePersonName(input.name);
  return alle.find((p) => normalizePersonName(p.name) === name);
}

/**
 * Was fehlt der vorhandenen Person noch? Nur LEERE Felder werden gefüllt —
 * was schon dasteht, hat der Nutzer getippt und gehört ihm. Ein leeres Ergebnis
 * heißt: nichts zu tun.
 *
 * Der Name steht bewusst NICHT darin. Ihn zu übernehmen hieße, dass ein Import
 * eine von Hand gepflegte Schreibweise überschreibt („Papa" würde zu „Hans-
 * Jürgen Deutsch") — im Personen-Editor tut das der Import ausdrücklich, weil
 * man den Kontakt dort gerade ausgesucht hat, aber nicht hier im Vorbeigehen.
 */
export function personNachtrag(vorhanden: Person, input: NewPerson): Partial<Omit<Person, 'id'>> {
  const nachtrag: Partial<Omit<Person, 'id'>> = {};
  if (!vorhanden.phone && input.phone) nachtrag.phone = input.phone;
  if (!vorhanden.email && input.email) nachtrag.email = input.email;
  if (!vorhanden.contactId && input.contactId) nachtrag.contactId = input.contactId;
  if (!vorhanden.note && input.note) nachtrag.note = input.note;
  return nachtrag;
}
