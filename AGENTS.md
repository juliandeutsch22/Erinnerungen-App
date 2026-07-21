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
- **Flächen:** `GlassPanel`/`Glass` (bg2 + Marmor-Textur) statt nackter Views;
  tonale Flächen statt Strichlinien/Umrandungen; flache, weiche Schatten.
- **Seams:** Trennung innerhalb eines Panels über `<Seam>`; der Mäander
  (`variant="ornament"`) maximal EINMAL pro Panel — er ist Schmuck, kein Raster.
- **Backdrop:** Der Tempel-Hintergrund (Backdrop.tsx) bleibt unangetastet.
- **Bewegung:** zurückhaltend (Reveal/PressableScale/PopIn); nichts blinkt,
  nichts springt. Swipe-Aktionen als vollflächige Farb-Blöcke
  (`SwipeActionSlide`), Labels weiß.
- **Sprache:** UI-Texte deutsch, ruhig, ohne Ausrufezeichen-Duktus;
  Feature-Namen dürfen antik klingen (Abendbetrachtung, Braindump-Ausnahme).

## Arbeitsweise

- Jede Stufe verifizieren: `npx tsc --noEmit`, `npx jest --ci`,
  `npx expo export --platform web --clear` + Playwright-Tour gegen `dist`.
- Deutsche Commit-Messages; Branch `claude/erinnerungen-app-roadmap-qzck75`,
  danach Fast-Forward-Merge auf `main` (öffnet den IPA-Build).
- Bei jedem Release `app.json`: `version` und `ios.buildNumber` erhöhen.
- Der Gemini-Schlüssel gehört NUR in die App (Keychain) — nie in Code,
  Commits oder Tests; Assistent bleibt strikt opt-in.
