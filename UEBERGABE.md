# ÜBERGABE-PROTOKOLL — Stoa

Stand: **v1.31.0 (Build 59)**, Juli 2026 · 203 Jest-Tests grün · Branch-Modell siehe §3.

> ⚠️ **Native-Falle (gekostet: mehrere Fehl-Releases):** `Easing` für Reanimated
> **immer** aus `react-native-reanimated` importieren, NIE aus `react-native`.
> RNs `Easing.bezier` ist eine JS-Funktion — in einem Reanimated-`withTiming`/
> `withRepeat`-Worklet läuft sie am Gerät auf dem UI-Thread, wo sie nicht
> existiert → **harter nativer Absturz**, während der Web-Build (Worklet auf dem
> JS-Thread) fröhlich weiterläuft. Das ist genau der Chat-Absturz „beim Senden"
> gewesen (v1.24.0–v1.27.1): `motion.tokens.ts` zog `Easing` aus `react-native`,
> `Appear` schob es in `withTiming`. Web-Tests konnten es NIE zeigen — nur das
> Gerät. Merke: stürzt etwas nur nativ ab, aber nie im Web, zuerst nach
> JS-Funktionen in Worklets suchen (Easing, Callbacks ohne `worklet`-Direktive).

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
10. ~~**Assistent-Generierung läuft IM Chat-Screen**~~ — **DIESER EINTRAG WAR
   FALSCH.** Der entkoppelte Store (v1.24.0) wurde in v1.24.1 zurückgenommen,
   weil er im Verdacht stand, den Chat am Gerät abstürzen zu lassen. Die
   tatsächliche Ursache war das `Easing` aus react-native in einem
   Reanimated-Worklet (gefunden in v1.27.2, siehe Warnkasten oben). Der Store
   war unschuldig. Seit v1.44.0 gibt es ihn wieder (`lib/assistantRun.ts`) —
   diesmal mit der Regel, die ihn sicher macht: **die laufende Funktion
   schreibt ausschließlich in den Store, nie in Komponenten-State.** Ein
   unmontierter Bildschirm ist damit kein Sonderfall, sondern nur ein Leser,
   der gerade nicht da ist. Lehre fürs nächste Mal: Wenn ein Verdacht sich als
   falsch erweist, gehört auch die daraus gezogene Regel widerrufen.
11. **Sprach-Schnellzugriff** (`components/QuickVoiceSheet.tsx`, v1.25.0): Der
   Mic-Knopf auf „Heute" öffnet ein Sheet (im absturzsicheren `BottomSheet`, KEIN
   eigener GestureDetector), das sofort diktiert; eine Sprechpause (Diktat
   `continuous:false` → `end`-Event → `listening=false`) schickt das Gesagte ohne
   Senden-Knopf an den Assistenten (`buildBraindumpContext` erzwingt den Aktions-
   Block, wie beim Braindump). Erkanntes wird bestätigt (Tipp), „Weiter sprechen"
   hängt an. WICHTIG: Diktat beim Schließen stoppen — das Sheet ist dauerhaft in
   „Heute" gemountet, also stoppt der `visible=false`-Effekt die Erkennung (das
   Unmount-Cleanup von `useDictation` greift hier NICHT). `QuickVoiceView` ist rein
   präsentativ (im Web pro Zustand screenshot-bar); das echte Zuhören nur am Gerät.
   Verweigerte Mikrofon-Berechtigung wird abgefangen: `useDictation` liefert
   zusätzlich `denied` (rein additiv), das Sheet zeigt dann einen ruhigen Hinweis
   mit „Einstellungen öffnen" statt endlosem „hört zu" (v1.25.1).
12. **Assistent legt Termine an** (v1.26.0): Aktions-Schema kennt `termine`
   (`assistant.ts`), Anlegen über `createAssistantEvent`/`useCreateAssistantEvents`
   in Chat/Braindump/Sprach-Sheet. `buildEventDraft` ist rein/getestet; das
   Schreiben in den Kalender ist nativ (nur am Gerät prüfbar).
13. **Teilen an Stoa — Stufe 1 (Deep-Link, v1.26.1):** Braindump liest einen
   `text`-Suchparameter (`stille://braindump?text=…`) und füllt das Feld vor.
   Der Nutzer richtet dazu einen iOS-Kurzbefehl „An Stoa senden" ein (Share-Sheet-
   Eingabe → URL-encoden → diesen Deep-Link öffnen). REIN JS, kein nativer
   Eingriff. Stufe 2 (echte native Share-Extension mit App Group) ist bewusst als
   eigener, sorgfältig zu verifizierender Build-Schritt geparkt.
14. **Steintextur (`assets/images/marble-*.jpg`, v1.32.0):** Zwei Fallen, beide
    kosten sonst einen halben Nachmittag.
    · `resizeMode="repeat"` KACHELT IM WEB NICHT — react-native-web legt genau
      EINE Kachel an, der Rest der Fläche bleibt leer. Am Gerät kachelt es
      korrekt, d. h. die Web-Verifikation zeigt etwas anderes als das iPhone.
      Deshalb bleibt es bei `cover`.
    · Weil `cover` das Blatt auf die Panelgröße skaliert, muss die Textur KLEIN
      (400x300) und die Körnung KRÄFTIG (stddev ≈ 4) angelegt sein. Die erste
      Fassung war 800x600 mit stddev 1,1 — beim Herunterskalieren blieb davon
      nichts als Papierweiß übrig, deshalb wirkten die Tafeln jahrelang wie
      Papier statt wie Stein. Erzeugt wird sie mit PIL (Zahn = Gauß-Rauschen,
      Patina = hochskaliertes Grobraster), rein tonal — Farbrauschen sieht nach
      Digital-Dreck aus, nicht nach Stein.
    · Der Steinton darf NICHT beliebig dunkler werden: der Backdrop-Verlauf hat
      einen hellen Ast (`#F6F3EA`), und eine Tafel unterhalb davon verschwindet
      im Grund. Der Backdrop ist tabu (AGENTS.md), also trägt die Kante die
      Plastizität, nicht der Kontrast.

