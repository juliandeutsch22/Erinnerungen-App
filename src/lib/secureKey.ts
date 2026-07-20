// secureKey.ts — der Gemini-API-Schlüssel gehört in die iOS-Keychain
// (expo-secure-store), nicht in den normalen App-Speicher. Web (Dev-Preview):
// localStorage-Fallback. Lazy require, damit der Web-Bundle das native Modul
// nicht zieht.
import { Platform } from 'react-native';

const KEY = 'stoa.gemini-key';

function store(): typeof import('expo-secure-store') {
  return require('expo-secure-store') as typeof import('expo-secure-store');
}

export async function getSecureKey(): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      return globalThis.localStorage?.getItem(KEY) ?? '';
    }
    return (await store().getItemAsync(KEY)) ?? '';
  } catch {
    return '';
  }
}

export async function setSecureKey(value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (value) globalThis.localStorage?.setItem(KEY, value);
      else globalThis.localStorage?.removeItem(KEY);
      return;
    }
    if (value) await store().setItemAsync(KEY, value);
    else await store().deleteItemAsync(KEY);
  } catch {
    /* Keychain nicht verfügbar — Schlüssel bleibt dann nur im Speicher. */
  }
}
