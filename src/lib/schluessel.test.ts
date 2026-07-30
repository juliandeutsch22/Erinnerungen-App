// schluessel.test.ts — wann ein Weg zum Schlüssel angeboten wird.
//
// Die Entscheidung hängt am Text der Meldung, nicht am HTTP-Status (der ist an
// den Anzeigestellen längst weg). Diese Tests halten die Meldungen aus
// `describeError` und die Ausnahme fest, damit ein umformulierter Satz den
// Knopf nicht still verschwinden lässt.
import { describeError } from './assistant';
import { betrifftSchluessel, SCHLUESSEL_URL } from './schluessel';

describe('betrifftSchluessel', () => {
  it('greift beim abgelehnten Schlüssel — dem Fall, für den es das gibt', () => {
    for (const status of [400, 401, 403]) {
      expect(betrifftSchluessel(describeError(status))).toBe(true);
    }
  });

  it('greift auch, wenn kein Modell gefunden wurde (oft ein falscher Schlüssel)', () => {
    expect(betrifftSchluessel(describeError(404))).toBe(true);
  });

  it('greift NICHT beim erschöpften Kontingent — ein neuer Schlüssel hilft da nicht', () => {
    expect(betrifftSchluessel(describeError(429))).toBe(false);
  });

  it('greift nicht bei Server- und Netzfehlern', () => {
    expect(betrifftSchluessel(describeError(500))).toBe(false);
    expect(betrifftSchluessel(describeError(503))).toBe(false);
    expect(betrifftSchluessel('Konnte es nicht anlegen: Unbekannter Fehler.')).toBe(false);
  });

  it('kommt mit „kein Fehler" klar', () => {
    expect(betrifftSchluessel(null)).toBe(false);
    expect(betrifftSchluessel(undefined)).toBe(false);
    expect(betrifftSchluessel('')).toBe(false);
  });
});

describe('SCHLUESSEL_URL', () => {
  it('zeigt auf die Seite, die den Schlüssel ausgibt', () => {
    expect(SCHLUESSEL_URL).toBe('https://aistudio.google.com/apikey');
  });

  it('ist die einzige Quelle der Adresse — nirgends sonst steht sie im Fließtext', () => {
    // Die Adresse stand bis v1.59 dreimal als nackter Text in der Oberfläche.
    // Kommt sie irgendwo zurück, ist der Knopf wieder nur Zierde.
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const wurzel = path.join(__dirname, '..');
    const treffer: string[] = [];
    const gehen = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) gehen(p);
        else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts') && p !== path.join(__dirname, 'schluessel.ts')) {
          if (fs.readFileSync(p, 'utf8').includes('aistudio.google.com')) treffer.push(path.relative(wurzel, p));
        }
      }
    };
    gehen(wurzel);
    expect(treffer).toEqual([]);
  });
});
