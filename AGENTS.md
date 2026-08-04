# Stoa — Leitplanken für Agenten

**Neu in diesem Repo? Lies ZUERST `UEBERGABE.md`** — das Übergabe-Protokoll mit
Projektüberblick, Arbeitsweise, Verifikations-Pipeline, Architektur-Landkarte,
Fallstricken und dem Fokus der aktuellen Arbeit. `ROADMAP.md` hält den
Ideen-Backlog. Dieses Dokument hier enthält die bindenden Design-Leitplanken.

## Expo

Expo SDK 56 — vor API-Nutzung die versionierten Docs prüfen:
https://docs.expo.dev/versions/v56.0.0/ (expo-file-system hat die NEUE
klassenbasierte API: `File`/`Directory`/`Paths`, kein `FileSystem.*` mehr).

## Design-Leitplanken (der griechische Vibe — bei JEDER Änderung einhalten)

Die App ist ein ruhiger, mediterraner Ort — antikes Griechenland, nicht
Achterbahn. Konkret:

- **Zwei Akzentfarben, nie mehr („Iron Rule"):** Kuppel-Blau `#2B5FA6`
  (ACCENT_A, positiv/aktiv) und Oliv `#7E8C5C` (ACCENT_B, sekundär/destruktiv).
  Kein Alarm-Rot, kein drittes Akzent-Hex. Farben immer über `useColors()`,
  nie hardcoden.
- **Typo:** Überschriften (hero/title/heading) in Cormorant Garamond
  (`CormorantGaramond_700Bold`) mit POSITIVEM Tracking (Inschriften sind
  gesperrt, nie eng); Body bleibt System-Font. Eyebrows = Tempel-Inschrift
  (Uppercase, weites Tracking). Immer über `<Type variant=…>`.
- **Meißel:** Überschriften und Eyebrows tragen ein Relief (`Type.tsx`,
  Konstante `CHISEL`) — und es KIPPT zwischen den Themes, weil die Physik
  kippt: In Light ist die dunkle Letter auf hellem Stein *eingeschnitten*
  (Lichtgrat unter der Glyphe), in Dark ist die helle Letter auf dunklem Stein
  *erhaben* (Schattengrat unter der Glyphe) — eine vertiefte Letter wäre dort
  dunkler als der Stein, nicht heller. Beide Male Versatz 1 px, Radius unter 1:
  ein weicher Schlagschatten ließe sie schweben. Für helle Schrift auf getönter
  Fläche `chisel={false}`.
- **Flächen:** `GlassPanel`/`Glass` (Steinton + Marmor-Textur) statt nackter
  Views; tonale Flächen statt Strichlinien/Umrandungen; flache, weiche
  Schatten. Eine getönte Fläche HINTER einem Zeichen bedeutet in dieser App
  „an / gewählt / aktiv" (MicButton, WeekStrip, gewähltes Symbol, gewählte
  Option) — nie Schmuck. Ein Symbol, das nur es selbst ist, liegt nackt auf
  der Platte und trägt seine Farbe im Strich. Die Platte trägt Lichtgrat oben, Schattengrat unten und zarte
  Fasen an den Seiten — sie ist behauen, nicht gezeichnet, und trägt deshalb
  KEINE Umrandung. Die Haarlinie bleibt nur getönten Flächen und Pills.
- **Seams:** Trennung innerhalb eines Panels über `<Seam>`; der Mäander
  (`variant="ornament"`) maximal EINMAL pro Panel — er ist Schmuck, kein Raster.
- **Backdrop:** Der Tempel-Hintergrund (Backdrop.tsx) bleibt unangetastet.
- **Bewegung:** zurückhaltend (Reveal/PressableScale/PopIn); nichts blinkt,
  nichts springt. Swipe-Aktionen als vollflächige Farb-Blöcke
  (`SwipeActionSlide`), Labels weiß.
- **Sprache:** UI-Texte deutsch, ruhig, ohne Ausrufezeichen-Duktus;
  Feature-Namen dürfen antik klingen (Abendbetrachtung, Braindump-Ausnahme).
  **Personen heißen „Person", nie „Mensch"** (seit v1.76.0 durchgängig
  umbenannt — in UI, Kommentaren und Bezeichnern; ältere UEBERGABE-Einträge
  tragen noch das alte Wort, weil sie ein Protokoll sind, kein Sollzustand).

## Arbeitsweise

- Jede Stufe verifizieren: `npx tsc --noEmit`, `npx jest --ci`,
  `npx expo export --platform web --clear` + Playwright-Tour gegen `dist`.
- Deutsche Commit-Messages; Branch `claude/erinnerungen-app-roadmap-qzck75`,
  danach Fast-Forward-Merge auf `main` (öffnet den IPA-Build).
- Bei jedem Release `app.json`: `version` und `ios.buildNumber` erhöhen.
- Der Gemini-Schlüssel gehört NUR in die App (Keychain) — nie in Code,
  Commits oder Tests; Assistent bleibt strikt opt-in.
