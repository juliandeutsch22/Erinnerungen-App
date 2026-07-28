// undo.test.ts — ein Schritt zurück, nicht mehr. Wichtig ist hier, dass ein
// verbrauchtes Angebot verschwindet und ein neues das alte ersetzt.
import { rememberUndo, runUndo, UNDO_MS, useUndo } from './undo';

beforeEach(() => useUndo.getState().clear());

describe('Rückgängig', () => {
  it('merkt sich genau EINEN Schritt — ein neuer ersetzt den alten', () => {
    rememberUndo('Abgehakt', () => {});
    rememberUndo('In den Papierkorb gelegt', () => {});
    expect(useUndo.getState().entry?.label).toBe('In den Papierkorb gelegt');
  });

  it('führt aus und ist danach verbraucht', async () => {
    let zurueck = 0;
    rememberUndo('Abgehakt', () => { zurueck += 1; });
    await runUndo();
    expect(zurueck).toBe(1);
    expect(useUndo.getState().entry).toBeNull();
    // Zweiter Aufruf tut nichts — ein verbrauchtes Angebot träfe auf einen
    // anderen Stand.
    await runUndo();
    expect(zurueck).toBe(1);
  });

  it('wartet auf asynchrone Rücknahmen', async () => {
    let fertig = false;
    rememberUndo('Auf heute geholt', async () => {
      await new Promise((r) => setTimeout(r, 5));
      fertig = true;
    });
    await runUndo();
    expect(fertig).toBe(true);
  });

  it('das Angebot steht lange genug zum Lesen', () => {
    expect(UNDO_MS).toBeGreaterThanOrEqual(4000);
  });
});
