// share.ts — dünner Wrapper um das native Share-Sheet (RN Share). Web fällt
// still auf die Zwischenablage zurück (Dev-Preview hat kein Share-Sheet).
import { Platform, Share } from 'react-native';

export async function shareText(text: string, title?: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      /* Web-Vorschau ohne Clipboard — nichts weiter zu tun */
    }
    return;
  }
  try {
    await Share.share(title ? { message: text, title } : { message: text });
  } catch {
    /* Nutzer hat abgebrochen — kein Fehler */
  }
}
