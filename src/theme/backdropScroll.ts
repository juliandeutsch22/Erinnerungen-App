// backdropScroll.ts — EIN globaler Scroll-Offset für den EINEN Wurzel-Backdrop.
//
// Früher renderte jeder Screen seinen eigenen Backdrop; beim Screenwechsel
// (Push/Zurück-Wischen) schoben sich zwei Säulen-Ebenen übereinander und die
// Säule „wanderte" über das Bild. Jetzt liegt der Backdrop EINMAL an der Wurzel
// (fest), und die Screens sind transparent — die Säule steht still, nur der
// Inhalt gleitet. Damit die Parallax-Tiefe erhalten bleibt, schreibt der aktive
// Screen seinen Scroll-Offset in diesen gemeinsamen Wert, den der Backdrop liest.
import { makeMutable } from 'react-native-reanimated';

export const backdropScrollY = makeMutable(0);
