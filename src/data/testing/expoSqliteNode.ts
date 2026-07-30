// expoSqliteNode.ts — expo-sqlite, aber echt, im Test.
//
// **Der größte blinde Fleck des Projekts** (UEBERGABE §8.39): die gesamte
// Verifikations-Pipeline läuft im Web, und dort sind alle Repositories
// InMemory. Die `Sqlite*`-Klassen — also der Code, der auf dem Telefon
// WIRKLICH die Daten hält — wurden nie ausgeführt. Nicht von tsc, nicht von
// Jest, nicht von der Playwright-Tour. Ein falsches SQL fiel erst auf dem
// Gerät auf, dort als stiller Abbruch mitten in einer Mutation; in v1.42.0
// hat genau das acht Releases lang jedes Anlegen einer Aufgabe verhindert,
// ohne dass irgendetwas rot geworden wäre.
//
// `sqliteSchema.test.ts` bewacht seitdem die Zeichenketten als TEXT. Das
// findet die Klasse Fehler von damals, aber nichts, was erst beim AUSFÜHREN
// auffällt: ein Tippfehler im Spaltennamen, eine fehlende Migration, ein
// NOT-NULL, das die App verletzt, ein Wert, den die Bindung nicht annimmt.
//
// Dieses Modul schließt die Lücke, indem es `expo-sqlite` durch `node:sqlite`
// ersetzt (in Node 22 eingebaut — keine neue Abhängigkeit, kein natives
// Kompilat). Die echte Datei-Datenbank wird zu `:memory:`; sonst läuft
// derselbe Code, dieselben Migrationen, dasselbe SQL.
//
// **Es ist ein Stellvertreter, kein Beweis.** node:sqlite und expo-sqlite
// sprechen beide SQLite, aber Bindungsregeln und Fehlertexte können sich
// unterscheiden. Was hier grün ist, kann auf dem Gerät noch schiefgehen —
// was hier rot ist, geht dort mit Sicherheit schief. Genau dafür ist es da.
//
// Zwei Stellen, an denen bewusst NACHGEAHMT statt durchgereicht wird — sonst
// meldete der Prüfstand Fehler, die es auf dem Telefon gar nicht gibt:
//
//  1. `expo-sqlite` nimmt `boolean` als Bindungswert an und macht daraus 0/1,
//     `node:sqlite` wirft. Also hier umrechnen.
//  2. Fremdschlüssel. `node:sqlite` schaltet sie von sich aus EIN, SQLite
//     selbst hat sie aus, und `expo-sqlite` setzt das Pragma nirgends — auf
//     dem Telefon sind sie also AUS. Das `REFERENCES lists(id)` in `db.ts`
//     ist dort Dokumentation, keine Bedingung: eine Aufgabe darf in einer
//     Liste liegen, die es (noch) nicht gibt. Wer das ändern will, ändert es
//     im Schema — nicht hier, sonst prüft der Stellvertreter eine andere App.
import { DatabaseSync } from 'node:sqlite';

/** Was `expo-sqlite` an Bindungswerten annimmt. */
type BindWert = string | number | boolean | null | undefined | Uint8Array;
type BindListe = BindWert[] | BindWert;

type NodeWert = string | number | bigint | null | Uint8Array;

/** expo-sqlite akzeptiert booleans, node:sqlite nicht — hier umrechnen. */
function bind(params: BindListe): NodeWert[] {
  const liste = Array.isArray(params) ? params : [params];
  return liste.map((v) => {
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v === undefined) return null;
    return v;
  });
}

/** Zeilen kommen mit null-Prototyp zurück — für `toEqual` unbrauchbar. */
function zeile<T>(r: unknown): T {
  return { ...(r as object) } as T;
}

class NodeSQLiteDatabase {
  constructor(private readonly db: DatabaseSync) {}

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, params: BindListe = []): Promise<{ lastInsertRowId: number; changes: number }> {
    const r = this.db.prepare(sql).run(...bind(params));
    return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
  }

  async getAllAsync<T>(sql: string, params: BindListe = []): Promise<T[]> {
    return this.db.prepare(sql).all(...bind(params)).map((r) => zeile<T>(r));
  }

  async getFirstAsync<T>(sql: string, params: BindListe = []): Promise<T | null> {
    const r = this.db.prepare(sql).get(...bind(params));
    return r === undefined ? null : zeile<T>(r);
  }

  /**
   * Wie in expo-sqlite: wirft der Rumpf, wird zurückgerollt und der Fehler
   * weitergereicht. Das ist die Zusage, auf der `applyActions` steht.
   */
  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await fn();
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

// Wie auf dem Gerät: derselbe Name liefert dieselbe Datenbank. Ein
// `jest.resetModules()` legt dieses Modul neu auf und damit auch die Karte —
// so bekommt jeder Test eine frische, leere Datenbank.
const offen = new Map<string, NodeSQLiteDatabase>();

export async function openDatabaseAsync(name: string): Promise<NodeSQLiteDatabase> {
  const da = offen.get(name);
  if (da) return da;
  const neu = new NodeSQLiteDatabase(new DatabaseSync(':memory:', { enableForeignKeyConstraints: false }));
  offen.set(name, neu);
  return neu;
}

export function openDatabaseSync(name: string): NodeSQLiteDatabase {
  const da = offen.get(name);
  if (da) return da;
  const neu = new NodeSQLiteDatabase(new DatabaseSync(':memory:', { enableForeignKeyConstraints: false }));
  offen.set(name, neu);
  return neu;
}
