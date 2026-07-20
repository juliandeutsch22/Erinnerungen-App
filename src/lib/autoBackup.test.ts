// autoBackup.test.ts — Wochenrhythmus des stillen Backups.
import { isAutoBackupDue } from './autoBackup';

describe('isAutoBackupDue', () => {
  const now = new Date('2026-07-20T09:00:00.000Z');
  it('fällig ohne bisheriges Backup oder bei kaputtem Zeitstempel', () => {
    expect(isAutoBackupDue('', now)).toBe(true);
    expect(isAutoBackupDue('kaputt', now)).toBe(true);
  });
  it('nicht fällig innerhalb von 7 Tagen, fällig danach', () => {
    expect(isAutoBackupDue('2026-07-15T09:00:00.000Z', now)).toBe(false);
    expect(isAutoBackupDue('2026-07-13T08:59:00.000Z', now)).toBe(true);
  });
});