15. **Was in den Einstellungs-Store wandert, gehört ins Backup — und wird dort
    vergessen.** `dayIntentions` (der Morgensatz des Bogens, v1.29.0) lag vier
    Releases lang außerhalb des Backups, weil `exportToJsonString` und
    `runAutoBackup` die Store-Felder EINZELN entgegennahmen und an vier
    Aufrufstellen hätten nachgezogen werden müssen. Seit v1.33.0 gibt es
    `BackupStoreSlice` (data/backup.ts) und `backupSlice()` (settings.store.ts):
    Ein neues Feld dort eintragen genügt, alle Aufrufer nehmen es automatisch
    mit, und tsc meldet jede Stelle, die noch fehlt. Beim nächsten persistierten
    Store-Feld also: erst `BackupStoreSlice` erweitern, dann alles andere.

16. **Aktions-Aufgaben können „schritte" tragen** (v1.34.0) — eine eingefügte
    Einkaufs-/Packliste wird EINE Aufgabe mit Checkliste, nicht N Aufgaben.
    Der eigentliche Fix ist die BÜNDELN-Regel in `SYSTEM_PROMPT` und
    `buildBraindumpContext`; ohne sie zerlegt das Modell die Liste wieder in
    Einzelaufgaben. Wer diese Prompts umschreibt, muss die Regel mitnehmen —
    der Test „Prompt und Braindump-Kontext verlangen das Bündeln" hält das fest.
    `subtasksFromSchritte`/`describeSchritte` (assistant.ts) werden von Chat,
    Braindump und Sprach-Sheet gemeinsam benutzt; `parseSchritte` nimmt auch
    einen einzelnen String mit Zeilenumbrüchen, weil Modelle das liefern.

17. **Aktions-Sprache = Werkzeugkasten des Assistenten** (v1.35.0). Sie war
    lange schmaler als das Datenmodell, in das sie schreibt — daher Fehler wie
    „Einkaufsliste → sechs Aufgaben". Eine Aktions-Aufgabe kann jetzt
    `schritte`, `wiederholung` (Rrule), `tags`, `notiz` und über `listen` sogar
    ein Projekt anlegen (Projekte werden VOR den Aufgaben erzeugt, damit `liste`
    darauf zeigen kann). **Regel für die Zukunft: Wenn Task/List ein Feld
    bekommt, gehört es hier mit hinein** — sonst drückt das Modell es falsch aus.
    Ungültige Wiederholungen werden verworfen (lieber einmalig als kaputt).
18. **Merkzettel** (`assistantMemory`, v1.35.0) — vom NUTZER geschriebene
    Vorgaben, die in jede System-Instruction wandern (vor dem Datenkontext,
    gedeckelt auf `MEMORY_LIMIT`). Bewusst KEIN Lernen der App über den Nutzer;
    das war die verworfene „Spiegel"-Idee. `askAssistant` nimmt den Merkzettel
    als PFLICHT-Parameter — so kann ihn keine Aufrufstelle stillschweigend
    vergessen, tsc meldet es.

