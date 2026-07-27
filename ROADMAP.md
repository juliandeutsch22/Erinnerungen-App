# Stoa — Roadmap

Neu aufgesetzt, Juli 2026 (nach v1.27.2). Erledigtes steht hier nicht mehr —
das ist die Merkliste dessen, was noch kommen könnte, geordnet nach Wirkung.

**Ethos-Filter — jede Idee muss alle vier bestehen:** Macht sie die App
*ruhiger* statt lauter? Bleibt alles *lokal*? Entsteht *kein Druck*
(keine Streaks, keine Schuld-Zähler)? Bleibt sie *kostenlos*?

**Tags:** `[JS]` = reine JS-Änderung, im Web verifizierbar · `[NATIV]` = nativer
Eingriff, nur am Gerät prüfbar → eigene Risikoklasse (siehe §6) ·
`klein/mittel/groß` = grober Aufwand · **NEU** = in dieser Session dazugekommen.

---

## 1. Offene Kanten

*(Die beiden hier gelisteten Punkte — wandernde Säule und gefühlte Wartezeit —
sind in v1.28.0 umgesetzt. Die Säule ist am Gerät gegenzuprüfen: Tab-Screens
tragen den vollen Tempel, aufgeschobene Screens nur den Marmor.)*

Aktuell keine bekannten offenen Kanten.

## 2. Flaggschiff: Der Bogen des Tages

Das einzige Feature, das aus der Werkzeug-Sammlung eine **Praxis** macht — und
das niemand kopieren kann, weil es aus dem Namen kommt. Nutzt fast nur
Vorhandenes. **Kein Streak, kein Zähler, keine Schuld.** **NEU**

