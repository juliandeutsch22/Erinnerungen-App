// zeileVerlauf.test.ts — das Gedächtnis der EINEN Zeile.
import { VERLAUF_MAX, verlaufAntwort, verlaufErweitern, verlaufNachrichten, type Wechsel } from './zeileVerlauf';

describe('verlaufAntwort', () => {
  it('nimmt die Prosa, wenn es keine Vorschläge gibt', () => {
    expect(verlaufAntwort('Morgen steht nur der Zahnarzt an.', [])).toBe('Morgen steht nur der Zahnarzt an.');
  });

  it('benennt Vorschläge in der Sprache der App — nicht als JSON', () => {
    const a = verlaufAntwort('Mache ich.', [
      { titel: 'Kartons besorgen', unter: 'Morgen', art: 'Aufgabe' },
      { titel: 'Kaution 1200 EUR', art: 'Notiz' },
    ]);
    expect(a).toContain('Mache ich.');
    expect(a).toContain('Vorgeschlagen: Aufgabe „Kartons besorgen" (Morgen); Notiz „Kaution 1200 EUR".');
    expect(a).not.toContain('{');
  });

  it('kappt lange Listen, statt den halben Block zurückzuschicken', () => {
    const viele = Array.from({ length: 12 }, (_, i) => ({ titel: `Nummer ${i + 1}`, art: 'Aufgabe' }));
    const a = verlaufAntwort('', viele);
    expect(a).toContain('Nummer 8');
    expect(a).not.toContain('Nummer 9');
    expect(a).toContain('… und 4 weitere');
  });

  it('erfindet nichts, wenn beides leer ist', () => {
    expect(verlaufAntwort('   ', [])).toBe('');
  });
});

describe('verlaufNachrichten', () => {
  const w = (n: number): Wechsel => ({ frage: `frage ${n}`, antwort: `antwort ${n}` });

  it('setzt die neue Frage ans Ende', () => {
    const m = verlaufNachrichten([w(1)], 'und die zweite?');
    expect(m.map((x) => x.role)).toEqual(['user', 'assistant', 'user']);
    expect(m.at(-1)?.content).toBe('und die zweite?');
  });

  it('nimmt nur die letzten Runden mit', () => {
    const alle = [w(1), w(2), w(3), w(4), w(5)];
    const m = verlaufNachrichten(alle, 'weiter');
    // VERLAUF_MAX Runden à zwei Nachrichten, plus die neue Frage.
    expect(m).toHaveLength(VERLAUF_MAX * 2 + 1);
    expect(m[0].content).toBe('frage 3');
  });

  it('kommt ohne Verlauf klar — dann ist es ein Einzelschuss wie vorher', () => {
    const m = verlaufNachrichten([], 'Was steht morgen an?');
    expect(m).toHaveLength(1);
    expect(m[0].role).toBe('user');
  });
});

describe('verlaufErweitern', () => {
  it('hängt an und kappt bei VERLAUF_MAX', () => {
    let v: Wechsel[] = [];
    for (let i = 1; i <= 5; i += 1) v = verlaufErweitern(v, `f${i}`, `a${i}`);
    expect(v).toHaveLength(VERLAUF_MAX);
    expect(v[0].frage).toBe('f3');
    expect(v.at(-1)?.frage).toBe('f5');
  });

  it('nimmt eine Runde OHNE Antwort nicht auf', () => {
    const v = verlaufErweitern([], 'Sortier meinen Tag', '   ');
    expect(v).toEqual([]);
  });

  it('nimmt eine Runde ohne Frage nicht auf', () => {
    const v = verlaufErweitern([], '  ', 'Alles ruhig.');
    expect(v).toEqual([]);
  });
});