19. **Der Assistent darf ÄNDERN** (`aenderungen`, v1.36.0) — verschieben,
    abhaken, umbenennen, Liste wechseln, in den Papierkorb. Vier Leitplanken,
    alle bewusst:
    · **Kein endgültiges Löschen**, auch nicht auf Bitte — nur der (wiederher-
      stellbare) Papierkorb. Steht so im SYSTEM_PROMPT und ist getestet.
    · Adressiert über `taskHandle` = die LETZTEN 6 Zeichen der ID. Der Anfang
      von `newId()` ist ein Zeitstempel und bei am selben Tag angelegten
      Aufgaben nahezu gleich — vorne abschneiden hätte Kollisionen erzeugt.
      `resolveTaskHandle` liefert bei unbekannt ODER mehrdeutig `null`; die
      Änderung fällt dann weg, statt die falsche Aufgabe anzufassen.
    · Ausgeführt über DIESELBEN Mutationen wie die Handbedienung
      (`useCompleteTask`/`useUpdateTask`/`useDeleteTask`) — sonst umgeht der
      Assistent die Wiederholungs-Logik und die Notification-Neuplanung.
    · Nur im CHAT, nicht im Braindump/Sprach-Sheet: dort gibt es keinen
      App-Überblick, also keine Handles.
    Die Aktionskarte zeigt jede Änderung im Klartext („umbenennen in … · auf
    Mo 3.8.") und ein unbekanntes Handle als „Nicht mehr gefunden".

20. **Werkzeuge / Function Calling** (v1.37.0) — der Assistent kann NACHSEHEN
    statt nur einen Datenabzug zu bekommen: `aufgaben_suchen` (auch Erledigtes,
    auch außerhalb der 40er-Kappung), `liste_inhalt`, `notiz_lesen` (der
    Überblick zeigt nur Notiz-TITEL). Regeln:
    · **Streng lesend.** Alles Schreibende bleibt im Aktions-Block mit
      Bestätigungskarte. Ein Werkzeug, das still etwas verändert, gibt es nicht
      und soll es nicht geben — ein Test hält die Werkzeugliste fest.
    · **Die Abendbetrachtung ist strukturell unerreichbar**: kein Werkzeug dafür
      und kein Journal-Feld in `ToolData`. Auch das ist getestet.
    · **Am selben Schalter wie der Überblick**: `assistantContextEnabled` aus →
      `toolData` null → gar keine Werkzeug-Deklaration. Sonst wäre die
      Einstellung eine Lüge.
    · Höchstens `MAX_TOOL_ROUNDS` (3) Runden, dann MUSS eine Antwort kommen —
      deckelt Kosten, Wartezeit und Endlosschleifen.
    · Nur der Chat übergibt `toolData`; Braindump/Sprach-Sheet bleiben ohne
      (`toolData` weglassen = exakt das Verhalten vor v1.37.0).
    · `requestWithFallbacks` ist aus `askAssistant` herausgelöst — die
      Werkzeug-Schleife bekommt so pro Runde dieselben Netze (Modell-Kette,
      Discovery, Lite-Kette, Überlast-Wiederholung).
    · Im Stream stecken functionCall-Teile neben dem Text: `createSseParser`
      reicht deshalb optional die ROHEN Ereignisse durch (`onEvent`).

21. **Stille Lücken der Aktions-Sprache** (Fehlersuche v1.38.0) — vier Fälle,
    die alle NICHT abgestürzt sind, sondern leise das Falsche getan hätten:
    · **Wiederholung ohne Datum lief nie an.** `resolveCompletion` verlangt
      rrule UND dueDate; sonst wird die Aufgabe einmalig abgehakt, obwohl sie
      sichtbar „Wöchentlich" trägt. Der Editor verankert deshalb längst auf
      heute — `actionDueDate` tut jetzt dasselbe für den Assistenten.
    · **Doppelte Projekte.** `listen` legte auch dann an, wenn es die Liste
      schon gab. Jetzt wird eine vorhandene wiederverwendet.
    · **Toter Vorschlag im Braindump.** Ein Block aus NUR `aenderungen` ist
      dort nicht anwendbar (kein Überblick → keine Handles) und ergab eine
      Karte ohne Zeilen mit deaktiviertem Knopf. `hasCapturableActions` wertet
      ihn als leer.
    · **Ungedeckelte Checkliste** — `SCHRITTE_LIMIT` (50).

22. **Bildkanal** (`assistantImage.ts`, v1.39.0) — ein Foto (Zettel, Aushang,
    Brief, Whiteboard) wird im Braindump zu Aufgaben/Terminen. Punkte, die man
    nicht wieder auflösen sollte:
    · **Das Bild wird NICHT gespeichert.** Der Picker liefert die Base64-Daten
      direkt (`base64: true`), sie leben genau eine Anfrage lang. Kein
      Dateisystem, kein Backup, keine Spur zum Aufräumen. Termin-Fotos
      (`PhotoRepository`) sind etwas ANDERES und bleiben davon unberührt.
    · `IMAGE_LIMIT` (3) und `quality: 0.5` — Bilder kosten auf dem eigenen
      Schlüssel ein Vielfaches von Text.
    · Bilder hängen an der LETZTEN Nutzer-Nachricht, nicht am ganzen Verlauf.
    · `assistantImagesAvailable` ist bewusst AUCH im Web true (Datei-Dialog):
      nur so ist der Bildweg überhaupt per Playwright prüfbar. Die Kamera
      (`assistantCameraAvailable`) bleibt nativ.
    · Nur im Braindump. Der Chat müsste Bilder am Nachrichtenverlauf
      speichern — das ist ein eigener Schritt, kein Nebenbei.

23. **Der Verwalter** (`app/verwalter.tsx` + `lib/verwalter.ts`, v1.40.0) — die
    erste Funktion, bei der die App VORARBEITET statt Eingaben entgegenzunehmen:
    ein Tipp, und der Assistent legt einen Entwurf für die kommende Woche vor.
    · **Die Leitplanke steckt im Prompt**, nicht in der UI: „Zähle nichts aus
      und bewerte nicht", keine Prozente, kein Lob/Tadel, höchstens fünf Zeilen,
      und jede vorgeschlagene Änderung muss zu einer Zeile gehören. Ein
      Wochenrückblick kippt sonst in Bewertung, und „kein Druck" ist hin. Tests
      halten diese Sätze fest — wer den Prompt umschreibt, muss sie mitnehmen.
    · `weekReviewDue` zeigt den Einstieg auf „Heute" NUR sonntags (und montags
      früh). Täglich sichtbar wäre er eine Mahnung statt eines Angebots.
      Dauerhaft erreichbar bleibt er über den Assistenten-Bildschirm.
    · Er schlägt **kein „erledigt"** vor — Abhaken ist Sache des Nutzers.
24. **`lib/applyActions.ts` — EINE Stelle fürs Anwenden.** Vorher lag dieselbe
    Schleife dreimal, und ALLE drei Fehler der Fehlersuche (doppelte Liste, nie
    anlaufende Wiederholung, nicht verankerte Fälligkeit) steckten genau in
    dieser Verdreifachung. Die Mutationen werden hereingereicht → rein und
    testbar; die Reihenfolge (Projekte → Änderungen → Neues) ist durch Tests
    festgenagelt. **Neue Bildschirme mit Aktions-Karte benutzen das hier.**
    Seit v1.49.0 sind ALLE vier migriert (Verwalter, Braindump, Sprach-Sheet,
    Chat). Im Chat blieb nur die `checkliste` außerhalb: sie braucht die
    verknüpfte Notiz und existiert nirgends sonst — der `'erfassen'`-Prompt
    kennt sie gar nicht. Der Chat ist auch der EINZIGE, der `tasks` hereinreicht:
    nur dort gibt es den App-Überblick und damit Handles.

