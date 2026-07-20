// autoBackup.ts — stilles wöchentliches Sicherheitsnetz gegen den
// 7-Tage-Signatur-Zyklus: schreibt das volle JSON-Backup (inkl. Fotos als
// Base64) in den Ordner „Backups" im App-Dokumentverzeichnis. Der ist über
// die Dateien-App sichtbar (UIFileSharingEnabled) und wird von iCloud-Backup
// erfasst. Behalten werden die letzten 4 Stände.
import { Platform } from 'react-native';

import { exportToJsonString } from '@/data/backup';
import { extFromUri, readPhotoBase64 } from '@/lib/backupFile';
import type { SavedFilter } from '@/lib/taskFilters';

const BACKUP_DIR = 'Backups';
const KEEP = 4;
export const AUTO_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function fs(): typeof import('expo-file-system') {
  return require('expo-file-system') as typeof import('expo-file-system');
}

/** Fällig, wenn noch nie gesichert oder das letzte Backup > 7 Tage her ist. */
export function isAutoBackupDue(lastAt: string, now: Date = new Date()): boolean {
  if (!lastAt) return true;
  const last = Date.parse(lastAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= AUTO_BACKUP_INTERVAL_MS;
}

/** Führt das Backup aus (nur nativ). Liefert den Dateinamen oder null. */
export async function runAutoBackup(savedFilters: SavedFilter[], now: Date = new Date()): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { Directory, File, Paths } = fs();
    const dir = new Directory(Paths.document, BACKUP_DIR);
    if (!dir.exists) dir.create();

    const json = await exportToJsonString({ savedFilters, readPhotoBase64, extFromUri }, now);
    const name = `stoa-backup-${now.toISOString().slice(0, 10)}.json`;
    const file = new File(dir, name);
    file.write(json);

    // Rotation: nur die letzten KEEP Stände behalten (Namen sortieren = Datum).
    const backups = dir
      .list()
      .filter((e) => e instanceof File && e.name.startsWith('stoa-backup-'))
      .map((e) => e as InstanceType<typeof File>)
      .sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const old of backups.slice(0, Math.max(0, backups.length - KEEP))) {
      try {
        old.delete();
      } catch {
        /* Rotation ist Kür — Fehler still schlucken */
      }
    }
    return name;
  } catch {
    return null;
  }
}
