// sqliteSchema.test.ts — der Wächter über die SQL-Zeichenketten.
//
// Warum es diesen Test gibt: Die gesamte Verifikations-Pipeline läuft im Web,
// und dort sind die Repositories InMemory — **SQLite wird nie ausgeführt**. Ein
// falsch geschriebenes INSERT fällt deshalb in tsc nicht auf, in den Tests
// nicht auf und in der Playwright-Tour nicht auf. Es fällt erst auf dem Gerät
// auf, und dort als stiller Abbruch mitten in einer Mutation.
//
// Genau das ist passiert: In v1.42.0 kam beim Nachrüsten von `start_date` und
// `expires_on` EIN Fragezeichen zu viel in die VALUES-Liste. Seitdem hat
// SQLite jedes Anlegen einer Aufgabe abgelehnt („20 columns but 21 values"),
// acht Releases lang, ohne dass irgendetwas rot geworden wäre.
//
// Der Test liest die Dateien als TEXT und vergleicht Spalten mit Platzhaltern.
// Das ist grob, aber es prüft genau die Klasse von Fehler, die hier sonst
// niemand sieht — und es gilt automatisch für jedes neue Repository.
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ORDNER = join(__dirname);
const DATEIEN = readdirSync(ORDNER).filter((f) => f.startsWith('Sqlite') && f.endsWith('.ts'));

/** (spalte, spalte, …) VALUES (?, ?, …) — beides einsammeln. */
const INSERT_RE = /INSERT(?: OR REPLACE)? INTO (\w+)\s*\n?\s*\(([^)]*)\)\s*\n?\s*VALUES\s*\(([^)]*)\)/g;

type Fund = { datei: string; tabelle: string; spalten: number; platzhalter: number };

function inserts(): Fund[] {
  const alle: Fund[] = [];
  for (const datei of DATEIEN) {
    const inhalt = readFileSync(join(ORDNER, datei), 'utf8');
    for (const m of inhalt.matchAll(INSERT_RE)) {
      alle.push({
        datei,
        tabelle: m[1],
        spalten: m[2].split(',').filter((c) => c.trim().length > 0).length,
        platzhalter: (m[3].match(/\?/g) ?? []).length,
      });
    }
  }
  return alle;
}

describe('SQLite-Anweisungen (auf dem Gerät nicht nachprüfbar, hier schon)', () => {
  it('findet überhaupt INSERTs — sonst prüft der Test nichts', () => {
    expect(DATEIEN.length).toBeGreaterThan(5);
    expect(inserts().length).toBeGreaterThan(5);
  });

  it('jedes INSERT hat so viele Platzhalter wie Spalten', () => {
    const schief = inserts().filter((i) => i.spalten !== i.platzhalter);
    expect(
      schief.map((i) => `${i.datei} → ${i.tabelle}: ${i.spalten} Spalten, ${i.platzhalter} Platzhalter`),
    ).toEqual([]);
  });

  it('jede Tabelle, in die geschrieben wird, ist im Schema angelegt', () => {
    const schema = readFileSync(join(ORDNER, 'db.ts'), 'utf8');
    const fehlend = [...new Set(inserts().map((i) => i.tabelle))].filter(
      (t) => !schema.includes(`CREATE TABLE IF NOT EXISTS ${t}`),
    );
    expect(fehlend).toEqual([]);
  });
});