25. **Projekte lassen sich ABSCHLIESSEN** (`List.completedAt`, v1.41.0) — und
    damit ist der gemeldete Fehler weg: Im Kalender stand „x Tage überfällig"
    unter einem Projekt, in dem längst alles erledigt war. Ursache war, dass der
    Zustand an drei Stellen unterschiedlich entschieden wurde — Listen-Übersicht
    und Projekt-Seite prüften den Fortschritt, der Kalender GAR NICHT.
    Jetzt zentral in `taskLogic`: `projectState` (abgeschlossen › alles-erledigt
    › läuft), `projectDeadlineLabel`, `projectShowsDeadline`. **Wer eine neue
    Ansicht mit Projekt-Deadlines baut, benutzt diese drei** — sonst driftet es
    wieder auseinander.
    Abschließen ist bewusst eine HANDLUNG des Nutzers, nicht automatisch bei
    100 %: man fügt oft noch etwas hinzu. Ein abgeschlossenes Projekt taucht auch
    im Assistenten-Überblick nicht mehr auf, sonst schlüge der Verwalter
    Verschiebungen für etwas Beendetes vor.

26. **Lebensspanne einer Aufgabe** (`startDate`/`expiresOn`, v1.42.0) — eine
    Aufgabe kannte bis dahin genau EINEN Zeitpunkt: fällig. Daraus entstanden
    zwei Sorten Rauschen, beide jetzt behoben:
    · **Startdatum** — was noch nicht dran ist, liegt nicht im Weg. Es ist nicht
      gelöscht, sondern schlummert (`isDormant`).
    · **Verfallsdatum** — was seinen Anlass verloren hat, ist NICHT überfällig,
      sondern gegenstandslos (`isExpired`). Auch die Notification unterbleibt.
    `isCurrent` ist die ZUSÄTZLICHE Bedingung neben `isOpen` — nicht deren
    Ersatz. Verwendet in: Zählungen der Listen-Übersicht, Smart-Filtern und der
    offenen Liste. **Bewusst NICHT in der Suche**: wer sucht, will alles finden.
    Auf der Projektseite bekommen beide eine eigene, eingeklappte Gruppe
    („Später", „Anlass vorbei") — verschwinden heißt hier nie verlieren.

27. **Der Abend ist die zweite Hälfte des Tages** (`Task.evening`, v1.43.0) —
    „Heute" trennt jetzt „Tagsüber" und „Abends". Zwei Feinheiten:
    · Die Markierung wirkt NUR bei Aufgaben ohne Uhrzeit. Mit Uhrzeit hat eine
      Aufgabe ihren Platz auf der Zeitachse; sie dort herauszunehmen wäre falsch.
    · Die Überschrift heißt nur dann „Tagsüber", wenn es auch einen Abend gibt —
      sonst „Ohne Uhrzeit". Eine Unterscheidung ohne Gegenstück ist eine
      Behauptung.

28. **Läufe überleben den Bildschirm** (`lib/assistantRun.ts`, v1.44.0) —
    Braindump, Verwalter und Chat brechen nicht mehr ab, wenn man während der
    Wartezeit woanders hingeht. Punkte, die nicht aufweichen dürfen:
    · Die laufende Funktion schreibt NUR in den Store (siehe auch §8.10).
    · Bewusst NICHT persistiert — ein Lauf überlebt keinen App-Neustart. Eine
      halb fertige Anfrage nach einem Kaltstart fortzusetzen wäre eine Lüge.
    · Späte Deltas nach `clear()` beleben keinen Geister-Lauf wieder.
    · Auf „Heute" zeigt ein PulseDot am Assistenten-Symbol, dass noch etwas
      läuft — sonst weiß man nicht, dass Zurückkommen sich lohnt.
29. **Vorschläge sind änderbar** (`components/ActionEditSheet.tsx`, v1.44.0) —
    im Braindump wählt das KÄSTCHEN ab, der TEXT öffnet den Editor (Titel,
    Datum, Uhrzeit, Liste). Bewusst kein vollständiger Aufgaben-Editor: Tags,
    Wiederholung und Schritte macht man danach in der echten Aufgabe.
    Der geänderte Block wird über `finishRun` zurückgeschrieben — der Store ist
    die einzige Quelle, auch beim Bearbeiten.

30. **Kopf von „Heute" — drei Ebenen statt einer Reihe** (v1.45.0):
    Zeile 1 = RAHMEN (Datum · Einstellungen), Zeile 2 = HANDLUNGEN des Tages
    (Begrüßung · Mikrofon/Assistent/Plus), Zeile 3 = der BOGEN über die volle
    Breite. Das Zahnrad stand vorher in einer Reihe mit den drei Tagesaktionen
    und las sich wie eine vierte — es gehört aber zur App, nicht zum Tag.
    **Wer hier etwas hinzufügt, muss sich entscheiden, auf welche der drei
    Ebenen es gehört** — sonst wird es wieder eine Reihe aus allem.

