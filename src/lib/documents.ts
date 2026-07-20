// documents.ts — Datei-Handling für Termin-Dokumente: Picker → Kopie in den
// App-Container (Ordner „Dokumente"), Öffnen über das iOS-Teilen-Blatt
// (QuickLook-Vorschau) — funktioniert offline, die Datei liegt lokal.
import { Platform } from 'react-native';

import { newId } from '@/data/types';

export const documentsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';
const DOC_SUBDIR = 'Dokumente';

function fs(): typeof import('expo-file-system') {
  return require('expo-file-system') as typeof import('expo-file-system');
}

function docsDir() {
  const { Directory, Paths } = fs();
  const dir = new Directory(Paths.document, DOC_SUBDIR);
  if (!dir.exists) dir.create();
  return dir;
}

/** Datei wählen und in den Container kopieren. null = abgebrochen. */
export async function pickAndStoreDocument(): Promise<{ name: string; uri: string } | null> {
  if (!documentsAvailable) return null;
  const DocumentPicker = require('expo-document-picker') as typeof import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (res.canceled || res.assets.length === 0) return null;
  const asset = res.assets[0];
  const { File } = fs();
  const ext = (asset.name.split('.').pop() || 'pdf').toLowerCase();
  const dest = new File(docsDir(), `${newId()}.${ext}`);
  new File(asset.uri).copy(dest);
  return { name: asset.name, uri: dest.uri };
}

/** Öffnet die iOS-Vorschau (QuickLook via Teilen-Blatt). */
export async function openDocument(uri: string): Promise<void> {
  if (!documentsAvailable) return;
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  await Sharing.shareAsync(uri);
}

export function deleteStoredDocument(uri: string): void {
  try {
    const { File } = fs();
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* Datei weg = Ziel erreicht */
  }
}

/** Backup: Datei als Base64 lesen — große Dateien (> 10 MB) werden als
 *  reine Verknüpfung gesichert, damit Backups handlich bleiben. */
export const DOC_BACKUP_LIMIT = 10 * 1024 * 1024;
export async function readDocumentBase64(uri: string): Promise<string | null> {
  try {
    const { File } = fs();
    const f = new File(uri);
    if (!f.exists || (f.size ?? 0) > DOC_BACKUP_LIMIT) return null;
    return await f.base64();
  } catch {
    return null;
  }
}

export async function writeDocumentFromBase64(ext: string, base64: string): Promise<string | null> {
  try {
    const { File } = fs();
    const dest = new File(docsDir(), `${newId()}.${ext}`);
    dest.create({ overwrite: true });
    dest.write(base64, { encoding: 'base64' });
    return dest.uri;
  } catch {
    return null;
  }
}
