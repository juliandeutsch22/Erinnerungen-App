// verwalter.ts — „Die Woche ansehen": der Assistent legt einen fertigen
// Entwurf vor, statt auf Eingaben zu warten. Er liest den App-Überblick
// (Termine, offene Aufgaben, Projekte samt Deadlines), sagt in wenigen Sätzen,
// wo es klemmt, und schlägt konkrete Verschiebungen vor — jede davon über die
// Bestätigungskarte, nichts passiert von allein.
//
// Die Leitplanke „kein Druck" ist hier am empfindlichsten: Ein Wochenrückblick
// kippt schnell in Bewertung („du hast nur 40 % geschafft"). Deshalb steht im
// Prompt ausdrücklich, dass NICHT gezählt und nicht beurteilt wird — es geht um
// das, was NÄCHSTE Woche nicht aufgeht, nicht um das, was letzte Woche war.
import { addDays, parseDateStr } from '@/lib/dates';

/** Das Fenster, über das der Verwalter spricht: heute + die nächsten 7 Tage. */
export function weekWindow(today: string): { von: string; bis: string; label: string } {
  const bis = addDays(today, 7);
  const fmt = (d: string) =>
    parseDateStr(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  return { von: today, bis, label: `${fmt(today)} bis ${fmt(bis)}` };
}

/**
 * Sonntag ist der natürliche Moment für den Ausblick — der Einstieg auf „Heute"
 * zeigt sich deshalb sonntags und montags früh. An allen anderen Tagen bleibt er
 * verborgen (erreichbar bleibt er immer über den Assistenten-Bildschirm): eine
 * Einladung, die jeden Tag dasteht, ist eine Mahnung.
 */
export function weekReviewDue(today: string, hour: number): boolean {
  const wd = parseDateStr(today).getDay(); // 0 = Sonntag, 1 = Montag
  if (wd === 0) return true;
  return wd === 1 && hour < 12;
}

/** Der Auftrag an den Assistenten. Der App-Überblick kommt separat dazu. */
export function buildWeekPlanContext(today: string): string {
  const { label } = weekWindow(today);
  return (
    `Heute ist ${parseDateStr(today).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${today}). ` +
    `Der Nutzer bittet dich um einen Blick auf die kommende Woche (${label}). ` +
    'Sieh dir den App-Überblick an und schreibe HÖCHSTENS fünf kurze Beobachtungen — ' +
    'je eine Zeile, ohne Aufzählungszeichen-Wüste, in ruhigem Deutsch. ' +
    'Sag, wo es eng wird, was ohne Datum liegen geblieben ist, welche Projekt-Deadline näher ' +
    'rückt als der Stand der Aufgaben, und was sich sinnvoll verschieben lässt. ' +
    // Der Kern der Leitplanke: nach vorn schauen, nicht bewerten.
    'WICHTIG: Zähle nichts aus und bewerte nicht. Keine Prozente, keine Quoten, kein „du hast ' +
    'nur …", kein Lob und kein Tadel. Es geht um das, was NÄCHSTE Woche nicht aufgeht — nicht ' +
    'darum, wie der Nutzer ist. Wenn die Woche ruhig aussieht, sag genau das in einem Satz. ' +
    'Hänge dann den stoa-aktionen-Block an mit dem, was du konkret vorschlägst: ' +
    '"aenderungen" für Verschiebungen bestehender Aufgaben (nur Handles aus dem Überblick), ' +
    '"aufgaben" nur für Dinge, die offensichtlich fehlen. ' +
    'Schlage NICHTS vor, was du nicht begründet hast — jede Änderung im Block muss zu einer ' +
    'deiner Zeilen gehören. Erledigtes hakt der Nutzer selbst ab; schlage kein "erledigt" vor. ' +
    'Nichts in den Papierkorb ohne einen klaren Grund im Text.'
  );
}
