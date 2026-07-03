// useKeyboardHeight.ts — präzise iOS-Tastaturhöhe für Sheets/Pills.
// KeyboardAvoidingView ist in Modals + bei position:absolute unzuverlässig
// (verschiebt zu weit oder gar nicht) — deshalb manuell über die Keyboard-
// Events. Android regelt das Fenster selbst (adjustResize) → dort 0,
// Web hat keine Soft-Tastatur-Events → ebenfalls 0.
import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // willChangeFrame deckt Einblenden, Höhenwechsel (Emoji/QuickType) und
    // Splitscreen ab; screenY = Oberkante der Tastatur in Screen-Koordinaten.
    const onFrame = Keyboard.addListener('keyboardWillChangeFrame', (e) => {
      const screenHeight = Dimensions.get('screen').height;
      setHeight(Math.max(0, screenHeight - e.endCoordinates.screenY));
    });
    const onHide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      onFrame.remove();
      onHide.remove();
    };
  }, []);

  return height;
}
