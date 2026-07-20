// autoBackup.ts — stilles wöchentliches Sicherheitsnetz gegen den
// 7-Tage-Signatur-Zyklus: schreibt das volle JSON-Backup (inkl. Fotos als
// Base64) in den Ordner „Backups" im App-Dokumentverzeichnis. Der ist über
// die Dateien-App sichtbar (UIFileSharingEnabled) und wird von iCloud-Backup
// erfasst. Behalten werden die letzten 4 Stände.
import { Platform } from 'react-native';

import { exportToJsonString } from '@/data/backup';
import { extFromUri, readPhotoBase64 } from '@/lib/backupFile';
import { readDocumentBase64 } from '@/lib/documents';
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

export type BackupEntry = { name: string; date: string };

/** Vorhandene Auto-Backup-Stände, neueste zuerst (nur nativ). */
export function listBackups(): BackupEntry[] {
  if (Platform.OS === 'web') return [];
  try {
    const { Directory, File, Paths } = fs();
    const dir = new Directory(Paths.document, BACKUP_DIR);
    if (!dir.exists) return [];
    return dir
      .list()
      .filter((e) => e instanceof File && e.name.startsWith('stoa-backup-') && e.name.endsWith('.json'))
      .map((e) => ({ name: e.name, date: e.name.replace('stoa-backup-', '').replace('.json', '') }))
      .sort((a, b) => (a.name < b.name ? 1 : -1));
  } catch {
    return [];
  }
}

/** Inhalt eines Backup-Stands lesen (nur nativ). */
export async function readBackup(name: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { Directory, File, Paths } = fs();
    return await new File(new Directory(Paths.document, BACKUP_DIR), name).text();
  } catch {
    return null;
  }
}

/** Führt das Backup aus (nur nativ). Liefert den Dateinamen oder null. */
export async function runAutoBackup(savedFilters: SavedFilter[], now: Date = new Date()): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { Directory, File, Paths } = fs();
    const dir = new Directory(Paths.document, BACKUP_DIR);
    if (!dir.exists) dir.create();

    const json = await exportToJsonString({ savedFilters, readPhotoBase64, extFromUri, readDocumentBase64 }, now);
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
