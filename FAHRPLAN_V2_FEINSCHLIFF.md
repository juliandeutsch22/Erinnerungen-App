# Fahrplan V2 — „Aus einem Guss"

Diagnose und Plan für die nächste Ausbaustufe: Kohärenz, Kalender, Gesten.
Stand: Juli 2026, nach Horizont 1 (Backup, Auto-Übernahme, Projekte, Timeboxing).

---

## 1. Ehrliche Diagnose: Warum die App noch nicht „aus einem Guss" wirkt

Die App ist in Wellen gewachsen (M0–M6, dann Feature-Pakete). Jede Welle war in
sich sauber — aber zwischen den Wellen sieht man Nähte:

**a) Zwei Kalender, zwei Optiken.**
`MiniCalendar` (Editoren) und `CalendarMonth` (Kalender-Tab) sind getrennte
Komponenten mit unterschiedlichen Zellgrößen, Auswahl-Formen (Kreis vs. Kasten)
und Typo-Details. Der konkrete Überlappungs-Bug kommt daher: `CalendarMonth`
zeichnet **fixe 42-pt-Kästchen** in `flex: 1`-Spalten — ist die Spalte schmaler
als 42 pt (kleinere iPhones, Panel-Padding), berühren/überlappen sich zwei
nebeneinanderliegende Markierungen (Auswahl-Füllung + Heute-Rahmen).

**b) Zwei Generationen von Sheets.**
Aufgaben- und Termin-Editor haben den neuen Grouped-Look (Karte mit eingerückten
Trennern, kräftiger Titel). `ListEditorSheet`, `RescheduleSheet` und der
Filter-Screen sind noch die alte Generation: frei schwebende Chips, dünne
Trennlinien, kleinerer Titel. Man spürt beim Navigieren den Stilwechsel.

**c) Zwei Gesten-Sprachen bei Zeilen.**
`TaskRow` kann Swipe rechts = erledigt, Swipe links = neu planen. `EventRow`
kann gar nichts — nur Tippen. Gleiches Aussehen, unterschiedliches Verhalten
ist die subtilste Form von „nicht verbunden".

**d) Gesten-Lücken generell.**
Monatswechsel nur über kleine Chevron-Buttons, Tageswechsel in der Agenda nur
übers Grid, kein Long-Press-Schnellmenü. Die App hat Wisch-Gesten gelernt
(Sheets, TaskRow, Fotos) — aber nicht überall, wo die Hand sie erwartet.

**Wichtige Leitplanke aus dem Crash:** Alle neuen Gesten nutzen NUR die
bewährten Primitive (eigenständige Pan-Flächen, `ReanimatedSwipeable` wie in
TaskRow). KEINE Kopplung von Pan-Gesten mit ScrollViews (`Gesture.Native` /
`simultaneousWithExternalGesture`) — das ist auf dem Gerät reproduzierbar
abgestürzt und bleibt tabu.

---

## 2. Paket A — Kalender richtig gut (Bug zuerst)

**A1. Überlappungs-Fix + responsives Grid.** Zellbreite aus der Spaltenbreite
ableiten statt fix 42 pt: Zelle = `aspectRatio` + `maxWidth` mit kleinem
Zwischenraum, Auswahl als Kreis/Rundrechteck, das IMMER innerhalb der Spalte
bleibt. Gleiches Prinzip in `MiniCalendar` (eine gemeinsame `DayCell`).

**A2. Ein Kalender-Kern.** `DayCell` + Monatslogik in eine gemeinsame Basis
ziehen; `CalendarMonth` und `MiniCalendar` werden zwei Größen derselben
Komponente (Marker optional, minDate optional). Danach ist Kalender-Optik
überall identisch — größter Einzelhebel für „aus einem Guss".

**A3. Wisch-Gesten im Kalender.**
- Horizontal über das Monatsgitter wischen = Monat vor/zurück (eigene
  Pan-Fläche, kein Scroll-Konflikt — das Gitter scrollt nicht).