~~**Ausrichtung am Morgen** + **Betrachtung am Abend**~~ — umgesetzt in v1.29.0,
bewusst in der **schlanken** Fassung: KEINE neuen Flächen. Der Morgen lebt in der
dritten Kopfzeile von „Heute" (vor 11 Uhr die Einladung, sonst die Zusammenfassung),
der Abend in der bestehenden Abendkarte als EINE Zeile („Du wolltest: …"), per Tipp
still quittierbar. Ein erster, größerer Entwurf mit drei eigenen Panels wurde als zu
überladen verworfen — das ist hier die richtige Lehre: der Kern des Bogens ist ein
Satz, keine Oberfläche.

- **Der Wochenbogen** `[JS · mittel]` — derselbe Rhythmus eine Ebene höher:
  ruhiger Rückblick + Ausblick, sonntags. **Bewusst zurückgestellt**, bis sich der
  tägliche Bogen im Alltag bewährt hat — eine dritte Oberfläche wäre sonst genau
  die Überladung, die wir vermieden haben.

## 3. Vernetzungen — das größte ungehobene Potenzial

Die Features sind gut, aber sie wissen zu wenig voneinander. Hier liegt am
meisten Wirkung pro Zeile Code. Alle **NEU**, sofern nicht anders vermerkt.

- **Tags über alles** `[JS · mittel]` — *Tags gibt es nur an Aufgaben.* Auch an
  Notizen (und implizit an Chats/Terminen über Verknüpfungen) → eine
  Kontext-Ansicht: `#umzug` zeigt Aufgaben, Notizen, Termine und Chats an einem
  Ort. Macht aus Tags ein Rückgrat statt einer Aufgaben-Randnotiz.
- **Checklisten-Zeile → Aufgabe** `[JS · klein]` — *Notiz-Checklisten und
  Aufgaben-Unteraufgaben sind zwei getrennte Welten.* Eine Zeile per Wisch zur
  echten Aufgabe befördern (mit Rücklink zur Notiz).
- **Projekt-Deadline im Kalender** `[JS · klein]` — *Listen mit Ziel/Deadline
  sind Projekte, aber der Kalender weiß nichts davon.* Deadline erscheint auf
  Kalender und Zeitachse; auf der Projektseite: was bis dahin offen ist.
- **Aufgabe auf die Zeitachse ziehen** `[JS · mittel]` — *Timeboxing zeigt
  Aufgaben, kann aber keine Zeit vergeben.* Seit v1.26.0 können wir in den
  Kalender schreiben → Aufgabe auf eine Stunde ziehen = echter Zeitblock.
- **QuickAdd + Assistent als Hybrid** `[JS · mittel]` — *lokaler Parser =
  sofort, aber begrenzt; Assistent = klug, aber langsam.* Erst lokal parsen
  (Millisekunden), und nur bei Unklarheit „genauer sortieren" anbieten.
- **Fotos & Dokumente auch an Notizen/Aufgaben** `[JS · mittel]` — *hängen nur
  an Terminen.* Beleg an die Aufgabe, Whiteboard-Foto an die Notiz. Die
  Infrastruktur (Speicher, Viewer, Backup) steht komplett. (War als „Fotos in
  Notizen" schon im alten Backlog.)
- **Erkenntnis aus dem Chat sichern** `[JS · klein]` — *Chats sind flüchtig.*
  Eine gute Antwort mit einem Tipp dauerhaft an Projekt/Notiz heften
  („Als Notiz speichern" gibt es — es fehlt das Ziel *Projekt*).
- **Termin-Vorbereitung** `[JS · mittel]` — *ein Termin ist ein Datum, kein
  Vorhaben.* Bei größeren Terminen ruhig Vorbereitung anbieten (Packliste,
  „zwei Tage vorher erinnern") — aus dem vorhandenen Aktions-Muster.
- **Zeit in der Suche** `[JS · mittel]` — *Suche ist rein textlich.* Zeiträume
  als Filter („letzten Monat") und daraus die Tagesseite: **„An diesem Tag"** —
  Erledigtes, Termine, Fotos, Notizen eines Tages (aus dem alten Backlog).
- **Wiederholungen, die zum Leben passen** `[JS · mittel]` — *nur fünf starre
  Muster.* Intervall („alle 2 Wochen"), Enddatum und vor allem
  „*x* Tage **nach Erledigung**" (Pflanzen gießen) — löst echte Alltagsfälle.
- **Ein Gesundheits-Blick** `[JS · klein]` — *Backup, Papierkorb und
  Speicher sind über die Einstellungen verstreut.* Eine ruhige Übersicht:
  letztes Backup, was im Papierkorb liegt, wie viel Platz Fotos brauchen.

## 4. Neue Funktionen

**Erfassen**
- **Web-Suche im Assistenten (Grounding)** `[JS · mittel]` — Gemini kann live
  suchen (`google_search`-Werkzeug); heute verbietet es unser Prompt bewusst.
  Als **eigener Modus** („Im Web suchen"), nie still im Hintergrund: findet
  echte Veranstaltungen/Fakten → direkt zu Terminen/Aufgaben. Quellen müssen
  angezeigt werden; geerdete Anfragen kosten auf deinem Schlüssel extra, und es
  ist langsamer. **NEU**
- **Teilen an Stoa, Stufe 2** `[NATIV]` — echte Share-Extension statt
  Kurzbefehl (Stufe 1 läuft seit v1.26.1). Siehe §6.

**Rhythmus & Praxis**
- **Routinen / „Säulen"** `[JS · groß]` — sanfte wiederkehrende Praktiken.
  ⚠️ Aus dem alten Backlog übernommen, aber **ohne Streak-Mechanik** — eine
  volle Woche darf eine Säule wachsen lassen, ein Aussetzer darf **nichts**
  einreißen. Sonst verletzt es „kein Druck".
- **Fokus** `[JS · mittel]` — eine Aufgabe, ein ruhiger Vollbild-Timer, die Zeit
  bleibt an der Aufgabe vermerkt.
- **Tagesmaxime** `[JS · klein]` — kuratierte stoische Sentenz, offline, morgens
  auf Heute. Klein, aber maximal markengerecht.

**Verstehen & Rückschau**
- **Countdown-Momente** `[JS · klein]` — große Ereignisse als ruhige Kachel,
  optional mit Termin-Foto.
- **Projekt-Archiv** `[JS · klein]` — abgeschlossene Projekte archivieren statt
  löschen.
- **Wochentafel-Export** `[JS · mittel]` — die Woche als gesetztes Bild/PDF
  (Antiqua, Mäander) zum Teilen oder Drucken.

**Oberfläche & Atmosphäre**
- **Lebendiger Tempel** `[JS · mittel]` — Backdrop-Licht wandert mit Tages- und
  Jahreszeit.
- **Terrakotta-Thema** `[JS · mittel]` — die römische Variante als zweites Thema.
- **Antike Listen-Ikonografie** `[JS · groß]` — eigene Icon-Familie
  (Amphore, Lyra, …).
- **Erledigt-Moment** `[JS · klein]` — Lorbeer-Glanz beim letzten Haken des
  Tages. Selten gesehen → darf auftreten.
- **Klang-Feinschliff** `[JS · klein]` — dezenter „Marmor-Klick", abschaltbar.

## 5. Nativ — eigene Risikoklasse

Braucht `expo prebuild` + native Targets in der IPA-Action. **Lehre aus dieser
Session:** Natives ist im Web **nicht** prüfbar — ein RN-`Easing` in einem
Reanimated-Worklet hat die App am Gerät hart abstürzen lassen, während alle
Web-Tests grün waren (v1.24.0–v1.27.1). Deshalb: **einzeln bauen, einzeln
ausliefern, einzeln am Gerät bestätigen** — nie gebündelt.

- **Home-Screen-Widget** — heutige Aufgaben + nächster Termin. Größter
  Alltagsgewinn der nativen Gruppe.
- **Siri / App Intents** — „Erinnere mich an …", ohne die App zu öffnen.
- **Share-Extension** — Text/Links direkt aus jeder App.
- **Live Activity / Dynamic Island** — nächster Termin mit Countdown.
- **On-Device-Stufe (Apple Foundation Models, iOS 26)** — einfache Sortierung
  komplett offline, ohne API und ohne Wartezeit.

## 6. Rahmen

- **TestFlight** (99 €/Jahr) — beendet den 7-Tage-Signatur-Zyklus.
- **IPA-Build ist manuell** (`workflow_dispatch`) — ein Merge auf `main` baut
  **nicht** automatisch. Nach jedem Release den Build von Hand auslösen, sonst
  liegt der Fix im Repo, aber nicht auf dem Gerät (ist genau einmal passiert).

## 7. Bewusst NICHT

Damit die Linie klar bleibt — diese Dinge wurden erwogen und verworfen:

- **Mail-Integration** (Postfach verbinden) — bräuchte Konto, Server und
  Dauerzugriff aufs Postfach; holt den lautesten Kanal der Welt in eine App,
  deren Zweck Ruhe ist. Der Bedarf dahinter ist über „Teilen an Stoa" gelöst.
- **Cloud-Sync, Konten, Teilen mit anderen** — widerspricht „alles lokal".
- **Streaks, Punkte, Schuld-Zähler, Engagement-Tricks** — widerspricht
  „kein Druck". Auch bei Routinen (§4).
- **Ein drittes Akzent-Hex, Alarm-Rot** — Design-Leitplanke (AGENTS.md).

## 8. Empfohlene Reihenfolge

1. ~~**§1 Offene Kanten**~~ — erledigt in v1.28.0 (Säule + gefühlte Wartezeit).
2. **§2 Der Bogen** — das Flaggschiff, macht die App zu einer Praxis.
   Vorher Mocks zeigen: es ist UX-lastig, da lohnt sich ein Blick vor dem Bau.
3. **§3 Vernetzungen**, in dieser Reihenfolge: Checklisten-Zeile → Aufgabe ·
   Projekt-Deadline im Kalender · Tags über alles.
   (Erst die kleinen mit sofortiger Wirkung, dann das Rückgrat.)
4. **Web-Suche** — erweitert den Assistenten spürbar, sobald der Bogen steht.
5. **Widget** `[NATIV]` — größter Alltagsgewinn, aber erst wenn alles
   JS-seitige rund ist und ein ruhiger Build-Rhythmus da ist.
