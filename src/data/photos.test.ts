// photos.test.ts — Foto-Verknüpfung pro Termin (InMemory-Repository).
import { __setPhotoRepositoryForTests, getPhotoRepository } from './index';
import { InMemoryPhotoRepository, makePhotos } from './PhotoRepository';

describe('PhotoRepository', () => {
  beforeEach(() => __setPhotoRepositoryForTests(new InMemoryPhotoRepository()));
  afterEach(() => __setPhotoRepositoryForTests(null));

  it('verknüpft Fotos mit einem Termin und liest sie chronologisch', async () => {
    const repo = getPhotoRepository();
    await repo.add('evt-1', ['file://a.jpg', 'file://b.jpg']);
    await repo.add('evt-2', ['file://c.jpg']);
    const forOne = await repo.getForEvent('evt-1');
    expect(forOne.map((p) => p.uri)).toEqual(['file://a.jpg', 'file://b.jpg']);
    expect(await repo.getForEvent('evt-2')).toHaveLength(1);
  });

  it('getAll liefert neueste zuerst (Rückblick)', async () => {
    const repo = getPhotoRepository();
    await repo.add('evt-1', ['file://alt.jpg']);
    await new Promise((r) => setTimeout(r, 2));
    await repo.add('evt-2', ['file://neu.jpg']);
    const all = await repo.getAll();
    expect(all[0].uri).toBe('file://neu.jpg');
  });

  it('remove entfernt genau ein Foto', async () => {
    const repo = getPhotoRepository();
    const [p1] = await repo.add('evt-1', ['file://a.jpg']);
    await repo.add('evt-1', ['file://b.jpg']);
    await repo.remove(p1.id);
    expect((await repo.getForEvent('evt-1')).map((p) => p.uri)).toEqual(['file://b.jpg']);
  });

  it('makePhotos vergibt eindeutige IDs + monotone Zeitstempel', () => {
    const photos = makePhotos('e', ['x', 'y', 'z']);
    expect(new Set(photos.map((p) => p.id)).size).toBe(3);
    expect(photos[0].addedAt <= photos[1].addedAt).toBe(true);
  });
});