31. **Tempo statt Warten** (v1.46.0) — der Assistent kam nicht deshalb spät,
    weil er langsam denkt, sondern weil er an jedem Einstiegspunkt dasselbe
    schwere Gepäck trug. Vier Hebel, alle rein lokal (kein Server, keine Kosten):
    · **Prompt nach Einstiegspunkt** (`systemPrompt(mode)`): `'erfassen'`
      (Braindump, Sprach-Sheet) lässt Reise-Links, Werkzeug- und Änderungs-
      Regeln WEG — dort gibt es weder App-Überblick noch Handles, die Regeln
      wären also nur Ballast, den jede Anfrage mitbezahlt. Auch die JSON-Vorlage
      selbst ist kürzer (`AKTIONEN_JSON_ERFASSEN`, ohne `aenderungen`/
      `checkliste`): ein gezeigtes Feld lädt zum Füllen ein. `SYSTEM_PROMPT`
      bleibt als voller Prompt bestehen, Tests halten beide Fassungen fest.
    · **JSON-Zwang** (`responseMimeType` + `ACTION_SCHEMA`): wo die Antwort
      ohnehin eine Vorschlagskarte ist, kommt der Aktions-Block garantiert —
      der strikte Zweitversuch („du hast den Block vergessen") entfällt damit
      fast immer, und es entstehen weniger Ausgabe-Token. Preis: keine Prosa,
      also kein anzeigbarer Streaming-Text. **Nur dort einschalten, wo niemand
      auf Sätze wartet** — im Chat wäre es falsch.
    · ~~**Kleines Modell zuerst** (`preferLite`)~~ — **in v1.51.1 wieder
      ENTFERNT, samt Verkabelung.** Die Begründung („Sortieren ist keine
      Denkaufgabe") war falsch: Das Bündeln („Milch, Brot, Butter" → EINE
      Aufgabe mit Schritten), deutsche Relativdaten („Donnerstag in zwei
      Wochen") und vor allem das LESEN VON FOTOS sind genau die Stellen, an
      denen die kleine Klasse abrutscht — und der Fotokanal liegt im Braindump.
      Entscheidend ist die Ungleichheit der Fehler: Lite scheitert **still und
      dauerhaft** (die Karte sieht richtig aus, der Termin steht falsch im
      Kalender, man merkt es Wochen später), Flash scheitert **sichtbar und
      selbstheilend** (etwas langsamer; bei erschöpftem Kontingent fällt
      `requestWithFallbacks` bei 429 ohnehin automatisch auf die Lite-Kette
      zurück). Die Lite-Kette bleibt also — aber NUR als Rückfall, nie
      vorgezogen. Wer sie je wieder vorziehen will, braucht dafür ein Argument,
      das diese Ungleichheit aushebelt.
    · **Gemerktes Modell** (`assistantModel`/`assistantLiteModel` im Settings-
      Store, `primeWorkingModel`/`setModelPersister` in `_layout.tsx`): ohne das
      klappert die erste Anfrage nach JEDEM Kaltstart die Kandidatenkette ab,
      und jede tote ID ist eine volle Rundreise. Bewusst NICHT im Backup — das
      ist ein Tempo-Merkzettel des Geräts, kein Inhalt.

32. **Der Sprach-Schnellzugriff kann jetzt dasselbe wie Braindump/Chat**
    (v1.46.0) — Lauf im Store (`RUN_QUICKVOICE`, überlebt das Schließen des
    Sheets), änderbare Vorschläge, Anwenden über `applyAssistantActions`.
    Zwei bewusste Unterschiede und eine Naht:
    · **Keine Bilder.** Man fotografiert nicht, während man spricht.
    · Der Editor öffnet **nicht als zweites Sheet über dem ersten** — das
      Sprach-Sheet tritt zurück (`visible={visible && !edit}`). Zwei
      gleichzeitige RN-Modals sind auf dem Gerät heikel; hier gibt es nichts zu
      gewinnen, was das Risiko wert wäre.
    · **`__stoaDictationDemo`** (dictation.ts): Der Browser kann Apples
      Spracherkennung nicht nachstellen, deshalb endete die Playwright-Tour des
      Sprach-Wegs bisher beim „ich höre zu". Ist die Variable ein Text, liefert
      die WEB-Vorschau ihn als Transkript — damit ist der ganze Weg (sortieren,
      ändern, abwählen, übernehmen) prüfbar statt behauptet. Ohne die Variable
      bleibt die Vorschau exakt wie vorher; nativ hat sie keinerlei Wirkung.

33. **Zwei API-Dialekte in EINEM Anfrage-Körper** (v1.46.1) — ab der
    3.5er-Generation sind `temperature`/`topP`/`topK` abgekündigt; gesteuert wird
    über `thinkingConfig.thinkingLevel`. Beides zusammen zu schicken ist ein
    Formfehler, und ein Formfehler kommt als **HTTP 400** zurück — das gilt in
    `callChain` als SCHLÜSSEL-Fehler und stoppt die Kette sofort. Ein falsch
    geratener Dialekt wäre also kein langsamerer, sondern ein TOTER Assistent.
    Deshalb:
    · Der Körper trägt **beide** Fassungen; erst `callModel()` streicht die
      falsche (`tuneForModel`) — dort steht das Modell fest, beim Bauen nicht.
    · `usesNewConfigDialect()` liest die Version aus der ID (≥ 3.5 = neu).
      Aliasse ohne Version (`gemini-flash-latest`) gelten als neu, weil sie
      nach vorn zeigen.
    · **Netz:** Kommt trotzdem 400, geht EIN nackter Versuch ohne jede
      Feinsteuerung raus; klappt er, bleibt es für den Rest des App-Laufs dabei
      (`konservativeConfig`). Google dreht diese Felder mit jeder Generation —
      die App darf daran nicht sterben. Playwright prüft beide Fälle.
    · `thinkingLevel: 'minimal'` nur im `'erfassen'`-Modus. Sortieren ist kein
      Nachdenken; Chat und Verwalter behalten die volle Denkzeit.
    **Wenn der Assistent nach einem Google-Update spürbar langsamer wird**, ist
    die erste Frage, ob das Netz gegriffen hat — die Feinsteuerung fällt dann
    still weg. Die Modell-Zeile in den Einstellungen ist der schnellste Blick.

34. **Die Modell-Zeile in den Einstellungen** (v1.46.1) — „Antworten über …
    · Sortieren über …". Klingt nach Kosmetik, hat aber beim ersten Anschalten
    sofort eine Lücke gezeigt: `assistantModel` blieb leer, weil `preferLite`
    die Hauptkette gar nicht anfasst. Beide IDs werden deshalb GETRENNT gemerkt
    und getrennt angezeigt; dass zuerst nur eine dasteht, ist normal.
    Bewusst nur Anzeige, keine Auswahl: eine Modell-Wahl wäre eine Einstellung,
    die man pflegen muss, und die Kette macht es ohnehin besser.

35. **Eingabefelder liegen IN der Platte, nicht darauf**
    (`components/InsetField.tsx`, v1.47.0) — gemeldet an der Abendbetrachtung
    („wirkt draufgeklebt"), und der Befund stimmte: Das Feld war ein gefülltes
    Rechteck mit Radius, das mit Luft an allen vier Seiten mittig auf der
    behauenen Steinplatte schwebte. Auf einer Platte, die Grate und Fasen trägt,
    liest sich so etwas zwangsläufig als aufgelegtes Plättchen.
    · Die Lösung ist die Meißel-Physik von `Glass.tsx`/`Type.tsx`, **umgekehrt**:
      Die PLATTE hat den Lichtgrat oben und den Schattengrat unten (sie steht
      hervor). Eine MULDE spiegelt das — Schattengrat OBEN (die Kante wirft
      hinein), Lichtgrat UNTEN (die innere Wand fängt das Licht). Wer die beiden
      vertauscht, macht daraus wieder ein Plättchen. Und wie die Platte trägt
      die Mulde KEINE Umrandung.
    · Neuer Token `sunk` — im Hellen eine Spur tiefer als `chip`, im Dunkeln
      DUNKLER als die Platte (`chip` ist dort Alpha-Weiß und läge wieder oben
      drauf).
    · **Die Mulde fluchtet mit dem Text, sie läuft NICHT bis an die Kante**
      (v1.49.0). Bündig war der erste Versuch und sah falsch aus — der Inhalt
      wird über den seitlichen Fasen gezeichnet (`Glass.tsx`, children stehen
      NACH den Fasen), die Platte verliert dort also sichtbar ihre Dicke. Der
      Fehler war nie die Breite, sondern dass das Feld oben AUF lag.
    · Zeilenhöhe 26 statt 22: hier entsteht eine Seite, kein Formularfeld.
    Seit v1.49.0 benutzen es AUCH Braindump, Merkzettel und das Schlüsselfeld —
    vorher stand dasselbe Feld dort in drei Fassungen (mal `chip`+`chipBorder`,
    mal `bg2`+`border`, mal ganz ohne). **Neue Eingabefelder nehmen `InsetField`.**

36. **Fehlersuche v1.48.0 — was die letzten drei Releases still hinterlassen
    haben.** Gezielt an den neu gebauten Stellen gesucht; drei echte Funde, alle
    ohne Absturz, alle mit Test belegt, bevor etwas geändert wurde:
    · **Die Lebensspanne galt ausgerechnet auf „Heute" nicht.** `isCurrent`
      steckte in den Listen-Zählungen und den Smart-Filtern, aber `groupToday`
      benutzte nur `isOverdue`/`isDueToday`. Eine verfallene Aufgabe stand also
      weiter unter ÜBERFÄLLIG — auf dem Bildschirm, wo das Wort am lautesten
      ist —, sie zählte in `open` mit (also wurde „alles erledigt" nie erreicht),
      und **„Überfällige auf heute holen" hat sie mit EINEM Tipp reihenweise
      wiederbelebt**. Die Bedingung sitzt jetzt IN `isOverdue`/`isDueToday`,
      nicht bei den Aufrufern: „verfallen ist nicht überfällig" ist eine
      Eigenschaft der Aufgabe, keine Meinung des Bildschirms.
    · **Der Lauf überlebte das Verlassen, die EINGABE nicht.** Genau der Fall,
      für den v1.44 geworben hat: Braindump abtippen, weggehen, wiederkommen —
      der Lauf lief weiter, aber `text` lag im Bildschirm-State, und der wird
      beim Zurückgehen abgebaut. Scheiterte der Lauf, stand man vor einem leeren
      Feld und der ganze Wurf war weg. Die Eingabe liegt jetzt IM Lauf
      (`AssistantRun.input`) und wird beim Betreten zurückgeholt — einmalig,
      damit sie niemandem ins Tippen fährt.
    · **Eine stumme Sackgasse im JSON-Modus.** Ließ sich die rohe Antwort nicht
      lesen, gab `extractActions` `clean: ''` zurück; der Braindump kündigte
      „Seine Antwort:" an und schwieg dann. Unlesbares JSON ist kein
      Aktions-Block, sondern eben Text — es bleibt jetzt erhalten.
    Dazu eine **Härtung ohne bekannten Auslöser**: `readJson()` statt
    `res.json()`. Ein HTTP 200 mit einer HTML-Anmeldeseite (Hotel-WLAN) hätte
    eine rohe englische Parser-Ausnahme auf den Bildschirm gebracht. Erreichbar
    ist das nur über den strikten ZWEITversuch (die Erstanfragen streamen alle,
    und `readSse` schluckt kaputte Zeilen bereits) — also eng, aber eine
    englische `SyntaxError`-Meldung hat in dieser App nichts verloren.
    **Geprüft und NICHT verändert:** Handles greifen nie in den Papierkorb
    (`useTasks` filtert `deletedAt`), und der Überblick zeigt nur offene
    Aufgaben — ein Handle auf etwas Erledigtes bräuchte eine 6-Zeichen-
    Halluzinations-Kollision.

37. **Ein Schritt zurück** (`lib/undo.ts` + `components/UndoBar.tsx`, v1.50.0) —
    Abhaken, Papierkorb und „Überfällige auf heute holen" passieren mit EINEM
    Tipp, und zwei davon fassen mehrere Aufgaben gleichzeitig an. Vier bewusste
    Festlegungen:
    · **Nur EIN Schritt, kein Stapel.** Ein Verlauf lädt zum Herumprobieren
      ein; das hier ist ein Netz für den Fehlgriff, keine Zeitmaschine.
    · **Abhaken stellt `completedAt` UND `dueDate` wieder her.** Bei einer
      Wiederholung ist das Abhaken ein Datums-Sprung — nur `completedAt`
      zurückzusetzen ließe die Aufgabe an einem falschen Tag stehen.
    · **Die Rücknahme MUSS `invalidate()` rufen.** Beim ersten Anlauf tat sie
      das nicht: der Bestand änderte sich, die Oberfläche zeigte weiter den
      alten Stand. Die Playwright-Tour hat es gefangen — wer hier eine weitere
      Rücknahme einbaut, muss invalidieren (das stößt auch die Neuplanung der
      Erinnerungen an).
    · **Das Übernehmen von Assistenten-Vorschlägen ist NICHT rückgängig zu
      machen** — es ist keine Rutschhand, sondern eine bestätigte Handlung mit
      eigener Bremse in der Vorschlagskarte.
    Die Leiste sitzt ÜBER der Eingabezeile von „Heute", nicht darüber — eine
    Meldung, die das Feld verdeckt, während man tippt, wäre schlimmer als
    keine. Der Abstand (`BOTTOM_CLEARANCE`) ist eine Annahme über die Höhe von
    Tab-Leiste und Eingabezeile; wer an einer der beiden schraubt, sieht hier
    nach.

38. **Wiederholungen an festen Wochentagen** (`wd:1,4`, v1.50.0) — „jeden
    Montag und Donnerstag" ließ sich als „alle n Wochen" nicht ausdrücken, und
    das war die letzte echte Lücke gegenüber den bekannten Aufgaben-Apps.
    · Format: JS-Nummern (0=So … 6=Sa), aufsteigend, kommagetrennt.
      `parseWeekdays` gibt bei Unbrauchbarem `null` — eine kaputte Regel wirkt
      damit wie „keine", nicht wie eine, die nie wieder fällig wird.
    · **Mo–Fr ergibt das bestehende Preset `'weekdays'`** (`buildWeekdayRrule`),
      genau wie `buildRrule` bei n = 1 die Presets erzeugt: gespeicherte Werte
      bleiben kanonisch, alte Aufgaben unverändert lesbar. Deshalb brauchte der
      Editor auch keinen eigenen „Werktags"-Knopf mehr.
    · Beschriftet wird in der Reihenfolge der WOCHE (Mo zuerst), nicht in der
      von JS — sonst stünde der Sonntag vorn.
    · Der Assistent kennt die Form (`wd:1,4` steht im Prompt) und `isRrule`
      wirft Unsinn weg wie bisher.
    · Erinnerungen brauchten keine Änderung: geplant wird immer nur die
      AKTUELLE Fälligkeit, die nächste entsteht beim Abhaken.
    · **`anchorWeekdayRrule`** (v1.50.1, direkt nachgereicht): Eine
      Wiederholung ohne Datum wird auf „heute" verankert, sonst liefe sie nie
      an — bei festen Wochentagen ist „heute" aber oft ein Tag, den man gerade
      NICHT gewählt hat („jeden Mo und Do", am Dienstag angelegt, wäre sofort
      heute fällig). Betraf auch das ältere `'weekdays'` (samstags angelegt).
      Verankert wird NUR ein abgeleitetes Datum; ein selbst ausgesuchtes ist
      eine Entscheidung und wird nicht stillschweigend verschoben. Gilt im
      Editor UND im Aktions-Block (`actionDueDate`).

39. **Das schwerste Versäumnis dieser Sessions: SQLite wird NIE ausgeführt**
    (gefunden v1.51.0, kaputt seit v1.42.0). Im `INSERT` der Aufgaben stand ab
    v1.42.0 EIN Fragezeichen zu viel — 20 Spalten, 21 Platzhalter. Auf dem
    Gerät hat SQLite damit **jedes Anlegen einer Aufgabe abgelehnt**, acht
    Releases lang. tsc: grün. 300 Tests: grün. Playwright: grün. Denn:
    · **Die gesamte Verifikations-Pipeline läuft im Web, und dort sind alle
      Repositories InMemory.** Kein einziger SQL-String wird je ausgeführt.
      Das ist die größte blinde Stelle des Projekts — größer als „nativ ist im
      Web nicht prüfbar" (§8.5), weil es sich wie geprüfter Code ANFÜHLT.
    · Gegenmittel: `data/sqliteSchema.test.ts` liest alle `Sqlite*.ts` als TEXT
      und vergleicht Spalten mit Platzhaltern; außerdem, dass jede beschriebene
      Tabelle im Schema steht. Grob, aber es fängt genau diese Klasse. Der Test
      wurde gegengeprüft: Fehler wieder einbauen → rot.
    · **Wer eine SQL-Zeichenkette anfasst, verlässt sich auf nichts anderes.**
    · Zweiter Teil des Befunds: Das Scheitern war **stumm**. `apply()` hatte
      kein try/catch, die abgewiesene Zusage lief ins Leere — der Knopf tat
      scheinbar nichts, die Vorschlagskarte blieb stehen, keine Meldung. Alle
      vier Anwenden-Stellen (Braindump, Sprach-Sheet, Chat, Verwalter) zeigen
      den Fehler jetzt an; ein Test hält fest, dass `applyAssistantActions`
      Fehler NICHT verschluckt. Ohne diesen zweiten Teil hätte der erste noch
      länger überlebt.

40. **Der Fortschrittsbalken war der lauteste Fleck der App** (v1.51.0, vom
    Nutzer gemeldet). Bei 100 % ein satter Farbblock über die volle Kartenbreite,
    bei 0 % eine leere graue Rinne — beides auf einer Marmortafel Fremdkörper.
    · Die Rinne ist jetzt eine Kerbe im Stein (`colors.sunk`, derselbe Token wie
      `InsetField`), die Füllung liegt darin und ist tonal (Farbe bei 70 %).
    · Auf der Listen-Übersicht wird sie NUR bei 0 < Fortschritt < 1 gezeigt:
      bei 0 ist nichts geschehen, bei 100 % steht „Alles erledigt" ohnehin
      darunter. Ein Balken, der nichts sagt, ist nur Farbe.

41. **Neues App-Icon: Σ als Inschrift** (v1.51.0). Das alte war ein Häkchen im
    Mäander-Ring — bei 40 px (der Größe, in der man es täglich sieht) blieb davon
    ein unscharfer blauer Ring, und ein Häkchen sagt „Aufgaben-App", nicht
    „Stoa". Zudem widersprach der geschlossene Mäander-Ring der eigenen
    Leitplanke („Schmuck, kein Raster", AGENTS.md).
    · **Cormorant Garamond enthält KEIN Griechisch** — ein Σ käme dort als
      leerer Kasten. Das Icon nutzt deshalb FreeSerif (gleiche Haltung: hoher
      Strichkontrast, echte Serifen). Wer das je ändert: erst prüfen, ob die
      Schrift das Zeichen hat, sonst rendert PIL still „NO GLYPH".
    · Untergrund ist die ECHTE Marmor-Kachel der App; das Relief kippt zwischen
      den Fassungen wie in `Type.tsx` (hell = eingeschnitten, dunkel = erhaben).
    · Der Android-Vordergrund trägt eine HELLE Letter — er liegt auf `#1F4467`.
    · Erzeugt von `scratchpad/sigma.py`; bei einer Überarbeitung dort ansetzen.

42. **Eine Zeile für alles — Stufe 1** (`lib/inputRoute.ts` + `QuickAdd.tsx` +
    `components/OmniResult.tsx`, v1.52.0). Stoa hatte VIER Türen für Text, und
    man musste sich VOR dem Tippen für eine entscheiden — diese Entscheidung
    kam vor dem Denken und war die eigentliche Reibung. Jetzt tippt man in die
    Zeile, und `routeInput` entscheidet.
    · **Die Eskalationsleiter ist die Kernregel und darf nicht verdreht
      werden:** Der lokale Parser sieht ZUERST hin. Saubere Aufgabe → anlegen,
      ohne Netz, ohne Schlüssel, ohne Wartezeit. Ist `assistentVerfuegbar`
      false, bleibt ALLES lokal — eine Zeile, die ohne Netz nichts mehr täte,
      wäre ein Rückschritt gegenüber dem Zustand davor. Ein Test hält das fest.
    · **Fragewörter und Befehle zählen NUR am Satzanfang.** Der deutsche
      Imperativ steht vorn: „Verschieb den Zahnarzt" ist ein Auftrag,
      „Zahnarzt verschieben" eine Aufgabe, die man sich notiert. An dieser
      einen Unterscheidung hängt die ganze Weiche — wer die Regexe anfasst,
      muss sie mitnehmen (Tests dazu sind da).
    · Der teuerste Fehler wäre NICHT, eine Frage für eine Aufgabe zu halten
      (eine seltsame Aufgabe, ein Tipp auf Rückgängig), sondern jede harmlose
      Notiz an den Assistenten zu schicken — das kostet Wartezeit und
      Kontingent für etwas, das der Parser in Mikrosekunden kann. Deshalb prüft
      die Mehrzahl der Tests, dass etwas LOKAL bleibt.
    · Der Knopf verrät die Entscheidung VOR dem Tippen: Plus = wird angelegt,
      Funke = geht an den Assistenten.
    · Der Lauf liegt im Store (`RUN_ZEILE`), überlebt also Bildschirmwechsel.
      Angewendet wird über `applyAssistantActions` — nichts wird ohne Tipp
      geschrieben, auch hier nicht.
    · `QuickAdd` bekommt die Termine von „Heute" HEREINGEREICHT statt sie neu
      zu holen (der Bildschirm hat sie ohnehin). Wird die Zeile je auf einem
      zweiten Bildschirm gezeigt, muss der das auch tun — sonst beantwortet sie
      dort Kalenderfragen schlechter.
    **Stufe 2 (v1.53.0)** macht die Zeile vollständig:
    · **Sprechen.** Bei leerem Feld steht ein Mikrofon in der Zeile. Das Diktat
      FÜLLT das Feld, statt sofort loszuschicken — man sieht das Gesagte, kann
      es korrigieren, und der Knopf verrät weiterhin, wohin es geht. Damit ist
      der Sprach-Schnellzugriff als eigener Bildschirm im Grunde überflüssig;
      er bleibt vorerst bestehen, könnte aber der nächste Rückbau sein.
    · **Abwählen und zurechtrücken.** Kästchen wählt ab, Text öffnet denselben
      `ActionEditSheet` wie im Braindump. Vorher musste man alles verwerfen und
      neu tippen, wenn einer von drei Vorschlägen nicht stimmte.
    · **Die Weiche überstimmen.** Langer Druck auf den Knopf schickt die
      Eingabe den ANDEREN Weg — für genau diese eine Eingabe, und beim nächsten
      Tastendruck ist es wieder gelöst. **Bewusst kein dauerhafter Schalter:**
      das wäre ein versteckter Modus, und Modi loszuwerden war der ganze Punkt.
      Ohne Schlüssel greift das Überstimmen nicht (es gäbe kein Ziel).
    Weiterhin OHNE: Bilder und eine Rückfrage-Runde (jede Anfrage ist ein
    Einzelschuss ohne Gedächtnis). Braindump, Chat und Sprach-Sheet bestehen
    unverändert weiter — sie sind optional statt notwendig, und das war das Ziel.

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
