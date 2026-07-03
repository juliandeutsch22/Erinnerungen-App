// haptics.ts — dezentes taktiles Feedback (nur nativ). Auf Web/nicht unterstützten
// Plattformen No-Op. Fehler werden geschluckt (Haptik ist nie kritisch).
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

/** Leichter Tap — für Buttons/Auswahl. */
export function hapticTap(): void {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Weiche Auswahl-Vibration — z. B. beim Abwählen. */
export function hapticSelect(): void {
  if (!enabled) return;
  Haptics.selectionAsync().catch(() => {});
}

/** Erfolgs-Feedback — Fokus erledigt, Trial gestartet, Kauf abgeschlossen. */
export function hapticSuccess(): void {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
