# ÜBERGABE-PROTOKOLL — Stoa

Stand: **v1.24.1 (Build 47)**, Juli 2026 · 177 Jest-Tests grün · Branch-Modell siehe §3.
Dieses Dokument macht eine neue Session sofort arbeitsfähig. Lies zusätzlich
`AGENTS.md` (bindende Design-Leitplanken) und `ROADMAP.md` (Ideen-Backlog).

---

## 1. Was ist Stoa — und für wen

Persönliche **Single-User-iOS-App** für Julian: Erinnerungen/Aufgaben, Gerätekalender
(EventKit), Notizen, KI-Assistent (eigener Gemini-Schlüssel), Abendbetrachtung
(Journal), Fotos & Dokumente an Terminen, Backup. **Alles lokal, kein Backend,
keine laufenden Kosten.** Verteilung: unsigniertes IPA über die GitHub Action
(läuft bei Push auf `main`) → Sideload mit 7-Tage-Signatur-Zyklus.

**Ethos (wichtiger als jedes Feature):** ruhig, mediterran-antik, kein Druck.
Kein Alarm-Rot, keine Schuld-Zähler, keine Engagement-Tricks. Überfälliges ist
ruhiges Indigo. Weniger App ist ein Feature. Der Name „Stoa" ist **vorläufig**
— der Nutzer ist damit noch nicht ganz zufrieden; Vorschläge willkommen, aber
nur auf Nachfrage.

**Nie ändern:** `slug`/`scheme` = `stille`, `bundleIdentifier` = `app.julian.stille`
(Sideload-Identität). Nur `name` ist der Anzeigename.

## 2. Wie der Nutzer arbeitet — und was er erwartet

- **Sprache:** Deutsch. Berichte in klarer Prosa, kurz strukturiert; bei
  UI-Arbeit Screenshots mitliefern (Playwright-Shots per SendUserFile).
- **Muster:** Er fragt oft erst nach Meinung/Ideen → Antwort als nummerierte
  Liste mit ehrlicher Empfehlung → er wählt („1, 3, 5 umsetzen", „ja starte
  direkt") → dann **voll umsetzen ohne Rückfragen**, in vollem Umfang.
- **Jede Stufe ist ein Release:** verifizieren (§4) → `app.json` `version`
  **und** `ios.buildNumber` erhöhen → deutscher Commit → Push auf den
  Arbeits-Branch → **Fast-Forward-Merge auf `main`** (löst den IPA-Build aus).
- **Fehlerberichte kommen als Screenshots** vom iPhone. Erst Ursache
  diagnostizieren und benennen, dann fixen, dann als Release ausliefern.

### Sicherheitsregeln (nicht verhandelbar)
- Der **Gemini-Schlüssel wird NIE angefordert oder eingesehen** — er lebt nur
  in der App (Keychain via `lib/secureKey.ts`). Tests laufen mit gemockter API
  (`page.route('**/generativelanguage.googleapis.com/**', …)`).
- Der Assistent ist strikt **opt-in**; ohne Schlüssel bleibt die App vollständig
  offline. Nie ohne Bestätigungs-Tipp in den Datenbestand schreiben
  (Aktions-Karten-Muster).
- Die **Abendbetrachtung verlässt das Gerät nie** unaufgefordert (bewusst nicht
  im App-Schnappschuss).
- Keine KI-Modell-IDs der Entwicklungsumgebung in Commits/Artefakten; den von
  der Umgebung vorgegebenen Commit-Footer exakt übernehmen.

## 3. Git & Release

- Entwicklung auf dem von der Session vorgegebenen `claude/…`-Branch,
  danach `git checkout main && git merge --ff-only <branch> && git push origin main`
  und zurück auf den Branch. Öffentliches Repo — nichts Privates committen.
- Commit-Messages: Deutsch, erste Zeile = was + Versionsnummer.
- `main` = ausgeliefert. Kein Commit auf `main` ohne volle Verifikation.

## 4. Verifikations-Pipeline (Pflicht vor jedem Commit)

```bash
cd /home/user/Erinnerungen-App        # Shell-cwd springt gern auf /home/user zurück!
npx tsc --noEmit
npx jest --ci                          # aktuell 134 Tests
npx expo export --platform web --clear # Web-Build als Smoke-Test
```

**Playwright-Tour gegen `dist`** (UI-Änderungen immer so verifizieren):
- Chromium: `/opt/pw-browsers/chromium`, Modul:
  `require('/opt/node22/lib/node_modules/playwright/index.js')`
- Server: `(npx serve /home/user/Erinnerungen-App/dist -l 8899 >/dev/null 2>&1 &) ; sleep 3`
  — **Absolutpfad** (cwd-Reset!), Prozess stirbt zwischen Bash-Aufrufen.
- Kein Deep-Link (`serve` hat keinen SPA-Fallback) → immer in der App navigieren.
- Gemini mocken via `page.route`; Uhrzeit einfrieren via
  `page.clock.setFixedTime(new Date('…'))` (Abendbetrachtung erscheint ab 18 Uhr).
- Mehrdeutige „Zurück"-Buttons im Stack → `.last()`; Web-Artefakte (Klick-
  Durchschlag nach Drags, Cormorant-Render während Transforms) nicht mit
  iOS-Bugs verwechseln. Natives (Tastatur, Picker, QuickLook, EventKit,
  Notifications) ist im Web nicht prüfbar → im Bericht ehrlich als
  „am Gerät gegenprüfen" ausweisen.

