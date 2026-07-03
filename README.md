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
