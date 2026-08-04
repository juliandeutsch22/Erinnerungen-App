// personen.ts — alles Reine rund um Personen: welche ist gemeint, was
// bekommt sie nachgereicht, welche zeigt man, und in welcher Reihenfolge.
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

/** Was bei einer Person liegt — die Zahlen, die im Listen-Tab an ihr stehen. */
export type PersonLast = { wartend: number; offen: number };

/**
 * Ordnet Personen für den Listen-Tab: erst die, bei denen etwas liegt, darunter
 * die zuletzt angelegten.
 *
 * Der Abschnitt beantwortet „was liegt bei wem?", und wer nichts offen hat, ist
 * darauf keine Antwort — deshalb nach hinten. Wartendes wiegt schwerer als
 * Offenes: es ist das, woran man selbst nicht weiterarbeiten kann.
 *
 * Unter den Stillen steht die JÜNGSTE oben. Das ist kein Schmuck, sondern
 * verhindert einen Stolperstein: legt man eine Person an und hat ihr noch
 * nichts zugeordnet, wäre sie sonst hinter allen älteren gelandet — also
 * unsichtbar, weil der Abschnitt gekürzt wird. Man legt sie an und sie ist weg.
 */
export function ordnePersonen(alle: Person[], last: Map<string, PersonLast>): Person[] {
  const gewicht = (p: Person) => {
    const l = last.get(p.id);
    if (!l) return 0;
    return l.wartend * 1000 + l.offen;
  };
  return [...alle].sort((a, b) => {
    const d = gewicht(b) - gewicht(a);
    if (d !== 0) return d;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
}

/**
 * Wen meint dieser getippte Text? Dieselbe Frage wie unten, nur unentschieden:
 * beim Tippen weiß man noch nicht, ob eine Person gemeint ist, die es gibt,
 * oder eine, die es gleich geben soll.
 *
 * Gesucht wird in Name UND Notiz — genau wie im Suche-Tab. „Dachdecker" findet
 * Herrn Brandt auch dann, wenn einem gerade nur einfällt, WAS er ist.
 */
export function filterPersonen(alle: Person[], suche: string): Person[] {
  const q = suche.trim().toLowerCase();
  if (!q) return alle;
  return alle.filter((p) => `${p.name} ${p.note ?? ''}`.toLowerCase().includes(q));
}

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
 * Kürzt eine ungefilterte Liste auf ein erträgliches Maß — was gewählt ist,
 * bleibt IMMER sichtbar, sonst könnte man es nicht mehr lösen.
 *
 * Gibt `[gezeigt, versteckt]` zurück. Bei einer Suche wird nicht gekürzt: wer
 * tippt, hat schon selbst gekürzt.
 */
export function kuerzePersonen(treffer: Person[], gewaehlt: Set<string>, grenze: number): [Person[], number] {
  if (treffer.length <= grenze) return [treffer, 0];
  const kopf = treffer.slice(0, grenze);
  const fehlende = treffer.slice(grenze).filter((p) => gewaehlt.has(p.id));
  const gezeigt = [...kopf, ...fehlende];
  return [gezeigt, treffer.length - gezeigt.length];
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