## 5. Architektur-Landkarte

```
src/app/            expo-router: (tabs)/{heute,kalender,notizen,listen,suche}
                    + einstellungen, chats, chat/[id], braindump, journal,
                    rueckblick, notiz/[id], aufgabe/, liste/, filter
src/components/     Design-System + Feature-Bausteine (§6)
src/data/           Repository-Muster: Interface + InMemory (Web/Tests) +
                    Sqlite* (lazy require) + Factories/Singletons in index.ts
                    + __set*ForTests-Injektoren; TanStack-Query-Hooks in
                    *Queries.ts; db.ts = CREATE TABLE IF NOT EXISTS +
                    try/catch-ALTER-Migrationen; backup.ts (§7)
src/lib/            Reine Logik (immer testbar halten!): taskLogic, noteLogic,
                    journalLogic, calendarLogic, dayTimeline, quickAddParser,
                    assistant, autoBackup, orphanDocuments, notifications,
                    deviceCalendar, deviceReminders, photos, documents, dates …
src/theme/          Tokens, ThemeProvider, settings.store (zustand persist)
```

**Grundregeln:**
- Termine leben **nur** im Gerätekalender (EventKit) — unsere DB hält bloß
  Verknüpfungen über `eventId` (Tasks, Notizen, Fotos, Dokumente, Chats).
- Neue Features bekommen: Repository (3 Implementierungen) + Query-Hooks +
  reine Logik in `lib/` **mit Jest-Test** + Backup-Integration + ggf. Suche.
