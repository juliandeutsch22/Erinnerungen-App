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
