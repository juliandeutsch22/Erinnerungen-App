// backupFile.ts — Datei-IO für Backups (nur nativ). Trennt das Dateisystem-/
// Share-/Picker-Handling von der reinen Backup-Logik (backup.ts, testbar).
//
// Fotos liegen als Dateien im Container (document/event-photos). Fürs Backup
// werden sie als Base64 in die JSON-Datei eingebettet und beim Import wieder als
// echte Dateien herausgeschrieben — so überlebt der Rückblick auch eine
// komplette Neuinstallation (nicht nur den 7-Tage-Signatur-Zyklus).
//
// Web = No-Op (kein Dateisystem/Picker in RN-Web); dort greift der Blob-Download
// bzw. das Einfügefeld in den Einstellungen.
import { Platform } from 'react-native';

import { newId } from '@/data/types';

export const fileBackupAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

const PHOTO_SUBDIR = 'event-photos';

function fs(): typeof import('expo-file-system') {
  return require('expo-file-system') as typeof import('expo-file-system');
}

function photosDir(): import('expo-file-system').Directory {
  const { Directory, Paths } = fs();
  const dir = new Directory(Paths.document, PHOTO_SUBDIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Endung aus einer Foto-URI (Fallback jpg) — bestimmt den Dateinamen beim Import. */
export function extFromUri(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop();
  return ext && ext.length <= 5 ? ext.toLowerCase() : 'jpg';
}

/** Liest die Bilddatei als Base64 (für den Export). null, wenn nicht lesbar. */
export async function readPhotoBase64(uri: string): Promise<string | null> {
  if (!fileBackupAvailable) return null;
  try {
    const { File } = fs();
    const file = new File(uri);
    if (!file.exists) return null;
    return await file.base64();
  } catch {
    return null;
  }
}

/** Schreibt Base64-Bilddaten als neue Container-Datei; gibt deren URI zurück. */
export async function writePhotoFromBase64(ext: string, base64: string): Promise<string | null> {
  if (!fileBackupAvailable) return null;
  try {
    const { File } = fs();
    const dest = new File(photosDir(), `${newId()}.${ext}`);
    dest.create({ overwrite: true });
    dest.write(base64, { encoding: 'base64' });
    return dest.uri;
  } catch {
    return null;
  }
}

/** Schreibt das Backup-JSON in eine Cache-Datei und öffnet das Teilen-Sheet. */
export async function saveAndShareBackup(json: string, filename = 'erinnerungen-backup.json'): Promise<void> {
  const { File, Paths } = fs();
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(json);

  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Erinnerungen-Backup sichern',
      UTI: 'public.json',
    });
  }
}

/** Lässt eine Backup-Datei auswählen und liefert ihren Textinhalt (JSON). */
export async function pickBackupFile(): Promise<string | null> {
  const DocumentPicker = require('expo-document-picker') as typeof import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const { File } = fs();
  return await new File(res.assets[0].uri).text();
}
