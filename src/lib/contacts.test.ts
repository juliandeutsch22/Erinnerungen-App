// contacts.test.ts — der Namensbau aus einem Adressbuch-Eintrag.
//
// Mehr ist an dieser Datei nicht testbar: `Contact.presentPicker()` ist Apples
// System-Auswahl und existiert nur auf dem Gerät. Genau deshalb steckt die
// Logik, die schiefgehen KANN, in einer reinen Funktion daneben — ein Kontakt
// ohne Namen darf keinen Menschen namens „undefined undefined" erzeugen.
import { kontaktName } from './contacts';

describe('kontaktName', () => {
  it('nimmt den vollen Namen, wenn es einen gibt', () => {
    expect(kontaktName({ fullName: 'Anna Meier', givenName: 'Anna', familyName: 'Meier' })).toBe('Anna Meier');
  });

  it('setzt sonst Vor- und Nachnamen zusammen', () => {
    expect(kontaktName({ givenName: 'Anna', familyName: 'Meier' })).toBe('Anna Meier');
  });

  it('kommt mit nur einem der beiden aus', () => {
    expect(kontaktName({ givenName: 'Anna' })).toBe('Anna');
    expect(kontaktName({ familyName: 'Meier' })).toBe('Meier');
  });

  it('nimmt die Firma, wenn kein Personenname da ist', () => {
    // Der Dachdecker-Betrieb ist im Sinne dieser App auch ein Mensch:
    // jemand, bei dem etwas liegt.
    expect(kontaktName({ company: 'Bedachungen Brandt' })).toBe('Bedachungen Brandt');
  });

  it('gibt einen LEEREN Namen zurück, statt etwas zu erfinden', () => {
    // Der Aufrufer bricht daraufhin ab — lieber kein Import als ein Mensch
    // ohne Namen, den man nie wiederfindet.
    expect(kontaktName({})).toBe('');
    expect(kontaktName({ fullName: '   ', givenName: null, familyName: null })).toBe('');
  });

  it('putzt Leerraum weg — auch zwischen den Teilen', () => {
    expect(kontaktName({ givenName: '  Anna ', familyName: ' Meier  ' })).toBe('Anna Meier');
    expect(kontaktName({ fullName: '  Anna Meier  ' })).toBe('Anna Meier');
  });
});
