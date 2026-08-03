// contacts.ts — der EINE Weg vom iOS-Adressbuch zu einem Menschen in Stoa.
//
// Muster wie `deviceCalendar.ts`: `require` erst beim Aufruf, ein
// Verfügbarkeits-Flag davor. Im Web (und wenn das native Modul im Build fehlt)
// gibt es die Funktion schlicht nicht, statt dass etwas abstürzt.
//
// ── Zwei Entscheidungen, die den Rest bestimmen ──────────────────────────────
//
// 1. **Apples eigener Picker statt Voll-Zugriff.** `Contact.presentPicker()`
//    zeigt die Kontakte-Auswahl des Systems, die AUSSERHALB der App läuft und
//    nur den EINEN gewählten Eintrag zurückgibt. Damit braucht Stoa keine
//    Kontakte-Berechtigung für das ganze Adressbuch — es erscheint kein
//    „Stoa möchte auf deine Kontakte zugreifen". Für eine App, deren erstes
//    Versprechen „alles bleibt auf dem Gerät" ist, ist das der Unterschied
//    zwischen einer Bequemlichkeit und einem Wortbruch.
//
// 2. **Einer, nicht alle.** Es gibt bewusst KEINEN Massen-Import. Ein
//    Adressbuch hat Hunderte Einträge; die Menschen-Liste in Stoa ist für eine
//    Handvoll gedacht — die, bei denen gerade etwas liegt. Alles hineinzukippen
//    machte die Liste und die Auswahl unbrauchbar.
//
// Der Assistent rührt das hier NICHT an: er darf Menschen nach Namen zuordnen
// und (nach Bestätigung) anlegen, aber nie ins Adressbuch sehen.
import { Platform } from 'react-native';

export const contactsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/** Was Stoa aus einem Kontakt übernimmt — mehr braucht es nicht. */
export type KontaktTreffer = {
  /** Kennung des Adressbuch-Eintrags (nur Herkunft, siehe `Person.contactId`). */
  contactId: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type ContactsModul = typeof import('expo-contacts');

function mod(): ContactsModul {
  return require('expo-contacts') as ContactsModul;
}

/** Vor- und Nachname zu einem lesbaren Namen — leere Teile fallen weg. */
export function kontaktName(
  d: { fullName?: string | null; givenName?: string | null; familyName?: string | null; company?: string | null },
): string {
  const voll = (d.fullName ?? '').trim();
  if (voll) return voll;
  const teile = [d.givenName ?? '', d.familyName ?? ''].map((t) => t.trim()).filter(Boolean);
  if (teile.length > 0) return teile.join(' ');
  // Firmen ohne Personennamen (der Dachdecker-Betrieb) sind auch Menschen im
  // Sinne dieser App — jemand, bei dem etwas liegt.
  return (d.company ?? '').trim();
}

/**
 * Öffnet Apples Kontakt-Auswahl und gibt den gewählten Eintrag zurück.
 * null = abgebrochen, kein Modul, oder kein brauchbarer Name.
 *
 * Wirft nie: ein fehlgeschlagener Import darf nichts kaputt machen, und der
 * Aufrufer soll nur wissen, ob etwas herauskam.
 */
export async function kontaktWaehlen(): Promise<KontaktTreffer | null> {
  if (!contactsAvailable) return null;
  try {
    const Contacts = mod();
    const gewaehlt = await Contacts.Contact.presentPicker();
    if (!gewaehlt) return null;

    const F = Contacts.ContactField;
    const d = await gewaehlt.getDetails([F.FULL_NAME, F.GIVEN_NAME, F.FAMILY_NAME, F.COMPANY]);
    const name = kontaktName(d as Parameters<typeof kontaktName>[0]);
    if (!name) return null;

    // Nummern und Adressen einzeln nachladen: `getDetails` liefert sie zwar
    // auch, aber diese beiden Wege sind die dokumentierten und geben genau
    // die Form zurück, die hier gebraucht wird.
    const [phones, emails] = await Promise.all([gewaehlt.getPhones(), gewaehlt.getEmails()]);
    return {
      contactId: gewaehlt.id,
      name,
      // Die ERSTE Nummer — Apples Reihenfolge ist die des Nutzers, und eine
      // Auswahlliste für „welche der vier Nummern" wäre ein zweiter Dialog
      // für einen Fall, den man im Editor in zwei Sekunden von Hand ändert.
      phone: phones[0]?.number?.trim() || null,
      email: emails[0]?.address?.trim() || null,
    };
  } catch {
    return null;
  }
}
