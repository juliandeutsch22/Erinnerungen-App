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

~~**Der Wochenbogen**~~ — aufgegangen im **Verwalter** (v1.40.0): „Die Woche
ansehen" liefert Ausblick UND konkrete Vorschläge statt einer weiteren
Betrachtungs-Oberfläche. Damit ist auch „Das Maß des Tages" halb erledigt — die
Tagesfassung des Verwalters wäre der nächste kleine Schritt.

**Aus vergleichbaren Apps übernommen (v1.42/1.43)** — ~~Startdatum + Verfallsdatum~~
(OmniFocus/Things „defer", plus eine eigene Idee: Aufgaben mit Verfall) und
~~„Abends" als zweite Tageshälfte~~ (Things). Offen aus derselben Ecke:
**verknüpfte Notizen** (`[[Notiz]]` + Rückverweise, Bear/Obsidian) — wartet
bewusst auf „Tags über alles", sonst entstehen zwei halbe Netze. Und der
**Tagesplan als echte Zeitblöcke** (Sorted³) — erst, wenn sich der Verwalter
bewährt hat.

## 2b. Eine Zeile für alles `[JS · groß]`

**Stufe 1 (v1.52.0), Stufe 2 (v1.53.0), die Bilder (v1.54.0) und Stufe 3
(v1.55.0) umgesetzt** — siehe UEBERGABE §8.42, §8.46 und §8.47. Die Zeile steht
auf Heute, Kalender, Notizen und Listen; auf „Suche" bewusst nicht.

Seit v1.57.0 zusätzlich: Rückgängig für „Übernehmen", drei lokale Vorschläge
an der leeren Zeile, und die Zeile auf dem Listen-Detail (dort landet die
Aufgabe in DIESER Liste) — siehe UEBERGABE §8.49.

**Die Rückfrage-Runde ist seit v1.59.0 gebaut** (UEBERGABE §8.55) — damit ist
Stufe 3 vollständig und „Eine Zeile für alles" abgeschlossen.

Offen, kleiner, aber lohnend: **Rückgängig auch im Braindump, Chat und Sprach-Sheet**
— `undoAppliedActions` liegt bereit, es fehlt nur die Verdrahtung.
Der **Rückbau** (Sprach-Schnellzugriff und Braindump können beide nichts mehr,
was die Zeile nicht auch kann) bleibt auf Wunsch vorerst liegen.

*Das Problem:* Stoa hat VIER Türen für Text — die Eingabezeile auf „Heute"
(lokaler Parser), den Braindump, den Chat und das Sprach-Sheet. Bevor man ein
Wort geschrieben hat, muss man sich schon entschieden haben, welche Art von
Gedanke das ist. Diese Entscheidung ist die eigentliche Reibung: sie kommt vor
dem Denken, nicht danach.

*Die Idee:* EINE Zeile, unten, immer da. Man tippt oder spricht hinein, was
auch immer — und die App findet heraus, was es war. Kein Modus wird gewählt.

- „Milch kaufen morgen 10 Uhr" → sofort angelegt (lokal, offline, ohne Schlüssel)
- „Was steht morgen an?" → Antwort direkt unter der Zeile, KEIN Chat entsteht
- „Verschieb den Zahnarzt auf Freitag" → Änderungskarte, ein Tipp bestätigt
- „Wo war der Beleg vom Baumarkt?" → findet die Notiz und verlinkt sie
- Drei Absätze durcheinander → wird sortiert wie heute im Braindump

*Die Eskalationsleiter — sie ist der Kern und darf nicht verdreht werden:*
1. Der lokale Parser (`quickAddParser.ts`) sieht ZUERST hin. Saubere Aufgabe →
   anlegen. Null Millisekunden, kein Netz, kein Schlüssel. **Ohne Assistent
   bleibt die App exakt so nutzbar wie heute** — das ist nicht verhandelbar.
2. Erst wenn das nicht aufgeht, geht es an den Assistenten (App-Überblick,
   Werkzeuge, Handles).
3. Alles Schreibende kommt als Karte mit Bestätigung zurück. Nie still.

*Mehrdeutigkeit:* „Zahnarzt Freitag" — anlegen oder verschieben? Regel: klarer
Parser-Treffer gewinnt das Anlegen, alles andere fragt. Ein Fehlgriff kostet
nie Daten, höchstens einen Tipp (und seit v1.50.0 gibt es Rückgängig).

*Warum es zählt:* Es ist die einzige Idee der Sammlung, die die App nicht
VOLLER, sondern EINFACHER macht — vier Türen werden zu einer. Sie braucht kaum
neues Datenmodell und nutzt fast alles aus v1.35–v1.50: Parser, Werkzeuge,
Handles, `applyActions`, Bestätigungskarte, Lauf-Store, `ActionEditSheet`.
Braindump und Chat bleiben bestehen — sie werden optional statt notwendig.

*Neu zu bauen:* der Weichensteller (lokal, billig) und ein Ergebnisbereich
unter der Zeile.

**Ebenfalls angenommen, kleiner:** *Vorbereitung, die von selbst kommt*
`[JS · mittel]` — zwei Tage vor einem größeren Termin („Flug nach Rom",
„Wohnungsübergabe") liegt eine Karte da: Packliste vorbereiten? Vorher
erinnern? Ein Tipp. Man hat nichts eingerichtet und nichts gelernt — die App
hat den Termin gelesen, den sie ohnehin sieht. Bestätigt wird trotzdem immer.

**Zurückgestellt, Substanz aber gut:** *„Ich habe 20 Minuten"* `[JS · groß]` —
ein Knopf, man sagt wie viel Zeit man hat, es kommen drei Dinge, die wirklich
hineinpassen. Braucht eine grobe Dauer an der Aufgabe (kurz/mittel/lang), die
der Assistent beim Erfassen mitschätzt; `findFreeSlots` liefert die Lücke aus
dem Kalender. Speist auch „Das Maß des Tages" (§4).

## 3. Vernetzungen — das größte ungehobene Potenzial

Die Features sind gut, aber sie wissen zu wenig voneinander. Hier liegt am
meisten Wirkung pro Zeile Code. Alle **NEU**, sofern nicht anders vermerkt.

- **Tags über alles** `[JS · mittel]` — *Tags gibt es nur an Aufgaben.* Auch an
  Notizen (und implizit an Chats/Terminen über Verknüpfungen) → eine
  Kontext-Ansicht: `#umzug` zeigt Aufgaben, Notizen, Termine und Chats an einem
  Ort. Macht aus Tags ein Rückgrat statt einer Aufgaben-Randnotiz.
- **Aufgabe auf die Zeitachse ziehen** `[JS · mittel]` — *Timeboxing zeigt
  Aufgaben, kann aber keine Zeit vergeben.* Seit v1.26.0 können wir in den
  Kalender schreiben → Aufgabe auf eine Stunde ziehen = echter Zeitblock.
- **QuickAdd + Assistent als Hybrid** `[JS · mittel]` — *lokaler Parser =
  sofort, aber begrenzt; Assistent = klug, aber langsam.* Erst lokal parsen
  (Millisekunden), und nur bei Unklarheit „genauer sortieren" anbieten.
- ~~**Notizen und Chats gehören zu einem Projekt**~~ — umgesetzt in v1.72.0
  (UEBERGABE §8.72). `Note.listId`/`Chat.listId`, zwei Wege hinein (neu anlegen
  und Vorhandenes anheften), Punkt in der Listenfarbe im Notizen-Tab. Das ist
  Stoas Antwort auf „Ordner für Notizen" — Begründung siehe §7.
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
- **Ein Gesundheits-Blick** `[JS · klein]` — *Backup, Papierkorb und
  Speicher sind über die Einstellungen verstreut.* Eine ruhige Übersicht:
  letztes Backup, was im Papierkorb liegt, wie viel Platz Fotos brauchen.

## 4. Neue Funktionen

**Erfassen**
- ~~**„Warten auf"**~~ — umgesetzt in v1.73.0 (UEBERGABE §8.73). `Task.waiting`
  + `Task.waitingFor`; `isWaiting` steckt in `isCurrent` und damit im EINEN Tor
  vor Heute, Überfällig, Geplant und den Filtern. Eigener Bildschirm
  `/liste/warten`, nach Mensch gruppiert. Kein Zähler, keine Dauer, keine
  Mitteilung. Wege: Schnellmenü, Editor, Assistent.
- ~~**Menschen als eigene Dimension**~~ — umgesetzt in v1.73.0 (UEBERGABE
  §8.73). Eigene Entität `Person`; `personId` an Aufgabe, Notiz und Chat;
  `person/[id].tsx` führt alles zu einem Menschen zusammen. Frei getippt, nicht
  aus den Systemkontakten (`expo-contacts` wäre nativ → eigene Risikoklasse).
  Der Assistent kann eine Person nach Namen zuordnen oder anlegen — erst nach
  dem Bestätigungs-Tipp.
- ~~**Menschen an Terminen**~~ — umgesetzt in v1.74.0 (UEBERGABE §8.74). Eigene
  Tabelle `event_people`, wie Fotos und Dokumente am Termin; MEHRERE Menschen
  pro Termin. Der Assistent kann sie beim Anlegen mitgeben. Die
  EventKit-Teilnehmer bleiben unangetastet — sie sind nur lesbar, und sie zu
  setzen hieße Einladungsmails zu verschicken.
- ~~**Menschen als feste Kontakte**~~ — umgesetzt in v1.75.0 (UEBERGABE §8.78).
  Der eigenständige Weg zum Menschen (bis dahin gab es ihn nur als Nebenprodukt
  einer Aufgabe), Telefon und E-Mail als tippbare Griffe (`tel:`/`mailto:`) und
  der Import aus dem iOS-Adressbuch über `Contact.presentPicker()` — die
  Auswahl läuft außerhalb der App, es kommt nur der eine gewählte Eintrag
  zurück. Der Import KOPIERT: `Person.contactId` ist reine Herkunft, nichts
  liest je daraus nach. Damit ist die alte Risiko-Einschätzung („nativ → eigene
  Risikoklasse", siehe v1.73.0) aufgelöst, ohne Zugriff aufs ganze Buch.

- **Wiedervorlage an Notizen** `[JS · klein]` — *Notizen haben kein Datum, gar
  keins.* Ein Gedanke, der in drei Wochen relevant wird, hat in Stoa keinen Ort
  außer einer Aufgabe, die er nicht ist. Ein optionales „zeig mir das wieder
  am …" macht aus dem Notiz-Stapel ein Gedächtnis statt eines Archivs. Klein,
  weil der Datumswähler und die Benachrichtigungen längst stehen. **NEU**
- **Das stille Protokoll** `[JS · klein–mittel]` — ein winziges lokales
  Ereignis-Log (angelegt / verschoben / erledigt, je ein Zeitstempel). Keine
  Oberfläche, kein Feature — reine Aufzeichnung. Voraussetzung für „Der
  Spiegel" (siehe unten), nützt auch „Das Maß des Tages". **Der einzige Punkt
  der Liste, bei dem Warten echte Kosten hat:** heute überschreibt Verschieben
  einfach `dueDate`, die Tatsache des Verschiebens ist danach weg, und ein
  Protokoll hat erst nach Monaten etwas zu erzählen. **NEU**
- **Web-Suche im Assistenten (Grounding)** `[JS · mittel]` — Gemini kann live
  suchen (`google_search`-Werkzeug); heute verbietet es unser Prompt bewusst.
  Als **eigener Modus** („Im Web suchen"), nie still im Hintergrund: findet
  echte Veranstaltungen/Fakten → direkt zu Terminen/Aufgaben. Quellen müssen
  angezeigt werden; geerdete Anfragen kosten auf deinem Schlüssel extra, und es
  ist langsamer. **NEU**
- ~~**Foto → Aufgaben**~~ — umgesetzt in v1.39.0: Zettel/Aushang/Brief im
  Braindump abfotografieren, der Assistent liest ihn. Offen geblieben: Bilder
  auch im CHAT anhängen (bräuchte Bild-Ablage am Nachrichtenverlauf).
- **Teilen an Stoa, Stufe 2** `[NATIV]` — echte Share-Extension statt
  Kurzbefehl (Stufe 1 läuft seit v1.26.1). Siehe §6.

- **Vorlagen für wiederkehrende Vorhaben** `[JS · mittel]` — Wiederholungen
  bringen eine Aufgabe zurück, aber kein BÜNDEL. „Reise packen",
  „Quartalsabschluss" sind jedes Mal dieselben zwölf Aufgaben. `duplicateList`
  existiert schon, von dort ist es nicht weit. Unspektakulär, aber vermutlich
  das im Alltag meistgenutzte Stück der Liste. **NEU**

**Rhythmus & Praxis**
- **Das Maß des Tages** `[JS · mittel]` — die App weiß nie, ob der Tag
  überhaupt hineinpasst. Wenn sieben Aufgaben und drei Termine rechnerisch elf
  Stunden brauchen, darf sie das ruhig sagen — MORGENS, nicht abends als
  Vorwurf. Ein Satz in der Kopfzeile, wie der Bogen; kein Zähler, keine
  Mahnung. Das ist das Gegenteil von Druck, es verhindert ihn. Infrastruktur
  (`timeboxing.ts`, `dayTimeline.ts`) liegt vollständig. **NEU**
- **Ruhezeiten** `[JS · klein]` — Fenster in den Einstellungen, alles außerhalb
  rutscht auf die nächste Grenze. Eine App namens Stoa, die um 6:40 klingelt,
  widerspricht sich selbst. **NEU**
- **Routinen / „Säulen"** `[JS · groß]` — sanfte wiederkehrende Praktiken.
  ⚠️ Aus dem alten Backlog übernommen, aber **ohne Streak-Mechanik** — eine
  volle Woche darf eine Säule wachsen lassen, ein Aussetzer darf **nichts**
  einreißen. Sonst verletzt es „kein Druck".
- **Fokus** `[JS · mittel]` — eine Aufgabe, ein ruhiger Vollbild-Timer, die Zeit
  bleibt an der Aufgabe vermerkt.
- **Tagesmaxime** `[JS · klein]` — kuratierte stoische Sentenz, offline, morgens
  auf Heute. Klein, aber maximal markengerecht.

**Verstehen & Rückschau**
- **Der Spiegel** `[JS · groß]` — ⚠️ *vom Nutzer vorerst zurückgestellt, hier
  nur als Merkposten.* Das Protokoll der App ist rein schreibend: Erledigtes,
  Betrachtungen, Tages-Sätze werden nie zurückgelesen. Der Spiegel liest sie und
  sagt SELTEN einen Satz — keine Statistik, keine Prozente, sondern
  Beobachtungen („diese drei Aufgaben hast du je fünfmal verschoben"; „das
  Projekt ‚Keller' liegt seit neun Wochen still"). Harte Bedingung: jede
  Beobachtung ist handelbar ODER entlastend, nie bewertend — sonst wird daraus
  eine Schuldmaschine und die Leitplanke „kein Druck" ist verletzt.
  **Voraussetzung:** ein winziges lokales Ereignis-Protokoll (angelegt /
  verschoben / erledigt, je ein Zeitstempel). Beim Verschieben wird heute
  `dueDate` überschrieben — dass verschoben wurde, ist danach weg. Das Protokoll
  hat erst nach Monaten etwas zu erzählen, deshalb müsste es FRÜH kommen, lange
  bevor man den Spiegel selbst baut. **NEU**
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

### Wartet auf den Apple-Developer-Account (bewusst NICHT vorher gepfuscht)

Stand v1.50.0 — alles Folgende ist an ein Entitlement oder an einen echten
Provisioning-Profile gebunden. Es gäbe für zwei davon halbe Notbehelfe (siehe
unten); die wurden **abgelehnt**, weil man sie danach doppelt bauen müsste.

- **CloudKit-Sync** `[ACCOUNT]` — **die wichtigste Lücke überhaupt.** Es gibt
  nur ein Gerät und keine lebende Kopie: geht das iPhone verloren, ist der
  Stand des letzten Auto-Backups da, schlimmstenfalls sechs Tage alt. CloudKit
  ist dabei KEIN „weg von lokal": die Daten liegen in der iCloud des Nutzers,
  unter seinem Apple-Konto — es gibt weiterhin kein Stoa-Konto und keinen
  Stoa-Server, die Zusage auf der Willkommens-Karte bleibt wahr. Öffnet
  zugleich die macOS-Fassung.
  · *Verworfener Notbehelf:* ein „Backup teilen"-Knopf (Share-Sheet → iCloud
    Drive von Hand). Halbe Lösung, die man später wieder ausbaut.
- **Backup in iCloud Drive** `[ACCOUNT]` — braucht das iCloud-Entitlement.
  Heute liegt das Wochen-Backup unter `Paths.document`: sichtbar in der
  Dateien-App und im iCloud-GERÄTE-Backup, aber keine lebende Kopie.
- **Hintergrund-URLSession** `[ACCOUNT]` — die Assistenten-Anfrage läuft
  weiter, wenn die App geschlossen wird; iOS weckt sie mit der Antwort. Braucht
  KEINEN Server. Passt zu v1.46.0: die Erfassen-Wege sind im JSON-Modus, dort
  gibt es ohnehin nichts zu streamen (Background-URLSession kann kein SSE).
  Andockstelle ist `lib/assistantRun.ts`.
- **Home-Screen-Widget** — heutige Aufgaben + nächster Termin. Größter
  Alltagsgewinn der nativen Gruppe. Die eigentliche Schwäche gegenüber Todoist
  ist nicht die App, sondern die ENTFERNUNG zu ihr: dort ist ein Gedanke in
  zwei Sekunden erfasst, hier in acht. Genau dort gehen Gedanken verloren.
- **Orts-Erinnerungen** — „wenn ich beim Baumarkt bin". Über
  `expo-location`-Geofencing, bleibt vollständig lokal und kostenlos. Die
  einzige Art von Erinnerung, die wir gar nicht abbilden — und eine ruhigere als
  jede Uhrzeit, weil sie genau dann kommt, wenn sie nützt. **NEU**
- **Volltextsuche mit OCR über die Fotos** — „wo war der Beleg?". Über Vision,
  komplett offline. Im alten Backlog unterschätzt. **NEU**
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
- **Ordner für Notizen** — erwogen (v1.72.0), verworfen und ERSETZT. Ein Ordner
  verlangt die Entscheidung VOR dem Gedanken, erzeugt zwangsläufig ein
  „Unsortiert" mit schlechtem Gewissen (verletzt „kein Druck") und kennt genau
  EINE Zugehörigkeit. Stattdessen: die Notiz gehört optional zu einer LISTE —
  dem Ort, den es schon gibt (v1.72.0). Ein Zuhause (Projekt), viele Kontexte
  (Tags, §3). Ordner UND Tags nebeneinander wären zwei halbe Netze; genau
  deshalb warten auch die verknüpften Notizen (`[[Notiz]]`, §2) auf „Tags über
  alles". Frei verschachtelbare Ordner mit eigenem Bildschirm bleiben draußen —
  das wäre ein zweiter Listen-Tab, nur für Notizen.
- **Ein drittes Akzent-Hex, Alarm-Rot** — Design-Leitplanke (AGENTS.md).

## 8. Empfohlene Reihenfolge

1. ~~**§1 Offene Kanten**~~ — erledigt in v1.28.0 (Säule + gefühlte Wartezeit).
2. **§2 Der Bogen** — das Flaggschiff, macht die App zu einer Praxis.
   Vorher Mocks zeigen: es ist UX-lastig, da lohnt sich ein Blick vor dem Bau.
3. **§3 Vernetzungen** — Notizen/Chats am Projekt (v1.72.0) und Menschen als
   Dimension (v1.73.0) stehen. Die beiden kleinen sind in v1.31.0 erledigt
   (Checklisten-Zeile → Aufgabe, Projekt-Deadline im Kalender). Als Nächstes das
   Rückgrat: **Tags über alles** — eigener Schritt, weil es das Datenmodell der
   Notizen erweitert.
4. **Web-Suche** — erweitert den Assistenten spürbar, sobald der Bogen steht.
5. **Widget** `[NATIV]` — größter Alltagsgewinn, aber erst wenn alles
   JS-seitige rund ist und ein ruhiger Build-Rhythmus da ist.
