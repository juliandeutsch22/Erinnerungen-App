// motion.tokens.ts — 1:1 aus dem VIBE-Brief übernommen (Build-Spec §7.3 Hinweis).
//
// Philosophie (Emil Kowalski): UI-Animationen < 300 ms. Nie `ease-in` für UI.
// Enter/Exit = ease-out, Bewegung/Morph = ease-in-out. Eine Bewegung pro Aktion.
//
// WICHTIG: Easing MUSS aus reanimated kommen — diese Tokens werden in
// reanimated-`withTiming` benutzt (Appear.tsx). RNs `Easing.bezier` ist eine
// reine JS-Funktion; im UI-Thread-Worklet (nur nativ!) ist sie nicht erreichbar
// → HARTER Absturz am Gerät, während der Web-Build (Worklet auf JS-Thread) läuft.
import { Easing } from 'react-native-reanimated';

export const Ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1), // Default: Entering/Feedback/Dismiss
  inOut: Easing.bezier(0.77, 0, 0.175, 1), // Bewegung über den Screen (Morph/Reorder)
  ios26: Easing.bezier(0.25, 0.46, 0.45, 0.94), // crisp enter ohne Delay
  drawer: Easing.bezier(0.32, 0.72, 0, 1), // Sheets / große Panels
  std: Easing.bezier(0.4, 0, 0.2, 1), // Hover / sanfte Color-Shifts
  linear: Easing.linear, // nur konstante Bewegung (Progress, Fades)
} as const;

// Dauern (ms). Nie Zufallszahlen.
export const Dur = {
  press: 90,
  pressOut: 160,
  tooltip: 130,
  popover: 190,
  card: 250,
  sheet: 360,
  counter: 520,
  explosion: 500,
} as const;

// Springs (iOS-26-Physik, überdämpft). Werte als {tension, friction} —
// für react-native-reanimated in {stiffness, damping} gemappt (siehe spring() Helper).
export const Spring = {
  snappy: { tension: 280, friction: 18 }, // Default: Tabs, Listen, State-Changes
  playful: { tension: 200, friction: 10 }, // Celebration, erstes Reveal (Bounce)
  gentle: { tension: 140, friction: 16 }, // nicht-interaktive Reveals (Toast, Banner)
  tight: { tension: 380, friction: 26 }, // Press-Release (kein Overshoot)
  fluid: { tension: 160, friction: 20 }, // Sheets / Modals (schwerer, buttery)
} as const;

export type SpringToken = keyof typeof Spring;

// Reanimated nutzt stiffness/damping/mass statt tension/friction.
// Mapping (Standard React-Native-Animated-Konvention, mass = 1):
//   stiffness = tension, damping = friction
export function springConfig(token: SpringToken) {
  const { tension, friction } = Spring[token];
  return { stiffness: tension, damping: friction, mass: 1 };
}
