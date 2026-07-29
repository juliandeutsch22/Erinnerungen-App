// QuickAdd.tsx — die EINE Zeile („Was liegt an?"), als Glass-Pill über der
// Tab-Bar (Fahrplan §3.4/§4).
//
// Sie war einmal nur eine Schnellerfassung. Seit v1.52.0 ist sie die einzige
// Tür für Text: man tippt hinein, was auch immer man will, und die App findet
// heraus, was es war (lib/inputRoute.ts). Man wählt KEINEN Modus mehr — das
// war die eigentliche Reibung, denn diese Entscheidung kam vor dem Denken.
//
//   „Milch kaufen morgen 10 Uhr"       → sofort angelegt, lokal, ohne Netz
//   „Was steht morgen an?"             → Antwort über der Zeile, kein Chat
//   „Verschieb den Zahnarzt auf Freitag" → Karte, ein Tipp bestätigt
//   drei Zeilen durcheinander          → sortiert wie im Braindump
//
// Die Reihenfolge ist nicht verhandelbar: Der lokale Parser sieht ZUERST hin.
// Ohne Schlüssel bleibt die Zeile deshalb genau so nutzbar wie vorher —
// erkannte Teile als Chips, Return legt an, kein Netz, keine Wartezeit.
//
// Seit v1.53.0 (Stufe 2) kann man in die Zeile auch SPRECHEN (das Diktat füllt
// das Feld, man sieht das Gesagte vor dem Abschicken), Vorschläge einzeln
// abwählen und zurechtrücken — und die Weiche ÜBERSTIMMEN: über den sichtbaren
// Weg-Chip oder, als Abkürzung, mit einem langen Druck auf den Knopf.
import { Camera, CalendarDays, Check, Clock, Image as ImageIcon, Paperclip, Plus, Repeat, Sparkles, Undo2, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionEditSheet, type EditTarget } from '@/components/ActionEditSheet';
import { Glass } from '@/components/Glass';
import { MicButton } from '@/components/MicButton';
import { OmniResult, omniZeilen } from '@/components/OmniResult';
import { PopIn } from '@/components/PopIn';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { LIST_COLORS } from '@/components/listMeta';
import { useCreateAssistantEvents, useDeviceEvents } from '@/data/calendarQueries';
import { useCreateNote, useDeleteNote, useNotes } from '@/data/noteQueries';
import { useCompleteTask, useCreateList, useCreateTask, useDeleteList, useDeleteTask, useLists, useReopenTask, useRestoreTask, useTasks, useUpdateTask } from '@/data/queries';
import { DEFAULT_LIST_ID } from '@/data/ListRepository';
import type { ChatMessage } from '@/data/types';
import { hasCalendarPermission } from '@/lib/deviceCalendar';
import { applyAssistantActions, undoAppliedActions } from '@/lib/applyActions';
import { type AssistantAction, type AssistantImage, askAssistant, buildAppContext, extractActions, IMAGE_LIMIT, type ToolData } from '@/lib/assistant';
import { assistantCameraAvailable, assistantImagesAvailable, captureAssistantImage, pickAssistantImages } from '@/lib/assistantImage';
import { RUN_ZEILE, useAssistantRuns } from '@/lib/assistantRun';
import { addDays, formatDueDate, todayStr } from '@/lib/dates';
import { useSheetOffen } from '@/lib/sheetPresence';
import { NOTHING_REMOVED, type Removed, useZeileDraft } from '@/lib/zeileDraft';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { useUndo } from '@/lib/undo';
import { routeInput, zeileVorschlaege, type AssistentGrund } from '@/lib/inputRoute';
import { parseQuickAdd } from '@/lib/quickAddParser';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { useSettings } from '@/theme/settings.store';
import { MAX_CONTENT_WIDTH, TAB_BAR_HEIGHT, webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Shadow, Spacing, T } from '@/theme/theme.tokens';

const RRULE_LABEL: Record<string, string> = {
  daily: 'Täglich',
  weekdays: 'Werktags',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
};


// Wie lange die Quittung steht.
//
// Sie sitzt IM Fluss über der Eingabezeile, nicht als schwebende Leiste am
// Bildschirmrand — jede Sekunde kostet hier mehr als bei der globalen
// Undo-Leiste (die deshalb bei UNDO_MS bleibt). Bemessen am Lesen und
// Entscheiden: „1 Projekt, 2 Aufgaben, 1 Notiz übernommen." liest man in gut
// zwei Sekunden, entschieden ist man nach weiteren zwei. Danach steht sie nur
// noch herum — und ausgerechnet über dem Feld, in das man als Nächstes tippt.
const QUITTUNG_MS = 2400;
const QUITTUNG_UNDO_MS = 4500;

// Die Zeile liegt HÖHER als alles andere — sie ist die Tür, nicht eine Karte
// unter vielen. Shadow.lg (9 %, Radius 12) verschwand auf dem cremefarbenen
// Grund; das hier ist derselbe weiche, flache Charakter, nur weit genug
// getrieben, dass die Kante trägt. Bewusst KEIN Token: sonst wandert der Wert
// über die App und alles fängt an zu schweben.
const SCHATTEN_ZEILE = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.16,
  shadowRadius: 18,
  elevation: 6,
} as const;

