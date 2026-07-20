# Stoa — offene Punkte & Ideen-Backlog

Stand: Juli 2026. Erledigtes steht nicht mehr hier — das ist die Merkliste
für alles, was besprochen, aber noch nicht gebaut ist.

## Assistent

- **Prompt-Chips im leeren Chat** — kontextabhängige Ein-Tipp-Vorschläge
  („Packliste erstellen", „Zusammenfassen", „Nächste Schritte", „Zerlege in
  Teilschritte") statt Tippen.
- **Streaming-Antworten** — Text erscheint Wort für Wort (SSE), fühlt sich
  deutlich schneller an.
- **Auto-Titel durch das Modell** — kurzer generierter Chat-Titel statt der
  ersten Nutzer-Nachricht.
- **On-Device-Stufe** — Apple Foundation Models (iOS 26) für einfache
  Aufgaben komplett offline; braucht das native Kapitel.

## Natives Kapitel (geparkt, eigenes Projekt)

Braucht `expo prebuild` + native Targets in der IPA-GitHub-Action:

- **Home-Screen-Widget** (heutige Aufgaben + nächster Termin) — größter
  Alltagsgewinn.
- **Share-Extension** — Text/Links aus anderen Apps → Notiz/Aufgabe;
  löst nebenbei den bequemen Apple-Notes-Import.
- **Siri / App Intents** — „Erinnere mich an …".
- **Live Activity / Dynamic Island** — nächster Termin mit Countdown.

## Erlebnis-Features (Ideen-Backlog)

- **„An diesem Tag" — die stille Chronik** — Tagesseite aus Erledigtem,
  Terminen, Fotos und Notizen + „Vor einem Jahr"-Moment im Rückblick.
- **Countdown-Momente** — große Ereignisse als ruhige Kachel auf Heute,
  optional mit Termin-Foto als Hintergrund.
- **Tagesmaxime** — kuratierte stoische Zitate (offline) morgens auf Heute.
- **KI-Wochenreflexion** — sonntags fasst der Assistent die Woche zusammen
  (als Notiz „Woche N" gespeichert).
- **Lebendiger Tempel** — Backdrop-Licht wandert mit Tages-/Jahreszeit.
- **Antike Listen-Ikonografie** — eigene Icon-Familie (Amphore, Lyra, …).
- **Wochentafel-Export** — die Woche als gesetztes Bild/PDF (Antiqua, Mäander).
- **Erledigt-Moment** — Lorbeer-Glanz beim Abhaken der letzten Tagesaufgabe.
- ~~**Dokumente an Terminen**~~ — umgesetzt in v1.14.0 (Anheften, QuickLook, Backup).
- ~~**Journaling / Abendbetrachtung**~~ — umgesetzt in v1.14.0 (Heute-Karte ab
  18 Uhr, Verlauf, stille Kette, optionale Erinnerung, Suche, Backup).

- **Routinen/Gewohnheiten mit Säulen-Streaks** — tägliche Gewohnheiten ohne
  Überfällig-Druck; jede volle Woche baut eine Säule (Trommel für Trommel,
  Kapitell bei 7/7). Kandidat fürs nächste große Feature.
- **Tages-Highlight** — morgens EIN wichtiges Ding wählen, prominent auf Heute.
- **Abend-Abschluss & Wochenrückblick** — abends Reste aufräumen
  (morgen/Wochenende/loslassen), sonntags Wochenbilanz mit Foto-Momenten.
- **Fokus-Timer** — ruhiger Vollbild-Timer aus einer Aufgabe heraus,
  Zeit wird an der Aufgabe vermerkt.
- **Fotos in Notizen** — Foto-Infrastruktur der Termine wiederverwenden.
- **Projekt-Archiv** — abgeschlossene Projektlisten archivieren statt löschen.
- **Terrakotta-Thema** — die römische Design-Variante als wählbares zweites
  Thema in den Einstellungen.
- **Klang-Feinschliff** — dezenter „Marmor-Klick" beim Abhaken.

## Rahmen-Entscheidungen

- **TestFlight** (99 €/Jahr Developer-Account) — beendet den
  7-Tage-Signatur-Zyklus; danach optional Store-Release als Resonanztest.
- **Face-ID-Sperre** — optional beim Öffnen (expo-local-authentication).
- **Papierkorb-Muster ausweiten** — „Zuletzt gelöscht" auch für Aufgaben
  und Listen (Notizen und Chats haben es bereits).
