// photos.ts — Foto-Ablage für Termin-Rückblicke. Ausgewählte Bilder werden in
// den App-Container kopiert (document/event-photos), damit sie unabhängig von
// der Fotomediathek erhalten bleiben und im Backup-Container liegen. Nur nativ;
// im Web ein No-Op (kein Dateisystem-/Picker-Zugriff in RN-Web).
import { Platform } from 'react-native';

import { newId } from '@/data/types';

export const photosAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

const SUBDIR = 'event-photos';

function fs(): typeof import('expo-file-system') {
  return require('expo-file-system') as typeof import('expo-file-system');
}
function picker(): typeof import('expo-image-picker') {
  return require('expo-image-picker') as typeof import('expo-image-picker');
}

function photosDir(): import('expo-file-system').Directory {
  const { Directory, Paths } = fs();
  const dir = new Directory(Paths.document, SUBDIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Öffnet die Fotomediathek, kopiert die Auswahl in den Container. Gibt die neuen URIs zurück. */
export async function pickAndStorePhotos(): Promise<string[]> {
  if (!photosAvailable) return [];
  const ImagePicker = picker();
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 0.8,
    selectionLimit: 12,
  });
  if (result.canceled) return [];

  const { File } = fs();
  const dir = photosDir();
  const stored: string[] = [];
  for (const asset of result.assets) {
    try {
      const ext = (asset.fileName?.split('.').pop() || asset.uri.split('.').pop() || 'jpg').toLowerCase();
      const dest = new File(dir, `${newId()}.${ext}`);
      await new File(asset.uri).copy(dest);
      stored.push(dest.uri);
    } catch {
      /* einzelnes Bild überspringen, Rest weiter kopieren */
    }
  }
  return stored;
}

/** Löscht die Container-Kopie (nicht das Original in der Mediathek). */
export function deleteStoredPhoto(uri: string): void {
  if (!photosAvailable) return;
  try {
    const { File } = fs();
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* schon weg */
  }
}
