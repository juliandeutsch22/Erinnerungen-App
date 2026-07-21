// appLock.ts — optionale Face-ID-/Code-Sperre (expo-local-authentication).
// Lazy require, damit der Web-Bundle das native Modul nicht zieht; im Web
// (Dev-Preview) ist die Sperre schlicht nicht verfügbar.
import { Platform } from 'react-native';

export const appLockAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

function la(): typeof import('expo-local-authentication') {
  return require('expo-local-authentication') as typeof import('expo-local-authentication');
}

/** Gerät hat Biometrie/Code eingerichtet → Sperre anbietbar. */
export async function canUseAppLock(): Promise<boolean> {
  if (!appLockAvailable) return false;
  try {
    const mod = la();
    if (!(await mod.hasHardwareAsync())) return false;
    // isEnrolled = Face ID/Touch ID eingerichtet; ohne Biometrie greift der
    // Gerätecode als Fallback (deviceCredentials) — beides zählt.
    return (await mod.isEnrolledAsync()) || (await mod.getEnrolledLevelAsync()) !== mod.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Entsperren: Face ID zuerst, Gerätecode als Fallback. */
export async function authenticateAppLock(): Promise<boolean> {
  if (!appLockAvailable) return true;
  try {
    const res = await la().authenticateAsync({
      promptMessage: 'Stoa entsperren',
      cancelLabel: 'Abbrechen',
    });
    return res.success === true;
  } catch {
    return false;
  }
}
