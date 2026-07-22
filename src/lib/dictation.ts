// dictation.ts — On-Device-Diktat (expo-speech-recognition). Die Stimme wird
// AUF DEM GERÄT zu Text (Apples Speech-Framework); nur der Text geht weiter in
// den bestehenden Assistenten-/QuickAdd-Fluss — kein Audio verlässt das Gerät,
// keine KI-Änderung. Lazy require, damit der Web-Bundle das native Modul nicht
// zieht; im Web ist es eine reine visuelle Vorschau (Dev-Preview).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const native = Platform.OS === 'ios' || Platform.OS === 'android';
// Sichtbar auch im Web (Dev-Preview zeigt den Knopf), echt nur nativ.
export const dictationAvailable = native || Platform.OS === 'web';

type SpeechModule = {
  ExpoSpeechRecognitionModule: {
    start: (opts: Record<string, unknown>) => void;
    stop: () => void;
    requestPermissionsAsync: () => Promise<{ granted: boolean }>;
    addListener: (event: string, cb: (e: unknown) => void) => { remove: () => void };
    isRecognitionAvailable?: () => boolean;
  };
};

let cached: SpeechModule | null = null;
function mod(): SpeechModule {
  if (!cached) cached = require('expo-speech-recognition') as SpeechModule;
  return cached;
}

type ResultEvent = { results?: { transcript?: string }[]; isFinal?: boolean };

/**
 * Diktat-Steuerung für ein Textfeld. `onStart` merkt sich den Feldstand, bevor
 * gesprochen wird; `onText` liefert das (kumulative) Transkript der laufenden
 * Äußerung — der Aufrufer hängt es an den gemerkten Stand. Nativ echt; im Web
 * nur der sichtbare „hört zu"-Zustand ohne echte Erkennung.
 */
export function useDictation(opts: { onStart?: () => void; onText: (transcript: string, final: boolean) => void }) {
  const { onStart, onText } = opts;
  const [listening, setListening] = useState(false);
  // true, sobald die Mikrofon-/Erkennungs-Berechtigung verweigert wurde — der
  // Aufrufer kann dann einen Hinweis zeigen (Zusatzinfo, ändert nichts am Rest).
  const [denied, setDenied] = useState(false);
  const subs = useRef<{ remove: () => void }[]>([]);

  const cleanup = useCallback(() => {
    subs.current.forEach((s) => s.remove());
    subs.current = [];
  }, []);

  // Beim Verlassen des Screens die laufende native Erkennung WIRKLICH beenden —
  // sonst bliebe das Mikrofon heiß und die Audio-Session offen. Nur Listener zu
  // entfernen genügt nicht. Empty-Dep: läuft ausschließlich beim Unmount.
  useEffect(
    () => () => {
      if (native) {
        try {
          mod().ExpoSpeechRecognitionModule.stop();
        } catch {
          /* nicht aktiv */
        }
      }
      subs.current.forEach((s) => s.remove());
      subs.current = [];
    },
    [],
  );

  const stop = useCallback(() => {
    if (native) {
      try {
        mod().ExpoSpeechRecognitionModule.stop();
      } catch {
        /* schon gestoppt */
      }
    }
    cleanup();
    setListening(false);
  }, [cleanup]);

  const start = useCallback(async () => {
    onStart?.();
    if (!native) {
      // Web-Vorschau: nur der visuelle Zustand, keine echte Erkennung.
      setListening(true);
      return;
    }
    try {
      const M = mod().ExpoSpeechRecognitionModule;
      const perm = await M.requestPermissionsAsync();
      if (!perm.granted) {
        setDenied(true);
        return;
      }
      setDenied(false);
      cleanup();
      subs.current.push(
        M.addListener('result', (raw) => {
          const e = raw as ResultEvent;
          const transcript = e.results?.[0]?.transcript ?? '';
          onText(transcript, e.isFinal === true);
        }),
      );
      subs.current.push(M.addListener('end', () => setListening(false)));
      subs.current.push(M.addListener('error', () => setListening(false)));
      // de-DE, Zwischenergebnisse live, eine Äußerung (endet nach Sprechpause).
      M.start({ lang: 'de-DE', interimResults: true, continuous: false, requiresOnDeviceRecognition: false });
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [cleanup, onStart, onText]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else void start();
  }, [listening, start, stop]);

  return { available: dictationAvailable, listening, denied, toggle };
}
