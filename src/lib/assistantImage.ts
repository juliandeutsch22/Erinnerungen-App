// assistantImage.ts — Bildkanal für den Assistenten: ein Foto (Zettel, Aushang,
// Whiteboard, Brief) wird zu Aufgaben und Terminen.
//
// Bewusst OHNE Dateisystem: der Picker liefert die Base64-Daten direkt, das Bild
// wird für EINE Anfrage benutzt und danach vergessen. Es landet nirgends im
// Speicher, in keinem Backup und in keiner Notiz — ein abfotografierter Zettel
// soll keine Spur hinterlassen, die man später aufräumen muss.
//
// Die Auflösung wird über `quality` gedrosselt: Bilder kosten auf dem eigenen
// Schlüssel deutlich mehr als Text, und für gedruckte oder handgeschriebene
// Zeilen reicht wenig. Mehr als IMAGE_LIMIT Bilder pro Wurf gehen nicht.
import { Platform } from 'react-native';

import type { AssistantImage } from '@/lib/assistant';

function picker(): typeof import('expo-image-picker') {
  return require('expo-image-picker') as typeof import('expo-image-picker');
}

/** Die Mediathek gibt es überall: nativ die Fotos-App, im Web der Datei-Dialog.
 *  Das ist kein Zugeständnis an die Web-Vorschau, sondern macht den Bildweg
 *  überhaupt erst prüfbar — nativ ist er sonst nur am Gerät zu sehen. */
export const assistantImagesAvailable = true;
/** Direkt abfotografieren nur nativ — die Web-Kamera ist unzuverlässig. */
export const assistantCameraAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

function toImage(asset: { base64?: string | null; mimeType?: string | null; uri?: string }): AssistantImage | null {
  if (!asset.base64) return null;
  const ext = (asset.uri?.split('.').pop() ?? '').toLowerCase();
  const mimeType = asset.mimeType ?? (ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg');
  return { mimeType, data: asset.base64 };
}

/** Aus der Mediathek wählen. Leeres Array = abgebrochen oder nicht erlaubt. */
export async function pickAssistantImages(max: number): Promise<AssistantImage[]> {
  if (max <= 0) return [];
  try {
    const ImagePicker = picker();
    // Im Web gibt es keine Mediathek-Berechtigung — dort nicht darauf warten.
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return [];
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: max,
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return [];
    return result.assets.map(toImage).filter((x): x is AssistantImage => x !== null);
  } catch {
    return [];
  }
}

/** Direkt abfotografieren — der eigentliche Fall („Zettel liegt vor mir"). */
export async function captureAssistantImage(): Promise<AssistantImage[]> {
  if (!assistantCameraAvailable) return [];
  try {
    const ImagePicker = picker();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return [];
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
    if (result.canceled) return [];
    return result.assets.map(toImage).filter((x): x is AssistantImage => x !== null);
  } catch {
    return [];
  }
}
