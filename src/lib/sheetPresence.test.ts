// sheetPresence.test.ts — die Rechnung hinter dem Tor.
//
// Warum es das gibt: die Wartezeit zwischen zwei Sheets ist der Unterschied
// zwischen „geht auf" und „stürzt ab" (§8.54/§8.63), und sie lässt sich am
// Web-Harnisch nur in ihrer Wirkung messen, nicht in ihrer Ursache. Die
// Rechnung selbst gehört deshalb hierher, mit beiden Rändern, an denen man
// sich vertut.
import { MODAL_UEBERGABE_MS, restSperre, useSheetPresence } from './sheetPresence';

describe('restSperre', () => {
  it('lässt sofort durch, wenn nie gesperrt wurde', () => {
    expect(restSperre(0, 1_000_000)).toBe(0);
  });

  it('lässt sofort durch, wenn die Sperre abgelaufen ist', () => {
    expect(restSperre(1_000_000, 1_000_001)).toBe(0);
    // Genau auf der Kante ist sie vorbei, nicht „gleich vorbei".
    expect(restSperre(1_000_000, 1_000_000)).toBe(0);
  });

  it('gibt die Restzeit zurück, solange die Sperre läuft', () => {
    expect(restSperre(1_000_340, 1_000_000)).toBe(340);
    expect(restSperre(1_000_340, 1_000_200)).toBe(140);
  });

  it('wartet NIE länger als eine Übergabe — auch bei verstellter Uhr', () => {
    // Wird die Systemzeit zurückgestellt, läge `sperreBis` weit in der
    // Zukunft. Ohne Deckel bliebe das nächste Sheet minutenlang unsichtbar,
    // und niemand käme auf die Idee, die Uhr zu verdächtigen.
    expect(restSperre(9_999_999_999, 1_000_000)).toBe(MODAL_UEBERGABE_MS);
  });
});

describe('der Zähler der offenen Overlays', () => {
  beforeEach(() => {
    useSheetPresence.setState({ offen: 0, sperreBis: 0 });
  });

  it('zählt hoch und runter', () => {
    const { an, aus } = useSheetPresence.getState();
    an();
    an();
    expect(useSheetPresence.getState().offen).toBe(2);
    aus();
    expect(useSheetPresence.getState().offen).toBe(1);
  });

  it('geht nie unter null — ein doppeltes Abmelden darf nichts kaputt machen', () => {
    const { aus } = useSheetPresence.getState();
    aus();
    aus();
    expect(useSheetPresence.getState().offen).toBe(0);
  });

  it('sperren setzt die Sperre auf jetzt + eine Übergabe', () => {
    const vorher = Date.now();
    useSheetPresence.getState().sperren();
    const bis = useSheetPresence.getState().sperreBis;
    expect(bis).toBeGreaterThanOrEqual(vorher + MODAL_UEBERGABE_MS);
    expect(bis).toBeLessThanOrEqual(Date.now() + MODAL_UEBERGABE_MS);
  });
});