export function QuickAdd({
  listId = DEFAULT_LIST_ID,
  /** Der Tag, den der Bildschirm gerade zeigt (Kalender). Findet der Parser
   *  KEIN Datum, landet die Aufgabe dort — wer am 5. August steht und
   *  „Zahnarzt 10 Uhr" tippt, meint den 5. August. Der Chip zeigt es an und
   *  lässt sich abnehmen, es passiert also nichts hinter dem Rücken. */
  basisDatum,
  /** Schwebt hier eine Tab-Bar darunter? In geschobenen Routen (Listen-Detail)
   *  nicht — dort säße die Zeile sonst 64 px über dem Nichts. */
  ueberTabBar = true,
}: {
  listId?: string;
  basisDatum?: string;
  ueberTabBar?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const createTask = useCreateTask();
  const createList = useCreateList();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const createNote = useCreateNote();
  const createEvents = useCreateAssistantEvents();
  // Nur fuer das Ruecknehmen eines uebernommenen Vorschlags.
  const restoreTask = useRestoreTask();
  const reopenTask = useReopenTask();
  const deleteNote = useDeleteNote();
  const deleteList = useDeleteList();
  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const { data: notes } = useNotes();

  const apiKey = useSettings((s) => s.geminiApiKey);
  const memory = useSettings((s) => s.assistantMemory);
  const contextEnabled = useSettings((s) => s.assistantContextEnabled);

  const run = useAssistantRuns((s) => s.runs[RUN_ZEILE]);
  const beginRun = useAssistantRuns((s) => s.begin);
  const deltaRun = useAssistantRuns((s) => s.delta);
  const finishRun = useAssistantRuns((s) => s.finish);
  const failRun = useAssistantRuns((s) => s.fail);
  const clearRun = useAssistantRuns((s) => s.clear);
  const [grund, setGrund] = useState<AssistentGrund>('auftrag');

  // Text, Chips und Bilder liegen im Store, nicht im Bildschirm — sonst haette
  // jeder Tab seinen eigenen Entwurf und „eine Zeile" waeren vier (zeileDraft.ts).
  const text = useZeileDraft((s) => s.text);
  const setText = useZeileDraft((s) => s.setText);
  const removed = useZeileDraft((s) => s.removed);
  const setRemoved = useZeileDraft((s) => s.setRemoved);
  /** Abgewählte Vorschläge und der gerade offene Schnell-Editor. */
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<EditTarget | null>(null);
  /** Weiche überstimmt? Gilt für genau diese Eingabe und wird beim Tippen
   *  wieder gelöst — eine dauerhafte Umschaltung wäre ein versteckter Modus,
   *  und Modi loszuwerden war der ganze Punkt. */
  const ueberstimmt = useZeileDraft((s) => s.ueberstimmt);
  const setUeberstimmt = useZeileDraft((s) => s.setUeberstimmt);
  const [diktiert, setDiktiert] = useState(false);
  const diktatBasis = useRef('');
  /** Angehängte Bilder. Sie leben NUR bis zum Abschicken — kein Dateisystem,
   *  kein Backup, keine Notiz (siehe `assistantImage.ts`). Ein abfotografierter
   *  Zettel soll keine Spur hinterlassen, die man später aufräumen muss. */
  const bilder = useZeileDraft((s) => s.bilder);
  const setBilder = useZeileDraft((s) => s.setBilder);
  /** Ist die Auswahl „Abfotografieren / Mediathek" aufgeklappt? */
  const [anhangOffen, setAnhangOffen] = useState(false);
  /** Kurze Quittung an der Stelle, wo eben noch die Karte stand — sonst
   *  verschwindet sie einfach und man muss blind vertrauen. */
  const [quittung, setQuittung] = useState<{ text: string; zurueck?: () => Promise<void> } | null>(null);
  /** Läuft der Abgang gerade? Abgebaut wird erst, wenn er durch ist. */
  const [quittungGeht, setQuittungGeht] = useState(false);
  // Derselbe Zustand als Ref: `onWeg` läuft aus einem Animations-Callback und
  // darf keine INZWISCHEN neu gezeigte Quittung abräumen („Zurückgenommen."
  // erscheint, während die alte noch ausblendet).
  const gehtRef = useRef(false);
  const quittungTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beendeQuittung = () => {
    gehtRef.current = true;
    setQuittungGeht(true);
  };
  const zeigeQuittung = (text: string, zurueck?: () => Promise<void>) => {
    if (quittungTimer.current) clearTimeout(quittungTimer.current);
    gehtRef.current = false;
    setQuittungGeht(false);
    setQuittung({ text, zurueck });
    quittungTimer.current = setTimeout(beendeQuittung, zurueck ? QUITTUNG_UNDO_MS : QUITTUNG_MS);
  };

  const today = todayStr();

  // Die Termine holt die Zeile SELBST — früher reichte „Heute" sie herein, und
  // §8.42 mahnte schon an, dass jeder weitere Bildschirm das nachziehen müsse.
  // Genau so vergisst man es. Der Query-Schlüssel ist derselbe wie auf „Heute",
  // die Antwort kommt also aus dem Cache: keine zweite Abfrage, aber überall
  // dieselbe Auskunft auf „Was steht morgen an?".
  const [calGranted, setCalGranted] = useState(false);
  useEffect(() => {
    void hasCalendarPermission().then(setCalGranted);
  }, []);
  const { data: events } = useDeviceEvents(today, addDays(today, 6), calGranted);

  const parsed = useMemo(() => parseQuickAdd(text, today), [text, today]);
  // Das Basisdatum greift NUR, wenn der Parser nichts gefunden hat und wirklich
  // etwas im Feld steht — sonst stünde auf dem Kalender dauerhaft ein
  // Datums-Chip an einer leeren Zeile.
  const basis = basisDatum && text.trim().length > 0 ? basisDatum : null;
  const dueDate = removed.date ? null : (parsed.dueDate ?? basis);
  const dueTime = removed.date || removed.time ? null : parsed.dueTime;
  const rrule = removed.date || removed.rrule ? null : parsed.rrule;

  /** Der Weg an den Assistenten. Der Lauf lebt im Store, überlebt also das
   *  Wegtippen und einen Bildschirmwechsel. */
  const frage = async (eingabe: string, warum: AssistentGrund, mitBildern: AssistantImage[] = []) => {
    setGrund(warum);
    beginRun(RUN_ZEILE, 'Zeile', eingabe);
    try {
      const kontext = contextEnabled
        ? buildAppContext({ events: events ?? [], tasks: tasks ?? [], lists: lists ?? [], notes: notes ?? [], today, calendarDenied: !calGranted })
        : null;
      // Werkzeuge am SELBEN Schalter wie der Überblick — wer ihn ausschaltet,
      // will nicht, dass stattdessen nachgeschlagen wird.
      const toolData: ToolData | null = contextEnabled
        ? { tasks: tasks ?? [], lists: lists ?? [], notes: notes ?? [], today }
        : null;
      const msg: ChatMessage = {
        id: 'zeile', chatId: 'zeile', role: 'user', content: eingabe, createdAt: new Date().toISOString(),
      };
      const antwort = await askAssistant(apiKey, [msg], kontext, memory, {
        toolData,
        images: mitBildern,
        onDelta: (d) => deltaRun(RUN_ZEILE, d),
      });
      const { clean, actions } = extractActions(antwort);
      setDeselected(new Set());
      finishRun(RUN_ZEILE, { clean, actions });
    } catch (e) {
      failRun(RUN_ZEILE, e instanceof Error ? e.message : 'Unbekannter Fehler.');
    }
  };

  const anhaengen = async (neu: Promise<AssistantImage[]>) => {
    const got = await neu;
    setAnhangOffen(false);
    if (got.length === 0) return;
    hapticSelect();
    setBilder((prev) => [...prev, ...got].slice(0, IMAGE_LIMIT));
  };

  /** Einen der drei Chips abschicken. Sie sind fertige Fragen, keine Vorlagen
   *  — ein Zwischenschritt „erst ins Feld, dann tippen" wäre ein Tipp zu viel.
   *  Der Grund kommt trotzdem aus `routeInput`, damit die Wartezeile dasselbe
   *  sagt wie bei getippten Fragen. */
  const vorschlagSenden = (v: string) => {
    hapticSelect();
    const r = routeInput(v, today, apiKey.length > 0);
    setText('');
    setRemoved(NOTHING_REMOVED);
    setUeberstimmt(false);
    void frage(v, r.ziel === 'assistent' ? r.grund : 'auftrag');
  };

  const submit = (umkehren = false) => {
    const eingabe = text.trim();
    // Ein Foto allein genügt — der Zettel IST die Eingabe.
    if (eingabe.length === 0 && bilder.length === 0) return;

    // Ein Bild hebt die Weiche AUF, es gibt keine zweite Meinung: der lokale
    // Parser kann kein Foto lesen. Deshalb ist das Überstimmen hier gesperrt
    // (siehe `zeigtWegChip`) — sonst würde das Bild still fallengelassen.
    if (bilder.length > 0) {
      const mit = bilder;
      setText('');
      setRemoved(NOTHING_REMOVED);
      setUeberstimmt(false);
      setBilder([]);
      setAnhangOffen(false);
      void frage(eingabe || 'Lies das Bild.', 'wurf', mit);
      return;
    }

    const roh = routeInput(eingabe, today, apiKey.length > 0);
    // Überstimmen dreht die Entscheidung — aber nie ins Netz, wenn es gar
    // keinen Schlüssel gibt.
    const nachAssistent = umkehren ? roh.ziel === 'lokal' : roh.ziel === 'assistent';
    const weiche = nachAssistent && apiKey.length > 0 ? { ...roh, ziel: 'assistent' as const } : roh;

    if (weiche.ziel === 'lokal' || !nachAssistent) {
      const aufgabe = roh.ziel === 'lokal' ? roh.aufgabe : parsed;
      // Die im Feld abgewählten Chips gewinnen über den Parser.
      const titel = aufgabe.title || eingabe;
      createTask.mutate({ listId, title: titel, dueDate, dueTime, rrule, tags: aufgabe.tags });
      hapticSuccess();
      setText('');
      setRemoved(NOTHING_REMOVED);
      setUeberstimmt(false);
      // Fokus behalten — nächster Gedanke sofort rein (unter 3 Sekunden).
      inputRef.current?.focus();
      return;
    }

    setText('');
    setRemoved(NOTHING_REMOVED);
    setUeberstimmt(false);
    void frage(eingabe, roh.ziel === 'assistent' ? roh.grund : 'auftrag');
  };

  const toggleZeile = (key: string) => {
    hapticSelect();
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** Schlüssel („a0") → Ziel des Schnell-Editors. */
  const oeffneEditor = (key: string) => {
    hapticSelect();
    const index = Number(key.slice(1));
    if (key.startsWith('a')) setEdit({ kind: 'aufgabe', index });
    else if (key.startsWith('t')) setEdit({ kind: 'termin', index });
    else if (key.startsWith('n')) setEdit({ kind: 'notiz', index });
  };

  const uebernehmen = async () => {
    const actions = run?.status === 'done' ? run.actions : null;
    if (!actions) return;
    hapticSuccess();
    const gewaehlt: AssistantAction = {
      ...actions,
      listen: actions.listen.filter((_, i) => !deselected.has(`l${i}`)),
      aenderungen: actions.aenderungen.filter((_, i) => !deselected.has(`x${i}`)),
      aufgaben: actions.aufgaben.filter((_, i) => !deselected.has(`a${i}`)),
      termine: actions.termine.filter((_, i) => !deselected.has(`t${i}`)),
      notizen: actions.notizen.filter((_, i) => !deselected.has(`n${i}`)),
    };
    let res;
    try {
      res = await applyAssistantActions(gewaehlt, {
        lists: lists ?? [],
        tasks: tasks ?? [],
        today,
        createList: (input) => createList.mutateAsync(input),
        createTask: (input) => createTask.mutateAsync(input),
        createNote: (body) => createNote.mutateAsync({ body }),
        updateTask: (id, patch) => updateTask.mutateAsync({ id, patch }),
        completeTask: (t) => completeTask.mutateAsync(t),
        trashTask: (id) => deleteTask.mutateAsync(id),
        createEvents: (termine) => createEvents(termine),
        colorAt: (i) => LIST_COLORS[i % LIST_COLORS.length],
      });
    } catch (e) {
      failRun(RUN_ZEILE, `Konnte es nicht anlegen: ${e instanceof Error ? e.message : 'Unbekannter Fehler.'}`);
      return;
    }
    clearRun(RUN_ZEILE);
    setDeselected(new Set());

    // Ein Tipp schreibt hier bis zu einem Dutzend Einträge in Listen, Notizen
    // und Kalender. Die Karte verhindert das VERSEHENTLICHE Übernehmen — gegen
    // ein bereutes half sie nie, und das Aufräumen führte über vier
    // Bildschirme. (Bis v1.56 stand in `undo.ts`, das sei bewusst nicht
    // rückgängig zu machen; das war zu kurz gedacht.)
    // Das Rückgängig sitzt IN der Quittung, nicht in der globalen Undo-Leiste:
    // die läge an derselben Stelle, und zwei Meldungen übereinander sind
    // schlimmer als eine. Außerdem schaut man nach dem Tippen ohnehin genau
    // dorthin.
    const u = res.rueckgaengig;
    const etwasZurueck =
      u.aufgaben.length + u.notizen.length + u.listen.length + u.aenderungen.length + u.entsorgt.length + u.abgehakt.length > 0;
    const zurueck = etwasZurueck
      ? async () => {
          hapticSelect();
          await undoAppliedActions(u, {
            trashTask: (id) => deleteTask.mutateAsync(id),
            restoreTask: (id) => restoreTask.mutateAsync(id),
            reopenTask: (id) => reopenTask.mutateAsync(id),
            updateTask: (id, patch) => updateTask.mutateAsync({ id, patch }),
            trashNote: (id) => deleteNote.mutateAsync(id),
            trashList: (id) => deleteList.mutateAsync(id),
          });
          // Das Zurücknehmen benutzt `deleteTask` & Co., und die merken sich
          // ihrerseits ein Rückgängig (data/queries.ts). Ohne das hier stünde
          // danach „In den Papierkorb gelegt · Rückgängig" da und böte an, EINE
          // der gerade zurückgenommenen Aufgaben wiederzuholen — ein Rückgängig
          // für das Rückgängig, und dazu ein irreführendes.
          useUndo.getState().clear();
          // Ehrlich bleiben: Termine liegen im Gerätekalender und bleiben.
          zeigeQuittung(res.termine > 0 ? 'Zurückgenommen — Termine bleiben im Kalender.' : 'Zurückgenommen.');
        }
      : undefined;

    const teile = [
      res.projekte > 0 ? `${res.projekte} ${res.projekte === 1 ? 'Projekt' : 'Projekte'}` : '',
      res.aenderungen > 0 ? `${res.aenderungen} ${res.aenderungen === 1 ? 'Änderung' : 'Änderungen'}` : '',
      res.aufgaben > 0 ? `${res.aufgaben} ${res.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}` : '',
      res.termine > 0 ? `${res.termine} ${res.termine === 1 ? 'Termin' : 'Termine'}` : '',
      res.notizen > 0 ? `${res.notizen} ${res.notizen === 1 ? 'Notiz' : 'Notizen'}` : '',
    ].filter(Boolean);
    zeigeQuittung(teile.length > 0 ? `${teile.join(', ')} übernommen.` : 'Nichts zu übernehmen.', zurueck);
  };

  // Einmal rechnen: der Knopf verrät damit VOR dem Tippen, was passieren wird.
  const weicheJetzt = useMemo(
    () => routeInput(text.trim(), today, apiKey.length > 0),
    [text, today, apiKey],
  );
  // Was der Knopf ZEIGT — inklusive eines etwaigen Überstimmens. Mit Bild ist
  // die Sache entschieden: es geht an den Assistenten, sonst nirgendwohin.
  const gehtLokal = weicheJetzt.ziel === 'lokal';
  const zeigtLokal = bilder.length > 0 ? false : ueberstimmt ? !gehtLokal : gehtLokal;
  // Der Chip erscheint nur, wenn es überhaupt eine Wahl gibt: mit Text im Feld
  // und mit Schlüssel. Ohne Schlüssel führt nur ein Weg irgendwohin — und mit
  // einem Bild ebenfalls nicht, denn der lokale Parser kann es nicht lesen.
  // Ein Chip, der aussieht wie eine Wahl und keine ist, wäre schlimmer als
  // keiner.
  const zeigtWegChip = text.trim().length > 0 && apiKey.length > 0 && bilder.length === 0;
  // Anhängen kann nur, wer den Assistenten überhaupt hat: ohne Schlüssel gäbe
  // es niemanden, der das Bild liest — dieselbe Leitplanke wie beim Weg-Chip.
  // Die Klammer bleibt auch beim Erreichen der Grenze stehen (sonst wäre der
  // linke Platz plötzlich wieder ein totes Plus); nur die Wege verschwinden.
  const zeigtKlammer = apiKey.length > 0 && assistantImagesAvailable;
  const kannAnhaengen = zeigtKlammer && bilder.length < IMAGE_LIMIT;
  const etwasZuSenden = text.trim().length > 0 || bilder.length > 0;

  // Die drei Vorschläge für die leere, angetippte Zeile. Rein lokal (siehe
  // `zeileVorschlaege`) — sie kosten nichts und erzählen, was die Zeile kann.
  // Nur wenn wirklich nichts anderes im Weg ist: kein Text, kein Bild, kein
  // Lauf, keine Quittung — sonst wäre es eine Reihe zu viel.
  const [fokus, setFokus] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zeigtVorschlaege =
    fokus && apiKey.length > 0 && text.length === 0 && bilder.length === 0 && !run && !quittung;
  const vorschlaege = useMemo(() => zeileVorschlaege(tasks ?? [], today), [tasks, today]);

  // Auf welche Liste geht das hier? Nur ansagen, wenn es NICHT der Eingang ist
  // — auf „Heute" wäre „→ Erinnerungen" bloß Rauschen.
  const zielListe = listId === DEFAULT_LIST_ID ? null : (lists ?? []).find((l) => l.id === listId) ?? null;

  const chips: { key: keyof Removed; icon: typeof Clock; label: string }[] = [];
  if (dueDate) chips.push({ key: 'date', icon: CalendarDays, label: formatDueDate(dueDate, today) });
  if (dueTime) chips.push({ key: 'time', icon: Clock, label: dueTime });
  if (rrule) chips.push({ key: 'rrule', icon: Repeat, label: RRULE_LABEL[rrule] ?? 'Wiederholung' });

  // Tastatur: gemessene Höhe statt KeyboardAvoidingView (bei position:absolute
  // unzuverlässig — die Pill wanderte an unlogische Stellen). Tastatur offen →
  // Pill sitzt direkt darüber; zu → über der schwebenden Tab-Bar.
  const keyboard = useKeyboardHeight();
  const restingBottom = Math.max(insets.bottom, Spacing.md) + (ueberTabBar ? TAB_BAR_HEIGHT + Spacing.sm : 0);

  // Liegt ein Sheet über dem Bildschirm, tritt die Zeile zurück. Sheets sind
  // RN-Modals in einer eigenen View-Hierarchie: die Zeile läge dahinter und
  // würde bei offener Tastatur daneben hervorschauen. Der Lauf lebt im Store,
  // eine offene Antwort ist danach also wieder da.
  const sheetOffen = useSheetOffen();

  // Der eigene Schnell-Editor wird IMMER gerendert, auch wenn die Zeile
  // zurücktritt — er ist selbst ein Sheet und würde sich sonst beim Öffnen
  // sofort wieder abbauen.
  const schnellEditor = edit && run?.status === 'done' && run.actions && (
    <ActionEditSheet
      target={edit}
      actions={run.actions}
      lists={lists ?? []}
      onClose={() => setEdit(null)}
      onSave={(next) => finishRun(RUN_ZEILE, { clean: run.clean, actions: next })}
    />
  );

  if (sheetOffen) return <>{schnellEditor}</>;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <View
        pointerEvents="box-none"
        style={{
          alignItems: 'center',
          paddingHorizontal: Spacing.lg,
          paddingBottom: keyboard > 0 ? keyboard + Spacing.sm : restingBottom,
        }}
      >
        <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: Spacing.xs }}>
          {!run && quittung && (
            // Eine Meldung ERSCHEINT, sie tritt nicht auf: 0.94 statt 0.6 und
            // die weiche Feder. Und sie geht wieder, statt zu verschwinden —
            // ein harter Schnitt nach einem weichen Auftritt liest sich als
            // Fehler.
            <PopIn
              von={0.94}
              feder="gentle"
              sichtbar={!quittungGeht}
              onWeg={() => {
                if (!gehtRef.current) return;
                gehtRef.current = false;
                setQuittung(null);
                setQuittungGeht(false);
              }}
            >
              <Glass
                variant="pill"
                intensity={85}
                style={[Shadow.sm, { alignSelf: 'flex-start' }]}
                contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: Spacing.sm + 2 }}
              >
                <Check size={13} color={colors.teal} strokeWidth={2.6} />
                <Type variant="caption" tone="teal">{quittung.text}</Type>
                {quittung.zurueck && (
                  <PressableScale
                    accessibilityLabel="Übernommenes zurücknehmen"
                    onPress={() => {
                      if (quittungTimer.current) clearTimeout(quittungTimer.current);
                      // Die alte Quittung geht, die neue („Zurückgenommen.")
                      // kommt — sonst tauschte der Text unter der Hand.
                      beendeQuittung();
                      void quittung.zurueck?.();
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: Spacing.xs }}
                  >
                    <Undo2 size={12} color={colors.indigo} strokeWidth={2.4} />
                    <Type variant="caption" tone="indigo">Rückgängig</Type>
                  </PressableScale>
                )}
              </Glass>
            </PopIn>
          )}
          {run && (
            <PopIn>
              <OmniResult
                run={run}
                grund={grund}
                tasks={tasks ?? []}
                today={today}
                deselected={deselected}
                onToggle={toggleZeile}
                onEdit={oeffneEditor}
                onApply={() => void uebernehmen()}
                onDismiss={() => {
                  clearRun(RUN_ZEILE);
                  setDeselected(new Set());
                }}
              />
            </PopIn>
          )}
          {/* Angehängte Bilder: sichtbar, einzeln abnehmbar, mit der klaren
              Ansage, was mit ihnen passiert. Sie stehen ÜBER der Zeile, nicht
              darin — eine Miniatur in einer 58 px hohen Pille wäre ein Fleck. */}
          {bilder.length > 0 && (
            <PopIn>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: Spacing.sm }}>
                {bilder.map((img, i) => (
                  <View key={i} style={{ width: 48, height: 48, borderRadius: R.md, overflow: 'hidden' }}>
                    <Image
                      source={{ uri: `data:${img.mimeType};base64,${img.data}` }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                    <PressableScale
                      accessibilityLabel={`Bild ${i + 1} entfernen`}
                      onPress={() => setBilder((prev) => prev.filter((_, k) => k !== i))}
                      style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 3 }}
                    >
                      <X size={11} color="#FFFFFF" strokeWidth={2.6} />
                    </PressableScale>
                  </View>
                ))}
                <Type variant="caption" tone="text3" style={{ flex: 1 }}>
                  Geht an den Assistenten — wird gelesen, nicht gespeichert.
                </Type>
              </View>
            </PopIn>
          )}

          {/* Beide Wege SICHTBAR, keiner als Geste. Auf dem Gerät steht die
              Kamera zuerst: „der Zettel liegt vor mir" ist der häufigere Fall
              als die Mediathek — dieselbe Reihenfolge wie im Braindump. */}
          {anhangOffen && zeigtKlammer && (
            <PopIn>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingLeft: Spacing.sm }}>
                {!kannAnhaengen && (
                  <Type variant="caption" tone="text3">
                    Mehr als {IMAGE_LIMIT} Bilder gehen nicht auf einmal.
                  </Type>
                )}
                {kannAnhaengen && assistantCameraAvailable && (
                  <PressableScale
                    accessibilityLabel="Zettel abfotografieren"
                    onPress={() => void anhaengen(captureAssistantImage())}
                  >
                    <Glass
                      variant="pill"
                      style={Shadow.sm}
                      contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: 6, paddingHorizontal: Spacing.sm + 2 }}
                    >
                      <Camera size={12} color={colors.teal} strokeWidth={2.2} />
                      <Type variant="caption" tone="teal">Abfotografieren</Type>
                    </Glass>
                  </PressableScale>
                )}
                {kannAnhaengen && (
                  <PressableScale
                    accessibilityLabel="Foto aus der Mediathek"
                    onPress={() => void anhaengen(pickAssistantImages(IMAGE_LIMIT - bilder.length))}
                  >
                    <Glass
                      variant="pill"
                      style={Shadow.sm}
                      contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: 6, paddingHorizontal: Spacing.sm + 2 }}
                    >
                      <ImageIcon size={12} color={colors.teal} strokeWidth={2.2} />
                      <Type variant="caption" tone="teal">Aus der Mediathek</Type>
                    </Glass>
                  </PressableScale>
                )}
              </View>
            </PopIn>
          )}

          {/* Was die Zeile kann, sieht man ihr nicht an. Drei ruhige Chips beim
              Antippen sagen es — lokal abgeleitet, also immer wahr, und sofort
              wieder weg, sobald man selbst tippt. Kein Tutorial, keine Kosten. */}
          {zeigtVorschlaege && vorschlaege.length > 0 && (
            <PopIn>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingLeft: Spacing.sm }}>
                {vorschlaege.map((v) => (
                  <PressableScale
                    key={v}
                    accessibilityLabel={`Vorschlag: ${v}`}
                    onPress={() => vorschlagSenden(v)}
                  >
                    <Glass
                      variant="pill"
                      style={Shadow.sm}
                      contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: 6, paddingHorizontal: Spacing.sm + 2 }}
                    >
                      <Sparkles size={11} color={colors.teal} strokeWidth={2.2} />
                      <Type variant="caption" tone="teal">{v}</Type>
                    </Glass>
                  </PressableScale>
                ))}
              </View>
            </PopIn>
          )}

          {(chips.length > 0 || zeigtWegChip || (zielListe !== null && text.trim().length > 0)) && (
            <View style={{ flexDirection: 'row', gap: Spacing.xs, justifyContent: 'flex-start', paddingLeft: Spacing.sm }}>
              {/* Der Weg-Chip sagt SICHTBAR, wohin die Eingabe geht, und ist
                  antippbar. Eine versteckte Geste (langer Druck) wäre in einer
                  App, deren Prämisse „nichts zu lernen" ist, ein Widerspruch:
                  wer sie vergisst, für den gibt es die Funktion nicht mehr. */}
              {zeigtWegChip && (
                <PopIn>
                  <PressableScale
                    accessibilityLabel={
                      zeigtLokal ? 'Stattdessen den Assistenten fragen' : 'Stattdessen als Aufgabe anlegen'
                    }
                    onPress={() => {
                      hapticSelect();
                      setUeberstimmt((v) => !v);
                    }}
                  >
                    <Glass
                      variant="pill"
                      style={Shadow.sm}
                      contentStyle={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: Spacing.xs,
                        paddingVertical: 6,
                        paddingHorizontal: Spacing.sm + 2,
                      }}
                    >
                      {zeigtLokal ? (
                        <Plus size={12} color={colors.text3} strokeWidth={2.2} />
                      ) : (
                        <Sparkles size={12} color={colors.teal} strokeWidth={2.2} />
                      )}
                      <Type variant="caption" tone={zeigtLokal ? 'text3' : 'teal'}>
                        {zeigtLokal ? 'wird angelegt' : 'geht an den Assistenten'}
                      </Type>
                    </Glass>
                  </PressableScale>
                </PopIn>
              )}
              {/* Wohin es geht, wenn der Bildschirm eine Liste IST. Bewusst
                  ohne X: das ist kein Parser-Fund, den man abwählt, sondern
                  der Ort, an dem man steht. Sichtbar muss es trotzdem sein —
                  eine Aufgabe, die still woanders landet, wäre Magie. */}
              {zielListe && text.trim().length > 0 && (
                <PopIn>
                  <Glass
                    variant="pill"
                    style={Shadow.sm}
                    contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: 6, paddingHorizontal: Spacing.sm + 2 }}
                  >
                    <Type variant="caption" tone="text3">→</Type>
                    <Type variant="caption" tone="teal" numberOfLines={1}>{zielListe.name}</Type>
                  </Glass>
                </PopIn>
              )}
              {chips.map((c) => (
                <PopIn key={c.key}>
                  <PressableScale
                    accessibilityLabel={`${c.label} entfernen`}
                    onPress={() => setRemoved((r) => ({ ...r, [c.key]: true }))}
                  >
                    <Glass
                      variant="pill"
                      style={Shadow.sm}
                      contentStyle={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: Spacing.xs,
                        paddingVertical: 6,
                        paddingHorizontal: Spacing.sm + 2,
                      }}
                    >
                      <c.icon size={12} color={colors.teal} strokeWidth={2.2} />
                      <Type variant="caption" tone="teal">{c.label}</Type>
                      <X size={11} color={colors.text3} strokeWidth={2.2} />
                    </Glass>
                  </PressableScale>
                </PopIn>
              ))}
            </View>
          )}
          <Glass
            variant="pill"
            intensity={85}
            style={SCHATTEN_ZEILE}
            contentStyle={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              paddingVertical: Spacing.sm + 5,
              paddingHorizontal: Spacing.md,
            }}
          >
            {/* Der linke Platz. Bis v1.53.4 stand hier ein rein dekoratives
                Plus — und seit es den Akzent trug, sah es aus wie ein Knopf,
                ohne einer zu sein (in iOS heißt ein farbiges + links in einer
                Eingabezeile seit jeher „hier kommt etwas dran"). Jetzt löst es
                das Versprechen ein: Büroklammer = Bild anhängen. Wer keinen
                Schlüssel hat, sieht weiter das Plus — dort ist es ehrlich, denn
                dann legt die Zeile wirklich nur an. */}
            {zeigtKlammer ? (
              <PressableScale
                accessibilityLabel={anhangOffen ? 'Anhängen abbrechen' : 'Bild anhängen'}
                accessibilityState={{ expanded: anhangOffen }}
                onPress={() => {
                  hapticSelect();
                  setAnhangOffen((v) => !v);
                }}
                style={{ marginLeft: -2, padding: 2 }}
              >
                {/* Jetzt DARF es den Akzent tragen: es ist ein echter Knopf.
                    Damit bleibt der Anker erhalten, den die Zeile in v1.53.4
                    bekommen hat — er lügt nur nicht mehr. */}
                <Paperclip size={18} color={colors.teal} strokeWidth={2.2} />
              </PressableScale>
            ) : (
              <Plus size={18} color={colors.text3} strokeWidth={2.2} />
            )}
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={(v) => {
                setText(v);
                setUeberstimmt(false);
                if (v.length === 0) setRemoved(NOTHING_REMOVED);
              }}
              placeholder={
                diktiert
                  ? 'Ich höre zu …'
                  : // Mit Bild ist Text optional — das muss dastehen, sonst
                    // sucht man nach dem Satz, den man noch schreiben „muss".
                    bilder.length > 0
                    ? 'Noch etwas dazu? (nicht nötig)'
                    : apiKey.length > 0
                      ? 'Was liegt an? Oder frag mich.'
                      : 'Was liegt an?'
              }
              // Eine Einladung, keine Randnotiz — deshalb text2, nicht text3.
              placeholderTextColor={colors.text2}
              returnKeyType="done"
              submitBehavior="submit"
              onFocus={() => {
                // Den ausstehenden Blur abräumen: nach dem Anlegen holt sich
                // das Feld den Fokus sofort zurück, und ohne das hier käme der
                // ALTE Timer danach an und schlösse die Reihe wieder.
                if (blurTimer.current) clearTimeout(blurTimer.current);
                setFokus(true);
              }}
              // Verzögert: ein Tipp auf einen Vorschlag nimmt dem Feld erst den
              // Fokus — ohne die Pause wäre die Reihe weg, bevor der Tipp ankommt.
              onBlur={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                blurTimer.current = setTimeout(() => setFokus(false), 150);
              }}
              onSubmitEditing={() => submit()}
              accessibilityLabel="Schnell hinzufügen"
              style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: 2 }, webNoOutline]}
            />
            {/* Das Mikrofon bleibt IMMER stehen — auch mit Text im Feld. Sonst
                könnte man nur anfangen zu sprechen, aber nichts nachlegen und
                nichts nachsprechen, wenn die Erkennung daneben lag; genau das
                ist beim Diktieren der häufigste Fall. Das Gesagte wird an den
                vorhandenen Stand angehängt. */}
            <MicButton
              size={30}
              onStart={() => {
                diktatBasis.current = text;
              }}
              onText={(transkript) => setText((diktatBasis.current ? `${diktatBasis.current.trimEnd()} ` : '') + transkript)}
              onListeningChange={setDiktiert}
            />
            {etwasZuSenden && (
              <PopIn>
                <PressableScale
                  // Das Symbol verrät VOR dem Tippen, was passieren wird:
                  // Plus = wird angelegt, Funke = der Assistent sieht es an.
                  accessibilityLabel={zeigtLokal ? 'Aufgabe anlegen' : 'An den Assistenten geben'}
                  onPress={() => submit(ueberstimmt)}
                  // Abkürzung für alle, die sie kennen — dieselbe Wirkung wie
                  // der Weg-Chip daneben. Sie kostet keine Fläche und ist NICHT
                  // der einzige Weg; als einziger wäre sie unauffindbar
                  // (v1.53.0/1) und damit falsch.
                  onLongPress={
                    zeigtWegChip
                      ? () => {
                          hapticSelect();
                          setUeberstimmt((v) => !v);
                        }
                      : undefined
                  }
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: R.pill,
                    backgroundColor: colors.teal,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {zeigtLokal ? (
                    <Plus size={17} color="#FFFFFF" strokeWidth={2.6} />
                  ) : (
                    <Sparkles size={16} color="#FFFFFF" strokeWidth={2.4} />
                  )}
                </PressableScale>
              </PopIn>
            )}
          </Glass>
        </View>
      </View>
      {/* Einen Vorschlag zurechtrücken, ohne ihn abzuwählen und neu zu tippen.
          Derselbe Editor wie im Braindump. */}
      {schnellEditor}
    </View>
  );
}
