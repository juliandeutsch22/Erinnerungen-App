// orphanDocuments.test.ts — die Schonfrist-Logik des Dokumente-Aufräumers.
import { ORPHAN_GRACE_DAYS, sweepDecision } from './orphanDocuments';

const DAY = 86400000;
const now = new Date('2026-07-20T12:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY).toISOString();

describe('sweepDecision', () => {
  it('frisch vermisste Termine werden gestempelt, nicht gelöscht', () => {
    const r = sweepDecision(['ev-1', 'ev-2'], new Set(['ev-2']), {}, now);
    expect(r.deleteEventIds).toEqual([]);
    expect(r.nextMissingSince).toEqual({ 'ev-1': now.toISOString() });
  });

  it('nach Ablauf der Schonfrist fallen die Dokumente', () => {
    const r = sweepDecision(['ev-1'], new Set(), { 'ev-1': daysAgo(ORPHAN_GRACE_DAYS + 1) }, now);
    expect(r.deleteEventIds).toEqual(['ev-1']);
    expect(r.nextMissingSince).toEqual({});
  });

  it('innerhalb der Frist bleibt der ursprüngliche Stempel erhalten', () => {
    const stamp = daysAgo(10);
    const r = sweepDecision(['ev-1'], new Set(), { 'ev-1': stamp }, now);
    expect(r.deleteEventIds).toEqual([]);
    expect(r.nextMissingSince).toEqual({ 'ev-1': stamp });
  });

  it('wieder aufgetauchte Termine werden vergessen (Sync-Flackern)', () => {
    const r = sweepDecision(['ev-1'], new Set(['ev-1']), { 'ev-1': daysAgo(90) }, now);
    expect(r.deleteEventIds).toEqual([]);
    expect(r.nextMissingSince).toEqual({});
  });
});