- Horizontal über die Tages-Agenda wischen = Tag vor/zurück.
- Long-Press auf einen Tag = „Neuer Termin an diesem Tag".

**A4. Verbindung Grid ↔ Agenda.** Der gewählte Tag „reicht" optisch in die
Agenda hinein: gleicher Datums-Chip in Teal über der Agenda, sanfter
Crossfade beim Tageswechsel. Auswahl fühlt sich an wie EIN Bauteil.

## 3. Paket B — Kohärenz-Pass (Design-System durchziehen)

**B1. Sheet-Familie vereinheitlichen.** Grouped-Look (Group/RowDivider/
Expanded, Titel T.xl halbfett) auf `ListEditorSheet`, `RescheduleSheet` und
den Filter-Screen ausrollen. Die drei Helfer dafür in EINE gemeinsame Datei
(`SheetParts.tsx`) statt zweimal kopiert in Task-/EventEditor.

**B2. Zeilen-Familie vereinheitlichen.** `EventRow` bekommt dieselbe
Swipe-Sprache wie `TaskRow`: Swipe links = bearbeiten, Swipe rechts = Fotos
öffnen (bzw. hinzufügen). Gleiche Meta-Typo, gleiche Höhen.

**B3. Micro-Motion angleichen.** Einheitliche Reveal-Staffelung (0/80/140/200),
Haptik an denselben Stellen (Auswahl, Erfolg, Löschen zweistufig), identischer
Check-Puls überall.

## 4. Paket C — Gesten-Paket (app-weit, absturzsicher)

**C1.** Long-Press auf Aufgabe = Schnellmenü-Sheet (Heute/Morgen/Flagge/
Erledigt/Löschen) — ein Griff statt Editor öffnen.
**C2.** Long-Press auf Listen-Karte öffnet bereits den Editor — ergänzen um
Haptik + kurzes Scale-Feedback (Konsistenz mit C1).
**C3.** Doppeltipp auf den Heute-Tab = nach oben scrollen + Datum heute wählen.
**C4.** Rückblick: Pinch-to-zoom im Foto-Viewer (eigene Fläche, sicher).

## 5. Paket D — Fit & Finish

**D1.** App-Version hochzählen (app.json `version`) + sichtbar in den
Einstellungen („Version 1.1.0") — damit man am iPhone sofort sieht, welcher
Build läuft.
**D2.** CI-Minuten sparen: `concurrency`-Block in beide Workflows (bricht
doppelte Läufe ab), CI nur noch auf `main` + PRs statt auf jedem Branch-Push.
**D3.** Leere/Lade-Zustände vereinheitlichen (ein `StateView`-Stil überall,
gleiche Icon-Größen, gleiche Tonalität der Texte).
**D4.** Konsistenz-Checkliste einmal durchgehen: Abstände (Spacing-Skala),
Eyebrow-Verwendung, Seam-Ränder, Button-Größen.

---

## 6. Reihenfolge & Aufwand

| Schritt | Inhalt | Aufwand | Warum zuerst |
|---|---|---|---|
| 1 | A1 Überlappungs-Fix | klein | sichtbarer Bug |
| 2 | A2 Ein Kalender-Kern | mittel | Fundament für A3/A4 |
| 3 | B1 Sheet-Familie | mittel | größter „ein Guss"-Effekt |
| 4 | A3+A4 Kalender-Gesten + Verbindung | mittel | fühlbarer Qualitätssprung |
| 5 | B2+B3 Zeilen + Motion | klein–mittel | Konsistenz komplett |
| 6 | C1–C4 Gesten-Paket | mittel | Komfort obendrauf |
| 7 | D1–D4 Fit & Finish | klein | Rundung, spart zudem CI-Minuten |

Nach jedem Schritt: tsc + Tests + Web-Build + Screenshots; native Gesten
werden erst nach einem Geräte-Test des IPA als „fertig" markiert.
