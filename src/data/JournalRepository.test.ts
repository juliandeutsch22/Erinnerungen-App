// JournalRepository.test.ts — der Papierkorb der Abendbetrachtung, InMemory.
//
// Die SQLite-Fassung wird in `sqliteRepositories.test.ts` mit denselben
// Zusagen geprüft. Beide braucht es: InMemory ist das, was im Web und in der
// Playwright-Tour läuft, SQLite das, was auf dem Telefon läuft. Wenn die zwei
// auseinanderlaufen, ist jede Tour eine Aussage über die falsche App.
import { InMemoryJournalRepository, type JournalEntry } from './JournalRepository';

const e = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  id: 'j1',
  date: '2026-07-30',
  text: 'Ruhiger Tag.',
  deletedAt: null,
  createdAt: 'A',
  updatedAt: 'A',
  ...over,
});

describe('InMemoryJournalRepository', () => {
  it('legt in den Papierkorb, ohne die Zeile zu verlieren', async () => {
    const r = new InMemoryJournalRepository();
    await r.upsert(e());
    await r.setDeletedAt('j1', '2026-07-31T20:00:00.000Z');
    const alle = await r.getAll();
    expect(alle).toHaveLength(1);
    expect(alle[0].deletedAt).toBe('2026-07-31T20:00:00.000Z');
  });

  it('fasst den bereits ausgelieferten Eintrag NICHT an', async () => {
    // Sonst wandert die Änderung rückwirkend in den Query-Cache, dessen
    // Struktur-Vergleich findet keinen Unterschied und rendert nicht neu —
    // der Eintrag wäre gelöscht und stünde trotzdem noch auf dem Bildschirm.
    // Genau das ist beim Bauen passiert; die Tour hat es gefunden.
    const r = new InMemoryJournalRepository();
    await r.upsert(e());
    const vorher = await r.getAll();
    await r.setDeletedAt('j1', '2026-07-31T20:00:00.000Z');
    expect(vorher[0].deletedAt).toBeNull();
    expect((await r.getAll())[0].deletedAt).toBe('2026-07-31T20:00:00.000Z');
  });

  it('holt zurück und löscht endgültig erst danach', async () => {
    const r = new InMemoryJournalRepository();
    await r.upsert(e());
    await r.setDeletedAt('j1', '2026-07-31T20:00:00.000Z');
    await r.setDeletedAt('j1', null);
    expect((await r.getAll())[0].deletedAt).toBeNull();
    await r.remove('j1');
    expect(await r.getAll()).toEqual([]);
  });

  it('holt einen Abend zurück, sobald man an dem Tag wieder schreibt', async () => {
    const r = new InMemoryJournalRepository();
    await r.upsert(e({ text: 'Erst so.' }));
    await r.setDeletedAt('j1', '2026-07-31T20:00:00.000Z');
    await r.upsert(e({ id: 'j9', text: 'Doch anders.', createdAt: 'B', updatedAt: 'B' }));
    const [nach] = await r.getAll();
    expect(nach.deletedAt).toBeNull();
    expect(nach.text).toBe('Doch anders.');
    // id und createdAt gehören weiter dem ersten Eintrag des Tages.
    expect(nach.id).toBe('j1');
    expect(nach.createdAt).toBe('A');
  });

  it('hält weiterhin genau einen Eintrag pro Tag', async () => {
    const r = new InMemoryJournalRepository();
    await r.upsert(e({ date: '2026-07-29' }));
    await r.upsert(e({ id: 'j2', date: '2026-07-30' }));
    await r.upsert(e({ id: 'j3', date: '2026-07-30', text: 'Nochmal.' }));
    const alle = await r.getAll();
    expect(alle).toHaveLength(2);
    expect(alle.map((x) => x.date)).toEqual(['2026-07-30', '2026-07-29']);
  });
});
