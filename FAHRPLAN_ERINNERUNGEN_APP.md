# Fahrplan: „Stille" — persönlicher Ersatz für die iOS-Erinnerungen-App

Eine Erinnerungen-App im Cairn-Design (Liquid Glass, Teal `#1FB6A6` / Indigo
`#5B6CFF`), nur für dich, ohne App Store, ohne Backend, alles lokal.
(Arbeitstitel „Stille" — nenn sie, wie du willst.)

---

## 1. Ziel & Prinzipien

- **Ein Nutzer, ein Gerät**: kein Account, kein Sync, kein Server. Dadurch
  entfällt 80 % der Komplexität von Cairn (Supabase, Paywall, Entitlements).
- **Schneller als Apples App**: Die Kernhandlung — „Gedanke rein, Kopf frei" —
  muss in unter 3 Sekunden gehen: App auf → tippen → fertig.
- **Design 1:1 aus Cairn**: Glass-Karten, Backdrop mit Aurora, Sora-Headlines,
  ruhige Farblogik (Teal = aktiv/erledigt-Moment, Indigo = Akzent/überfällig —
  nie Rot als Dauerzustand).
- **Zuverlässige Benachrichtigungen** sind das einzige „harte" native Feature —
  daran hängt die Technologie-Entscheidung (siehe §5 und §8).

## 2. Design-Übernahme aus Cairn

Diese Dateien kannst du fast unverändert ins neue Projekt kopieren
(sie haben keine Cairn-spezifischen Abhängigkeiten):

| Datei | Zweck |
| --- | --- |
| `src/components/Glass.tsx`, `GlassPanel.tsx` | Liquid-Glass-Karten inkl. Sheen/Chroma |
| `src/components/GlassButton.tsx` | Primär-/Sekundär-Buttons |
| `src/components/GlassTabBar.tsx` | schwebende Tab-Bar |
| `src/components/Backdrop.tsx`, `RadialGlow.tsx` | Aurora-Hintergrund mit Parallax |
| `src/components/Type.tsx`, `PressableScale.tsx`, `Reveal.tsx`, `Seam.tsx`, `Skeleton.tsx`, `StateView.tsx`, `Screen.tsx` | Typo, Press-Feedback, Einblendungen, Trenner, Zustände |
| `src/theme/*` (tokens, motion, ThemeProvider, settings.store) | Farben, Radien, Abstände, Dark Mode, Reduzierte Bewegung |
| `src/lib/haptics.ts` | Haptik-Helfer |
| `src/data/kvStorage.ts` | Key-Value-Ablage (Einstellungen) |

Dazu dieselben Grundlagen: Expo + expo-router, `@expo-google-fonts/sora`,
`lucide-react-native` Icons, TanStack Query, zustand.

## 3. Funktionsumfang

### MVP (das ersetzt Apples App im Alltag)

1. **Listen** — Name, Icon (lucide), Akzentfarbe; z. B. „Privat", „Einkauf", „Arbeit".
2. **Aufgaben** — Titel, optionale Notiz, Liste, Fälligkeit (Datum, optional Uhrzeit),
   Wiederholung (täglich / wochentags / wöchentlich / monatlich / jährlich), Flagge.
3. **Smart-Ansichten**: **Heute** (fällig + überfällig), **Geplant** (chronologisch
   gruppiert: Heute / Morgen / Diese Woche / Später), **Alle**, **Erledigt** (aufklappbar,
   automatisch nach 30 Tagen ausgeblendet).
4. **Quick-Add** — eine immer erreichbare Eingabezeile („Was liegt an?") mit
   deutschem Mini-Parser: „Milch morgen", „Miete am 1. jeden monat", „Anruf mo 9:00"
   → Datum/Uhrzeit/Wiederholung werden erkannt und als entfernbare Chips angezeigt.
5. **Benachrichtigungen** — lokale, geplante Notifications pro Aufgabe;
   Aktionen direkt auf der Mitteilung: „Erledigt" und „+1 Std" (Snooze);
   Tap öffnet die Aufgabe (Deep-Link wie in Cairn).
6. **Erledigen mit Freude** — Haken mit Teal-Puls + Erfolgs-Haptik; Swipe
   rechts = erledigt, Swipe links = „Neu planen" (Heute Abend / Morgen / Wochenende / Datum).
7. **Suche** über alles.
8. **Backup** — Export/Import als JSON (wie Cairns Datenexport), damit die
   Daten den 7-Tage-Signatur-Zyklus (§8) garantiert überleben.

### V2 (wenn das MVP im Alltag läuft)

- Unteraufgaben (eine Ebene), Tags, Prioritäten
- „Planungs-Inbox": Aufgaben ohne Datum morgens durchgehen (eine pro Screen: heute / später / löschen)
- Badge-Zahl auf dem App-Icon (offene Heute-Aufgaben)
- Themes je Liste (Aurora-Färbung), Archiv für Listen

### Bewusst NICHT bauen

- iCloud-/Geräte-Sync, Teilen von Listen, Standort-Erinnerungen (Geofencing
  frisst Akku und Sonderrechte), Siri-Integration und **Home-Widgets**
  (brauchen native Extension-Targets — mit Expo möglich, aber der mit Abstand
  aufwendigste Punkt; fürs persönliche MVP streichen).

## 4. Bedienkonzept

**Tab-Bar (GlassTabBar, 3 Tabs):** Heute · Listen · Suche.
**Einstellungen** hinter einem Zahnrad im Header (weniger prominent als bei Cairn — man braucht sie selten).

- **Heute** (Startscreen): Datum-Eyebrow + Begrüßung wie Cairns Home; darunter
  überfällig (Indigo-Akzent, ruhig, kein Alarm-Rot) → heute fällig → heute ohne
  Uhrzeit. Quick-Add klebt über der Tab-Bar (Glass-Pill), Fokus per Tap,
  abschicken mit Return — Screen wechselt nicht.
- **Listen**: Grid aus Glass-Karten (Icon, Name, offene Anzahl). Tap = Liste,
  Long-Press = bearbeiten. „+ Neue Liste" als gestrichelte Geister-Karte.
- **Listen-Detail**: offene Aufgaben, Erledigt-Sektion einklappbar. Reihenfolge:
  fällige zuerst, Rest manuell (Drag & Drop via `react-native-draggable-flatlist`
  erst in V2 — MVP: fällige oben, Rest nach Erstellung).
- **Aufgaben-Editor**: Bottom-Sheet (Glass), kein eigener Screen: Titel, Notiz,
  Listen-Chips, Datums-Chips (Heute Abend / Morgen / Wochenende / Kalender),
  Uhrzeit-Chips (9:00 / 12:00 / 18:00 / eigene), Wiederholungs-Chips — dieselbe
  Chip-Sprache wie Cairns Experiment-Start (Dauer/Metrik-Chips).
- **Jede destruktive Aktion** (Liste löschen) zweistufig wie Cairns Löschdialog.

## 5. Architektur & Technologien

**Stack = exakt wie Cairn** (du kennst ihn, Claude Code kennt ihn, Design passt):

- Expo SDK 56, TypeScript strict, expo-router, React Native Reanimated
- **Speicherung: expo-sqlite**, Repository-Pattern wie in Cairn
  (`TaskRepository`, `ListRepository` + InMemory-Variante für Web/Tests),
  TanStack Query als Cache-Schicht, zustand + kvStorage für Einstellungen
- **expo-notifications** für lokale geplante Erinnerungen (KEIN Push-Server nötig)
- jest-expo für die reine Logik (Parser, Wiederholungs-Berechnung, Scheduling-Auswahl)

**Warum keine PWA?** Wäre die einzige Variante ganz ohne Signieren — aber iOS
kann in Web-Apps keine lokal *geplanten* Benachrichtigungen (nur Push über einen
Server). Für eine Erinnerungen-App ist das ein K.-o. → echte App.

### Datenmodell (SQLite)

```sql
CREATE TABLE lists (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL,
  color TEXT NOT NULL, sort INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, list_id TEXT NOT NULL REFERENCES lists(id),
  title TEXT NOT NULL, note TEXT,
  due_date TEXT,          -- 'YYYY-MM-DD' | NULL
  due_time TEXT,          -- 'HH:MM' | NULL (nur mit due_date)
  rrule TEXT,             -- 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | NULL
  flagged INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,      -- NULL = offen; bei Wiederholung: Instanz abgehakt → due_date rückt weiter
  notification_id TEXT,   -- geplante iOS-Notification (zum Ersetzen/Abbrechen)
  created_at TEXT NOT NULL, sort INTEGER NOT NULL
);
```

Wiederholung bewusst als **einfaches Enum statt echter RRULE**: beim Abhaken
wird `due_date` auf das nächste Vorkommen gesetzt und `completed_at` bleibt
NULL (die Aufgabe „wandert"). Das deckt 95 % des Alltags ab und spart eine
ganze Bibliothek.

### Erinnerungs-Engine (der einzige knifflige Teil)

- iOS erlaubt **max. 64 geplante lokale Notifications** pro App.
- Strategie: nach jeder Änderung + bei jedem App-Start werden die **nächsten
  ~50 fälligen Aufgaben mit Uhrzeit** geplant, alles andere verworfen und beim
  nächsten Öffnen nachgeplant (du öffnest die App ja täglich — Heute-Tab).
- Verwaltung pro Aufgabe über gespeicherte `notification_id` (dasselbe Muster
  wie Cairns `scheduleStored`, nie `cancelAll`).
- Notification-Kategorien mit Aktionen („Erledigt", „+1 Std") über
  `setNotificationCategoryAsync`; Antworten im `useNotificationDeepLink`-Stil
  verarbeiten.
- Aufgaben ohne Uhrzeit: eine Sammel-Notification „3 Dinge für heute" um 9:00.

## 6. Aufs iPhone ohne Apple-Developer-Account (99 €/Jahr gespart)

Die ehrliche Lage: **kostenlos geht, aber mit 7-Tage-Zyklus.** Apple erlaubt
mit einer normalen (kostenlosen) Apple-ID „Personal Team"-Signaturen:
max. 3 Apps gleichzeitig, Signatur läuft **nach 7 Tagen ab** und muss
erneuert werden. Deine Daten bleiben dabei erhalten (gleiche Bundle-ID =
gleicher App-Container; zusätzlich hast du das JSON-Backup).

**Option A — du hast einen Mac (einfachste Variante):**
1. Xcode installieren (kostenlos), Apple-ID unter Settings → Accounts anmelden.
2. Im Projekt: `npx expo prebuild -p ios`, `ios/*.xcworkspace` öffnen,
   Team = „(Personal Team)", iPhone per Kabel, ▶︎ Run.
3. Auf dem iPhone: Einstellungen → Allgemein → VPN & Geräteverwaltung → Entwickler-App vertrauen.
4. **Alle ≤7 Tage**: iPhone anstecken, ▶︎ drücken. (30 Sekunden.)

**Option B — kein Mac (Windows/Linux):**
1. GitHub Action baut ein **unsigniertes IPA** (analog zur Cairn-APK-Action:
   `expo prebuild -p ios` + `xcodebuild -configuration Release CODE_SIGNING_ALLOWED=NO`,
   `.app` in `Payload/` zippen → `.ipa`-Artifact). Läuft auf einem
   `macos-`Runner — für öffentliche Repos kostenlos, private haben ein
   Freiminuten-Kontingent.
2. Auf dem PC **Sideloadly** (oder AltStore/SideStore): IPA auswählen,
   kostenlose Apple-ID eingeben → signiert & installiert übers Kabel.
3. Erneuern ≤7 Tage: gleiches Spiel (Sideloadly merkt sich alles, 1 Klick);
   AltStore kann übers Heim-WLAN sogar automatisch nachsignieren.

**Option C — Zwischenlösung ohne jedes Signieren: Expo Go.**
App aus dem App Store, dein Projekt per `npx expo start` im WLAN öffnen.
Gut für die gesamte Entwicklungs- und Designphase; als Dauerlösung
unpraktisch (Umweg über Expo Go, eingeschränkte Notification-Zuverlässigkeit).
→ Entwickeln mit Expo Go + Web-Preview, „richtig" installieren über A/B.

**Falls dich der 7-Tage-Rhythmus irgendwann nervt:** Der bezahlte Account
(99 €/Jahr) macht daraus 1 Jahr Laufzeit via TestFlight/Ad-hoc — das ist der
einzige Unterschied, der Code bleibt identisch.

## 7. Umsetzungsschritte (in dieser Reihenfolge)

**M0 — Gerüst (½ Tag)**
- Neues Repo, `npx create-expo-app` (SDK 56, TypeScript, expo-router)
- Design-System aus Cairn kopieren (Liste §2), Fonts + Icons einrichten
- Tab-Gerüst Heute/Listen/Suche mit Backdrop + GlassTabBar
- CI-Workflow (tsc + jest + web-export) aus Cairn übernehmen

**M1 — Datenschicht (½–1 Tag)**
- SQLite-Schema + Repositories (+ InMemory für Web/Tests), Query-Hooks
- Seed: Standardliste „Erinnerungen"
- Tests: Wiederholungs-Logik (`nextOccurrence`), Überfällig-Ableitung

**M2 — Kern-UI (1–2 Tage)**
- Heute-Screen (Gruppen überfällig/heute), Listen-Grid, Listen-Detail
- Aufgaben-Editor als Bottom-Sheet mit Chip-Bedienung
- Abhaken mit Teal-Puls + Haptik, Swipe-Aktionen, Erledigt-Sektion
- **Ab hier ist die App im Web/Expo Go bereits täglich benutzbar**

**M3 — Quick-Add + Parser (½–1 Tag)**
- Eingabe-Pill mit deutschem Datums-Parser (reine Funktion + Tests:
  „morgen", „mo/di/…", „15.8.", „jeden montag", „9 uhr", „9:30")
- Erkannte Teile als Chips unterm Feld, antippen = entfernen

**M4 — Benachrichtigungen (1 Tag)**
- Permission-Flow, Scheduling-Engine (64er-Strategie, §5), Kategorien mit
  „Erledigt"/„+1 Std", Deep-Link beim Tap, Sammel-Notification 9:00
- ⚠️ nur auf echtem Gerät final testbar → hier erstes echtes Install (§6)

**M5 — Rundung (½ Tag)**
- Suche, JSON-Export/-Import, Einstellungen (Theme, Bewegung, Standard-Uhrzeit),
  Leere-Zustände, Dark-Mode-Pass mit Screenshots

**M6 — Install-Pipeline (½ Tag)**
- Option A oder B aus §6 einrichten, App aufs iPhone, 1 Woche echt benutzen,
  Reibungspunkte notieren → dann erst V2-Features

Realistisch: **MVP in 3–5 fokussierten Sessions** mit Claude Code, weil
Design-System, Datenschicht-Muster und Notification-Code aus Cairn schon
existieren und nur angepasst werden.

## 8. Fallstricke, die dich sonst Zeit kosten

1. **64-Notification-Limit** — von Anfang an mit Planungsfenster bauen (§5), nicht nachrüsten.
2. **Zeitzonen/Sommerzeit** — Fälligkeiten als lokales Kalenderdatum (`YYYY-MM-DD` + `HH:MM`) speichern, NICHT als UTC-Timestamp, sonst rutschen „ganztägige" Aufgaben um einen Tag.
3. **7-Tage-Signatur**: abgelaufene App startet nicht mehr, bis neu signiert — Daten sind aber nicht weg. Trotzdem: JSON-Backup früh bauen (M5), Erinnerung „App nachsignieren" als wiederkehrende Aufgabe in der App selbst 😄.
4. **Expo Go ≠ echtes Verhalten** bei Notifications — M4 nie nur in Expo Go abnehmen.
5. **Bundle-ID einmal festlegen** (z. B. `app.<deinname>.stille`) und nie ändern, sonst „neue App" ohne Daten.
6. Beim Kopieren von `Glass.tsx`: die Datei zieht `expo-blur` + `expo-linear-gradient` + `react-native-reanimated` mit — direkt in M0 mitinstallieren.

## 9. So startest du konkret

1. Neues GitHub-Repo `stille` (oder Wunschname), Cairn-Repo daneben als Design-Quelle.
2. Erste Claude-Code-Session mit diesem Dokument + Auftrag: „Setze M0 und M1 um,
   Design-System aus cairn kopieren, danach Screenshots."
3. Ab M2 täglich im Web-Preview/Expo Go mitbenutzen und Feedback in die nächste Session geben — genau der Loop, der bei Cairn funktioniert hat.
