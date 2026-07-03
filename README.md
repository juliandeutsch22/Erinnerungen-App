# Stille

Persönliche Erinnerungen-App im Cairn-Design (Liquid Glass, Teal/Indigo) —
ein Nutzer, ein Gerät, alles lokal, kein Backend.

Fahrplan: [FAHRPLAN_ERINNERUNGEN_APP.md](./FAHRPLAN_ERINNERUNGEN_APP.md)

## Entwicklung

```bash
npm install
npm run web        # Web-Preview
npm start          # Expo Go (QR-Code)
npm run typecheck  # TypeScript
npm test           # Jest (Parser, Wiederholungs-Logik)
```

## Stack

Expo SDK 56 · TypeScript strict · expo-router · expo-sqlite (Repository-Pattern,
InMemory im Web) · TanStack Query · zustand · expo-notifications (lokal, kein Push).

## Aufs iPhone (ohne Developer-Account, Fahrplan §6)

**Option A — mit Mac:** `npx expo prebuild -p ios`, `ios/Stille.xcworkspace` in
Xcode öffnen, Team = „(Personal Team)", iPhone per Kabel, ▶︎ Run.
Alle ≤ 7 Tage neu signieren (anstecken, ▶︎ — 30 Sekunden).

**Option B — ohne Mac:** GitHub-Action **iOS IPA** manuell starten
(Actions → „iOS IPA" → Run workflow) → Artifact `stille-unsigned-ipa`
herunterladen → mit [Sideloadly](https://sideloadly.io) (oder AltStore) und der
kostenlosen Apple-ID signieren & übers Kabel installieren. Erneuern ≤ 7 Tage:
gleiches Spiel, 1 Klick.

Auf dem iPhone einmalig: Einstellungen → Allgemein → VPN & Geräteverwaltung →
Entwickler-App vertrauen. Vor dem Nachsignieren: Backup-Export in den
Einstellungen der App (Daten bleiben bei gleicher Bundle-ID ohnehin erhalten).

⚠️ Benachrichtigungen (M4) final nur auf echtem Gerät testen — Expo Go
verhält sich anders (Fahrplan §8.4).
