// PopIn.tsx — kleiner Auftritt für bedingt gerenderte Elemente (Senden-Button,
// Parser-Chips): federt beim Mounten von 60 % auf volle Größe statt hart
// aufzupoppen. Eine Bewegung pro Aktion; Reduced-Motion → sofort da.
//
// Seit v1.58.0 kann er auch WIEDER GEHEN. Vorher federte alles herein und
// verschwand dann hart — und ein harter Schnitt nach einem weichen Auftritt
// liest sich als Fehler, nicht als Ruhe. Wer einen Abgang will, steuert
// `sichtbar` und räumt in `onWeg` auf (erst dann wird abgebaut).
//
// `von` ist die Anfangsgröße. 0.6 ist für kleine Bedienelemente richtig (ein
// Knopf darf federn), für eine MELDUNG aber zu viel Persönlichkeit — sie soll
// erscheinen, nicht auftreten. Dafür 0.94 und die weiche Feder.
import React, { useEffect } from 'react';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Dur, Ease, springConfig, type SpringToken } from '@/theme/motion.tokens';
import { useReducedMotion } from '@/theme/ThemeProvider';

export function PopIn({
  children,
  von = 0.6,
  feder = 'snappy',
  /** Steuert den Abgang. Default `true` = das alte Verhalten, kein Abgang. */
  sichtbar = true,
  /** Läuft NACH dem Ausblenden — hier abbauen, nicht vorher. */
  onWeg,
}: {
  children: React.ReactNode;
  von?: number;
  feder?: SpringToken;
  sichtbar?: boolean;
  onWeg?: () => void;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (sichtbar) {
      p.value = reduced ? 1 : withSpring(1, springConfig(feder));
      return;
    }
    if (reduced) {
      onWeg?.();
      return;
    }
    // Abgang bewusst mit `withTiming`, nicht mit einer Feder: eine Feder
    // schwingt am Ende nach, und etwas, das im Verschwinden noch zappelt,
    // wirkt unentschlossen. Ease.out, kurz — der Nutzer hat hier nichts mehr
    // zu entscheiden, das System räumt nur auf.
    p.value = withTiming(0, { duration: Dur.pressOut, easing: Ease.out }, (fertig) => {
      if (fertig && onWeg) runOnJS(onWeg)();
    });
    // `onWeg` bewusst NICHT in den Abhängigkeiten: eine bei jedem Rendern neu
    // gebaute Funktion würde den Abgang sonst endlos neu starten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sichtbar, reduced, feder, p]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: von + p.value * (1 - von) }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