- Startlogik in `_layout.tsx` (Reihenfolge beachten): Hydration → Notification-
  Kategorien/Fenster + Journal-Erinnerung neu planen → Keychain-Hydration →
  wöchentliches Auto-Backup → Dokumente-Aufräumer → AppState-Listener
  (Aufwachen = Queries invalidieren, sonst zeigt „Heute" morgens gestern).

## 6. Design — bindend (Langfassung in AGENTS.md)

Zwei Akzente (**#2B5FA6** Kuppel-Blau, **#7E8C5C** Oliv), nie ein drittes, nie
Rot. Headings in Cormorant Garamond (`Type`-Varianten, positives Tracking —
Inschriften sind gesperrt). Flächen über `GlassPanel`/`Glass` (Marmor), tonale
Flächen statt Ränder, flache Schatten. `Seam` trennt innerhalb eines Panels,
Mäander (`variant="ornament"`) max. 1×/Panel. Backdrop-Tempel nicht anfassen.
Bewegung ruhig (`Reveal`, `PressableScale`, `PopIn`, `Appear` — kleiner
Mount-Auftritt: Opacity + optional Versatz/Skalierung über die `Ease`/`Dur`-
Tokens, Shared-Value-basiert = web+nativ robust, `skip`/Reduced-Motion → sofort
da). Im Chat: Nutzer-Nachricht tritt von rechts auf, Streaming-Text steigt
sanft an die Stelle der Denk-Punkte, Aktionskarte blendet aus scale 0.96 ein —
aber NUR neue Nachrichten (geladener Verlauf via `skip` sofort da). Swipes = vollflächige
Farb-Blöcke (`SwipeActionSlide`, Teal = positiv, Indigo/Oliv = destruktiv).
UI-Texte deutsch und gelassen.

**Bausteine zuerst wiederverwenden:** Type, GlassPanel/GlassButton, Seam, Chip,
PressableScale, Reveal, BottomSheet (+SheetParts), SwipeActionSlide,
DisclosureChevron, StateView (Empty/Loading), KeyboardDone, Highlighted,
PhotoStrip/PhotoViewer, DocumentStrip, JournalCard, LinkedNotes/LinkedChats,
ChatLinkSheet, QuickAdd, TaskRow/EventRow, WeekStrip, DayTimeAxis,
MiniCalendar/CalendarMonth, ProgressLine, PulseDot, TaskCheck.

## 7. Feature-Inventar (v1.16.0) — Kurzreferenz

- **Sperre (optional):** Face-ID-/Code-Sperre beim Öffnen und beim Aufwachen
  aus dem Hintergrund (`AppLockGate` in `_layout.tsx`, `lib/appLock.ts`,
  `appLockEnabled` im Store; Schalter in den Einstellungen nur, wenn das Gerät
  Biometrie/Code kann). Web/ohne Hardware: greift nie. **Am Gerät gegenprüfen.**
- **Teilen:** Notiz (Body) und Liste (formatierter Text — Überschrift, Ziel/
  Deadline, offene/erledigte Aufgaben, Unteraufgaben) via Share-Sheet
  (`lib/share.ts` + reine `lib/shareText.ts` mit Test); Share-Icon in der
  Kopfzeile von Notiz-Editor und Listen-Detail.
- **Assistent-Feinschliff:** Prompt-Chips im leeren Chat (kontextabhängig,
  `promptChips` in assistant.ts) und stiller Auto-Titel nach dem ersten
  Austausch (`generateChatTitle` über die Lite-Kette, `sanitizeChatTitle`
  rein+getestet; manuelles Umbenennen gewinnt immer via `userRenamedRef`).
- **Erster Start:** einmalige Willkommens-Karte auf Heute (WelcomeCard.tsx:
  Lokal-Versprechen, QuickAdd-Tipp, erklärter Kalender-Zugriff, Assistent-
  Hinweis; `welcomeDismissed` im Settings-Store).
- **Papierkorb überall:** Aufgaben und Listen haben jetzt wie Notizen/Chats
  „Zuletzt gelöscht" (30 Tage, Sektion im Listen-Tab). `deletedAt` optional
  auf Task/List; useTasks/useLists liefern nur Aktive, der Papierkorb hat
  eigene Hooks. Listen-Löschung stempelt ihre aktiven Aufgaben mit DEMSELBEN
  Zeitstempel — Wiederherstellen bringt genau diese zurück. Endgültig =
  useDelete*Forever. Notifications/Duplizieren/Backup-Bericht filtern den
  Papierkorb.
- **Ehrliches Backup:** Export zeigt einen Bericht (summarizeBundle/
  describeSummary in backup.ts) inkl. Dokumenten ohne eingebetteten Inhalt
  (> 10 MB) — der offene Faden von früher ist damit geschlossen.
- **Heute:** Tages-Bilanz, Überfällig (+ „Auf heute"), chronologischer Tagesplan
  (Termine+Aufgaben verschmolzen, Jetzt-Marker), Ohne Uhrzeit, Erledigt
  (einklappbar), Wochenvorschau, QuickAdd (deutscher Parser: „morgen 18 uhr",
  „in 3 tagen", „monatsende", Listen-#, …), Abendbetrachtungs-Karte ab 18 Uhr.
- **Kalender:** Monat + Wochenband + Agenda, Event-Editor (BottomSheet) mit
  Aufgaben am Termin, verknüpften Notizen/Chats, Fotos, Dokumenten (Picker →
  Container-Kopie → QuickLook), mehrtägigen Terminen, Timeboxing.
- **Notizen:** Apple-Notes-Parität (Datumsgruppen, Anheften, 30-Tage-Papierkorb),
  Checklisten-Block, Verknüpfung zu Aufgabe/Termin, Editor-Tastatur gelöst.
- **Listen/Projekte:** Ziel + Deadline + Fortschritt, Vorlagen (duplizieren),
  Tags, Unteraufgaben, Smart-Filter (gespeichert), Drag&Drop. **Tag-Chips auf
  der Aufgabenzeile sind tippbar** → `/filter?tag=…` (Ad-hoc-Ansicht für genau
  diesen Tag).
- **Assistent:** Chats (30-Tage-Papierkorb, umbenennbar über den Titel im
  Chat-Kopf, Löschen zweistufig), Verknüpfung an Termin (Snapshot-
  Kontext) / Notiz / Aufgabe (Live-Kontext), **App-Schnappschuss** in jedem
  Senden (Termine ~5 Wochen, offene Aufgaben, Listen, Notiz-Titel; abschaltbar;
  ohne Journal), `stoa-aktionen`-Block → Aktionskarte (einzeln abwählbar,
  deutsche Datumsanzeige; Aufgaben/Checklisten/Notizen anlegen — **Checkliste
  ohne verknüpfte Notiz wird als NEUE Notiz angelegt statt still verworfen**),
  „Plane meinen Tag", Braindump, „Als Notiz speichern", Datum immer im Prompt.
  **Antworten streamen** (SSE via `streamGenerateContent` + `expo/fetch`;
  reißt der Stream ab, zählt der schon erhaltene Text; ohne Stream-Support
  wird der SSE-Body am Stück geparst) und werden als **Markdown-Licht gesetzt**
  (`lib/markdown.ts` + `MarkdownText`: Listen, Überschriften in der Antiqua,
  fett/kursiv, tappbare Links); Nutzer-Nachrichten sind randlose tonale
  Flächen, Antworten frei gesetzter Text, Warten = drei atmende Punkte.
  Modell-Ketten: `gemini-3.5-flash` → `gemini-flash-latest`
  → 2.5 → 2.0; bei 429 Lite-Kette; bei 404 überall Live-Modellsuche (ListModels);
  5xx wandert durch die Ketten + 1 Retry nach 1,5 s.
  **Diktat (Sprach-Eingabe):** Mikrofon-Knopf in der Chat-Eingabe und im
  Braindump (`MicButton` + `lib/dictation.ts`, expo-speech-recognition).
  On-Device — die Stimme wird lokal zu Text, nur der Text geht in den
  bestehenden Fluss (kein Audio zu Google, keine KI-Änderung). Füllt nur das
  Feld, gesendet/sortiert wird manuell → alle Bestätigungs-Invarianten bleiben.
  Nativ echt, im Web reine visuelle Vorschau. **Am Gerät gegenprüfen.**
- **Abendbetrachtung:** 1 Eintrag/Tag, Autosave, stille Kette, Verlauf mit
  Bearbeiten/Löschen (zweistufig), optionale tägliche Erinnerung (überlebt
  Neuinstallation durch Neu-Planung beim Start), Suche, Backup.
- **Rückblick:** Galerie ALLER Termin-Fotos — auch gelöschter Termine
  (**deshalb Fotos nie automatisch aufräumen!**). Dokumente-Aufräumer dagegen
  entsorgt Anhänge von Terminen, die seit 60 Tagen fehlen (`orphanDocuments.ts`).
- **Backup:** JSON inkl. Fotos + Dokumente (≤ 10 MB/Datei) + Journal + Chats;
  wöchentliches Auto-Backup nach Dateien→Stoa→Backups (Rotation 4); Restore-
  Liste; Schutz-Backup vor jedem Import. Import-/Export-Import immer tolerant
  gegenüber alten Ständen (schemaVersion 1–3).
- **Import:** Apple-Erinnerungen (Dedupe), Notizen-Einfügen.
- **Suche:** Aufgaben (Titel, Notiz, **Tags und Unteraufgaben** — reine
  `taskMatchesQuery` in taskFilters.ts, getestet), Listen, Notizen, Chats,
  Dokumente, Abendbetrachtung — mit Treffer-Highlighting, Bereichs-Chips als
  Filter und „Zuletzt gesucht"
  (max. 6, lokal in den Settings; gemerkt beim Öffnen eines Treffers).
  Leerzustände app-weit über das zentrierte `EmptyState`-Muster (Glyphe in
  runder Stein-Well + Inschrift-Titel); Hinzufügen-Kacheln sind tonale Wells
  statt Strichlinien; Dunkelmodus liegt auf Schiefer-Blau statt reinem Schwarz.

## 8. Teuer erkaufte Fallstricke — nicht neu lernen!

1. **ReanimatedSwipeable:** `onSwipeableWillOpen(direction)` meldet die
   BEWEGUNGSrichtung — `'right'` = nach rechts gewischt = **linke** Aktion.
2. **Tastatur-Muster je Kontext:** Chat = KeyboardAvoidingView + scrollToEnd
   bei `keyboardWillShow`/`DidShow` + onLayout-Shrink-Pin. Heute/Journal =
   `automaticallyAdjustKeyboardInsets` + `scrollHandle` (Screen-Prop) +
   Fokus-Scroll. Notiz-Editor = `keyboardDismissMode="on-drag"` +
   `rejectResponderTermination={false}` (Refokus-Schleife!) + „Fertig" oben.
   Mehrzeilige Felder brauchen `KeyboardDoneBar` (+ `keyboardDoneProps`) —
   eine pro Fenster (Sheets/Modals sind eigene Fenster).
3. **expo-file-system SDK 56 = NEUE API:** `File`/`Directory`/`Paths`,
   `file.write(base64, {encoding:'base64'})`, `await file.base64()`,
   `create({overwrite:true})`. Kein `FileSystem.*` mehr.
4. **LLM-Antworten:** echte Zeilenumbrüche in JSON-Strings → `extractActions`
   parst zweistufig. System-Prompt braucht IMMER das heutige Datum.
5. **EventKit:** IDs können bei Sync flackern (deshalb 60-Tage-Frist im
   Aufräumer); Abfragefenster max. ~4 Jahre.
6. **iOS-Notifications:** max. 64 geplant → Fenster-Strategie in
   `notifications.ts`, nie `cancelAll`; geplante Notifications überleben keine
   Neuinstallation → beim Start neu planen (ohne Permission-Prompt!).
   **Aktionen („Erledigt"/„+1 Std") aus dem BEENDETEN Zustand:** der Live-
   `addNotificationResponseReceivedListener` allein reicht nicht — die
   app-startende Antwort kann vor dem Listener eintreffen. Deshalb beim Mount
   zusätzlich `getLastNotificationResponseAsync()` abfragen, mit Dedupe-Set
   über `identifier:actionIdentifier` (v1.20.1). Nur am Gerät prüfbar.
7. **Patch-Disziplin:** kritische UI-Edits nur mit gezielten Edits pro Datei,
   keine Batch-Regex-Skripte (haben schon stumm Edits verschluckt).
8. **Diktat/Mikrofon:** Beim Verlassen des Screens die native Erkennung mit
   `ExpoSpeechRecognitionModule.stop()` beenden, nicht nur die Listener
   entfernen — sonst bleibt das Mikrofon heiß und die Audio-Session offen
   (v1.22.0). Der Unmount-Effekt in `lib/dictation.ts` erledigt das.
9. **Backdrop bleibt PRO SCREEN** (nicht an die Wurzel ziehen): Ein Versuch mit
   EINEM Wurzel-Backdrop + transparenten Stack-Karten (v1.24.0) hat die Screens
   beim Tab-Wechsel durchscheinen lassen (keine Deckung mehr) und wurde in
   v1.24.1 zurückgenommen. Jeder Screen rendert wieder seinen eigenen opaken
   `<Backdrop>`; die Karten sind opak (`contentStyle.backgroundColor: colors.bg`).
   Das „Säule wandert beim Zurück-Wischen"-Thema ist damit bewusst NICHT über
   Transparenz gelöst — falls erneut angegangen, unbedingt zuerst am Gerät die
   Deckung bei Tab-/Stack-Wechseln prüfen.
10. **Assistent-Generierung läuft IM Chat-Screen** (nicht in einen globalen
   Store auslagern ohne Gerätetest): Ein entkoppelter zustand-Store (v1.24.0)
   sollte laufende Antworten das Verlassen des Chats überleben lassen, stand aber
   im Verdacht, am Gerät beim Absenden abzustürzen, und wurde in v1.24.1 auf die
   bewährte In-Komponenten-Generierung zurückgesetzt. Wer das Feature erneut will:
   erst am Gerät verifizieren, nicht nur im Web.

## 9. Fokus der nächsten Session: Design + neue Ideen + Features

**So Ideen entwickeln:**
1. `ROADMAP.md` lesen — dort liegt der kuratierte Backlog (u. a. Chronik „An
   diesem Tag", Tagesmaxime, Routinen/Säulen-Streaks, Tages-Highlight,
   Fokus-Timer, Wochentafel-Export, Terrakotta-Thema, lebendiger Tempel,
   Erledigt-Moment, Klang; Rahmen: TestFlight, Face-ID, Papierkorb ausweiten;
   Assistent: Prompt-Chips, Streaming, Auto-Titel; natives Kapitel G: Widget/
   Share-Extension/Siri/Live Activity — bewusst geparkt).
2. Jede Idee am Ethos messen (§1): macht sie die App ruhiger oder lauter?
   Lokal? Ohne Kosten? Ohne Druck?
3. Durchdenken bis zur Umsetzbarkeit: UX-Fluss, Datenmodell, Backup-/Such-/
   Assistent-Integration, Aufwand — dann als nummerierte Liste mit ehrlicher
   Empfehlung präsentieren und auf die Auswahl warten.
4. Bei Design-Iterationen: Playwright-Screenshots als Vergleich anbieten;
   Feedback kommt oft als iPhone-Screenshot mit kurzem Satz — ernst nehmen,
   die Ursache liegt häufig eine Ebene tiefer (siehe Tastatur-Historie).

**Bekannte offene Fäden:**
- Dokumente > 10 MB fehlen im Backup (bewusst; Optionen: Limit anheben oder
  beim Export ausweisen).
- Assistent-Feinschliff: Prompt-Chips, Streaming, automatische Chat-Titel.
- Name der App (vorläufig „Stoa").
- TestFlight-Frage (99 €/Jahr) — beendet den 7-Tage-Zyklus, Entscheidung offen.
