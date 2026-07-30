// braindump.tsx — alles aus dem Kopf kippen, der Assistent sortiert:
// ein großes Feld, „Sortieren lassen" zerlegt den Wurf in Aufgaben (mit
// erkannten Daten) und Notizen. Vorschläge einzeln abwählbar, EIN Tipp
// übernimmt — nichts wird ohne Bestätigung angelegt. Der Braindump ist
// bewusst KEIN Chat: einmal rein, sortiert, fertig.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BrainCircuit, Camera, CalendarDays, Check, ChevronLeft, Image as ImageIcon, NotebookPen, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { GlassButton } from '@/components/GlassButton';
import { GlassPanel } from '@/components/GlassPanel';
import { InsetField } from '@/components/InsetField';
import { KeyboardDoneBar, keyboardDoneProps } from '@/components/KeyboardDone';
import { MicButton } from '@/components/MicButton';
import { PressableScale } from '@/components/PressableScale';
import { SchluesselWeg } from '@/components/SchluesselWeg';
import { betrifftSchluessel } from '@/lib/schluessel';
import { LoadingState } from '@/components/StateView';
import { LIST_COLORS } from '@/components/listMeta';
import { Type } from '@/components/Type';
import { useCreateAssistantEvents } from '@/data/calendarQueries';
import { useCreateNote } from '@/data/noteQueries';
import { useCompleteTask, useCreateList, useCreateTask, useDeleteTask, useLists, useUpdateTask } from '@/data/queries';
import type { ChatMessage } from '@/data/types';
import { askAssistant, type AssistantImage, buildBraindumpContext, IMAGE_LIMIT, describeExtras, describeSchritte, extractActions, hasCapturableActions, ortZusatz, type AssistantAction } from '@/lib/assistant';
import { ActionEditSheet, type EditTarget } from '@/components/ActionEditSheet';
import { applyAssistantActions } from '@/lib/applyActions';
import { RUN_BRAINDUMP, useAssistantRuns } from '@/lib/assistantRun';
import { assistantCameraAvailable, assistantImagesAvailable, captureAssistantImage, pickAssistantImages } from '@/lib/assistantImage';
import { formatDueDate, parseDateStr, todayStr } from '@/lib/dates';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { useSettings } from '@/theme/settings.store';
import { R, Spacing, T } from '@/theme/theme.tokens';

export default function BraindumpScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const apiKey = useSettings((s) => s.geminiApiKey);
  const memory = useSettings((s) => s.assistantMemory);
  const createTask = useCreateTask();
  const createList = useCreateList();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const createNote = useCreateNote();
  const createEvents = useCreateAssistantEvents();
  const { data: lists } = useLists();
  const today = todayStr();

  // Geteilter Text (iOS-Kurzbefehl → stille://braindump?text=…) füllt das Feld
  // einmalig vor — der Nutzer prüft und lässt sortieren.
  const { text: sharedText } = useLocalSearchParams<{ text?: string }>();
  const [text, setText] = useState('');
  const seeded = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!seeded.current && typeof sharedText === 'string' && sharedText.trim().length > 0) {
      seeded.current = true;
      setText(sharedText);
      // Punkt 6: nach dem Teilen direkt zum Sortier-Knopf rücken.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
    }
  }, [sharedText]);
  // Kommt man zu einem laufenden oder gescheiterten Wurf zurück, steht der
  // abgetippte Text wieder da. Der Bildschirm wird beim Verlassen abgebaut —
  // ohne das ist die Eingabe weg, obwohl der Lauf selbst überlebt hat.
  // Nur EINMAL beim Betreten, damit es niemandem ins Tippen fährt.
  const wiederhergestellt = useRef(false);
  useEffect(() => {
    if (wiederhergestellt.current || seeded.current) return;
    wiederhergestellt.current = true;
    const offen = useAssistantRuns.getState().runs[RUN_BRAINDUMP];
    if (offen && offen.status !== 'done' && offen.input.length > 0) setText(offen.input);
  }, []);
  // Bilder leben nur bis zum nächsten Sortieren — sie werden nirgends abgelegt.
  const [images, setImages] = useState<AssistantImage[]>([]);
  const dictBaseRef = useRef('');
  const [dictating, setDictating] = useState(false);
  // Der Lauf lebt im Store, nicht im Bildschirm — deshalb ueberlebt er das
  // Verlassen des Braindumps (siehe lib/assistantRun.ts).
  const run = useAssistantRuns((s2) => s2.runs[RUN_BRAINDUMP]);
  const beginRun = useAssistantRuns((s2) => s2.begin);
  const deltaRun = useAssistantRuns((s2) => s2.delta);
  const finishRun = useAssistantRuns((s2) => s2.finish);
  const failRun = useAssistantRuns((s2) => s2.fail);
  const clearRun = useAssistantRuns((s2) => s2.clear);
  const pending = run?.status === 'running';
  const error = run?.status === 'error' ? run.error : null;
  const actions = run?.status === 'done' ? run.actions : null;
  // Abwählbare Vorschläge: 'a0', 'a1', … Aufgaben; 't0', … Termine; 'n0', … Notizen.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<string | null>(null);
  // Welcher Vorschlag wird gerade zurechtgerueckt?
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [doneEvents, setDoneEvents] = useState(0);
  const stream = run?.stream ?? '';

  // Punkt 5: Ist der Wurf genau EIN Link, geht er mit einem Tipp als „Notiz mit
  // Link" — ohne Assistent (Notiz-Body rendert die URL tappbar).
  const trimmed = text.trim();
  const isBareUrl = /^https?:\/\/\S+$/.test(trimmed) && !/\s/.test(trimmed);
  const saveUrlAsNote = async () => {
    hapticSuccess();
    await createNote.mutateAsync({ body: trimmed });
    setText('');
    setDoneEvents(0);
    setDone('Als Notiz mit Link gesichert.');
  };

  const addImages = async (neu: Promise<AssistantImage[]>) => {
    const got = await neu;
    if (got.length === 0) return;
    hapticSelect();
    setImages((prev) => [...prev, ...got].slice(0, IMAGE_LIMIT));
  };

  const sort = async () => {
    const dump = text.trim();
    // Ein Foto allein genügt — der Zettel IST die Eingabe.
    if ((!dump && images.length === 0) || pending) return;
    setDone(null);
    setDoneEvents(0);
    beginRun(RUN_BRAINDUMP, 'Braindump', dump);
    try {
      const listNames = (lists ?? []).filter((l) => !l.deletedAt).map((l) => l.name);
      const dateLabel = `${parseDateStr(today).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${today})`;
      const msg: ChatMessage = {
        id: 'dump',
        chatId: 'dump',
        role: 'user',
        content: dump || 'Lies das Foto und mach daraus Aufgaben, Termine und Notizen.',
        createdAt: new Date().toISOString(),
      };
      const answer = await askAssistant(apiKey, [msg], buildBraindumpContext(dateLabel, false, listNames), memory, {
        // Erfassen braucht weder Werkzeuge noch Änderungs-Regeln — der kürzere
        // Prompt kommt schneller zurück. JSON-Zwang macht den Aktions-Block
        // verbindlich, deshalb entfällt der Zweitversuch fast immer. Und das
        // Sortieren selbst ist keine Denkaufgabe: kleines Modell zuerst.
        mode: 'erfassen',
        json: true,
        images,
        onDelta: (delta) => deltaRun(RUN_BRAINDUMP, delta),
      });
      let parsed = extractActions(answer).actions;
      // Manche Modelle vergessen den Block — EIN strikter Zweitversuch, der ihn erzwingt.
      // „aenderungen" kann hier niemand anwenden (kein App-Überblick, keine
      // Handles) — ein Block, der NUR daraus besteht, zählt als leer, sonst
      // stünde da eine Vorschlagskarte ohne Zeilen mit totem Knopf.
      if (parsed && !hasCapturableActions(parsed)) parsed = null;
      if (!parsed) {
        const retry = await askAssistant(apiKey, [msg], buildBraindumpContext(dateLabel, true, listNames), memory, {
          mode: 'erfassen',
          json: true,
          images,
        });
        const zweiter = extractActions(retry).actions;
        parsed = zweiter && hasCapturableActions(zweiter) ? zweiter : null;
      }
      if (!parsed) {
        // Auch der Zweitversuch scheiterte → die Roh-Antwort zeigen statt Sackgasse,
        // damit nichts verloren geht (der Nutzer sieht wenigstens die Einschätzung).
        failRun(
          RUN_BRAINDUMP,
          `Der Assistent konnte es nicht automatisch sortieren. Seine Antwort:\n\n${extractActions(answer).clean}`,
        );
      } else {
        finishRun(RUN_BRAINDUMP, { clean: extractActions(answer).clean, actions: parsed });
        setDeselected(new Set());
      }
    } catch (e) {
      failRun(RUN_BRAINDUMP, e instanceof Error ? e.message : 'Unbekannter Fehler.');
    }
  };

  const toggle = (key: string) => {
    hapticSelect();
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const apply = async () => {
    if (!actions) return;
    hapticSuccess();
    // Anwenden liegt zentral in lib/applyActions — die Reihenfolge (Projekte →
    // Änderungen → Neues) und die Schutzregeln gelten damit überall gleich.
    const gewaehlt: AssistantAction = {
      ...actions,
      listen: actions.listen.filter((_, i) => !deselected.has(`l${i}`)),
      aufgaben: actions.aufgaben.filter((_, i) => !deselected.has(`a${i}`)),
      termine: actions.termine.filter((_, i) => !deselected.has(`t${i}`)),
      notizen: actions.notizen.filter((_, i) => !deselected.has(`n${i}`)),
      // Der Braindump kann keine Änderungen anwenden (keine Handles).
      aenderungen: [],
    };
    // Scheitert eine Mutation, MUSS das sichtbar werden. Vorher lief die
    // Zusage einfach ins Leere: der Knopf tat scheinbar nichts, die Karte blieb
    // stehen, und niemand erfuhr warum (so blieb ein kaputtes SQL acht
    // Releases lang unentdeckt).
    let res;
    try {
      res = await applyAssistantActions(gewaehlt, {
        lists: lists ?? [],
        tasks: [],
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
      failRun(RUN_BRAINDUMP, `Konnte die Vorschläge nicht anlegen: ${e instanceof Error ? e.message : 'Unbekannter Fehler.'}`);
      return;
    }
    clearRun(RUN_BRAINDUMP);
    setText('');
    setImages([]);
    setDoneEvents(res.termine);
    const parts = [
      ...(res.projekte > 0 ? [`${res.projekte} ${res.projekte === 1 ? 'Projekt' : 'Projekte'}`] : []),
      `${res.aufgaben} ${res.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}`,
      ...(res.termine > 0 ? [`${res.termine} ${res.termine === 1 ? 'Termin im Kalender' : 'Termine im Kalender'}`] : []),
      `${res.notizen} ${res.notizen === 1 ? 'Notiz' : 'Notizen'}`,
    ];
    setDone(`${parts.join(', ')} angelegt. Kopf frei.`);
  };

  const selectedCount = actions
    ? actions.listen.length + actions.aufgaben.length + actions.termine.length + actions.notizen.length - deselected.size
    : 0;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop columns={false} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ paddingTop: insets.top + Spacing.sm, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm }}>
              <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
            </PressableScale>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <BrainCircuit size={20} color={colors.teal} strokeWidth={2} />
              <Type variant="heading">Braindump</Type>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            {/* Foto: der Zettel IST die Eingabe. Kamera zuerst — das ist der
                häufigere Fall („liegt vor mir") als die Mediathek. */}
            {!pending && assistantImagesAvailable && images.length < IMAGE_LIMIT && (
              <>
                {assistantCameraAvailable && (
                <PressableScale
                  accessibilityLabel="Zettel abfotografieren"
                  onPress={() => void addImages(captureAssistantImage())}
                  style={{ padding: Spacing.sm }}
                >
                  <Camera size={20} color={colors.text2} strokeWidth={2} />
                </PressableScale>
                )}
                <PressableScale
                  accessibilityLabel="Foto aus der Mediathek"
                  onPress={() => void addImages(pickAssistantImages(IMAGE_LIMIT - images.length))}
                  style={{ padding: Spacing.sm }}
                >
                  <ImageIcon size={20} color={colors.text2} strokeWidth={2} />
                </PressableScale>
              </>
            )}
          {/* Diktat: gesprochenes direkt ins Feld (On-Device). */}
          {!pending && (
            <MicButton
              onStart={() => {
                dictBaseRef.current = text;
              }}
              onText={(transcript) =>
                setText((dictBaseRef.current ? `${dictBaseRef.current.trimEnd()} ` : '') + transcript)
              }
              onListeningChange={setDictating}
            />
          )}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          alwaysBounceVertical
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + Spacing.xl, gap: Spacing.md }}
        >
          <Type variant="caption" tone="text3">
            Kipp alles ab, was im Kopf ist — durcheinander ist okay. Der Assistent macht daraus
            Aufgaben (mit erkannten Daten) und Notizen; du bestätigst, bevor etwas angelegt wird.
          </Type>

          {/* Eingelassen statt umrandet — dieselbe Schreibfläche wie in der
              Abendbetrachtung. Vorher stand hier ein gezeichnetes Rechteck mit
              Haarlinie, im Merkzettel eines mit anderer Füllung: EIN Feld,
              drei Fassungen. */}
          <InsetField radius={R.lg}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder={
                dictating
                  ? 'Ich höre zu … sprich einfach los.'
                  : 'Milch kaufen, morgen Zahnarzt anrufen,\nGeschenkidee für Anna: Kochbuch,\nReifen wechseln vor dem Winter…'
              }
              placeholderTextColor={colors.text3}
              textAlignVertical="top"
              accessibilityLabel="Braindump-Text"
              editable={!pending}
              scrollEnabled={false}
              rejectResponderTermination={false}
              {...keyboardDoneProps}
              style={[
                { minHeight: 150, fontSize: T.md + 1, lineHeight: (T.md + 1) * 1.5, color: colors.text, padding: Spacing.md },
                webNoOutline,
              ]}
            />
          </InsetField>

          {/* Angehängte Bilder: sichtbar und einzeln wieder abnehmbar. Sie
              werden NICHT gespeichert — nur zu dieser einen Anfrage geschickt. */}
          {images.length > 0 && (
            <View style={{ gap: Spacing.xs }}>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                {images.map((img, i) => (
                  <View key={i} style={{ width: 72, height: 72, borderRadius: R.md, overflow: 'hidden' }}>
                    <Image
                      source={{ uri: `data:${img.mimeType};base64,${img.data}` }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                    <PressableScale
                      accessibilityLabel={`Bild ${i + 1} entfernen`}
                      onPress={() => setImages((prev) => prev.filter((_, k) => k !== i))}
                      style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 3 }}
                    >
                      <X size={12} color="#FFFFFF" strokeWidth={2.6} />
                    </PressableScale>
                  </View>
                ))}
              </View>
              <Type variant="caption" tone="text3">
                {images.length === 1 ? 'Ein Bild geht mit' : `${images.length} Bilder gehen mit`} — sie werden
                nur für diese Anfrage gelesen und nicht gespeichert.
              </Type>
            </View>
          )}

          {/* Ist der Wurf genau ein Link, geht er auch ohne Assistent als Notiz. */}
          {isBareUrl && !pending && !actions && (
            <PressableScale
              accessibilityLabel="Als Notiz mit Link sichern"
              onPress={() => void saveUrlAsNote()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
            >
              <NotebookPen size={15} color={colors.teal} strokeWidth={2} />
              <Type variant="label" tone="teal">Als Notiz mit Link sichern</Type>
            </PressableScale>
          )}

          {apiKey.length === 0 ? (
            <Type variant="caption" tone="text3">
              Für den Braindump brauchst du den Assistenten — Schlüssel unter Einstellungen → Assistent.
            </Type>
          ) : (
            <GlassButton accessibilityLabel="Sortieren lassen" onPress={() => void sort()} disabled={(text.trim().length === 0 && images.length === 0) || pending}>
              <BrainCircuit size={17} color="#FFFFFF" strokeWidth={2.2} />
              <Type variant="label" style={{ color: '#FFFFFF' }}>Sortieren lassen</Type>
            </GlassButton>
          )}

          {/* Warten mit Leben: die ersten Worte laufen ein, der Aktions-Block
              (alles ab ```) bleibt verborgen, bis sortiert ist. */}
          {pending &&
            (stream.split('```')[0].trim().length > 0 ? (
              <Type variant="body" tone="text2">{stream.split('```')[0].trim()}</Type>
            ) : (
              <LoadingState label="Assistent sortiert…" />
            ))}
          {error && (
            <View>
              <Type variant="caption" tone="indigo">{error}</Type>
              {/* Ein abgelehnter Schlüssel ist hier besonders bitter: der
                  Braindump ist voll, und der Weg zum Schlüssel darf nicht
                  aus einem Satz bestehen, den man selbst abtippen muss. */}
              {betrifftSchluessel(error) && <SchluesselWeg />}
            </View>
          )}
          {done && (
            <View style={{ gap: Spacing.xs }}>
              <Type variant="label" tone="teal">{done}</Type>
              {doneEvents > 0 && (
                <PressableScale
                  accessibilityLabel="Im Kalender ansehen"
                  onPress={() => router.push('/kalender')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
                >
                  <CalendarDays size={15} color={colors.teal} strokeWidth={2} />
                  <Type variant="label" tone="teal">Im Kalender ansehen</Type>
                </PressableScale>
              )}
            </View>
          )}

          {actions && (
            <GlassPanel>
              <Type variant="eyebrow" tone="teal">Vorschläge — Kästchen wählt ab, Text ändert</Type>
              <View style={{ marginTop: Spacing.sm, gap: 2 }}>
                {/* Projekte stehen oben — sie sind das Dach, unter dem die
                    Aufgaben darunter einsortiert werden. */}
                {actions.listen.map((l, i) => {
                  const off = deselected.has(`l${i}`);
                  return (
                    <PressableScale
                      key={`l${i}`}
                      accessibilityLabel={`Projekt ${l.name} ${off ? 'wieder auswählen' : 'abwählen'}`}
                      onPress={() => toggle(`l${i}`)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 1, opacity: off ? 0.4 : 1 }}
                    >
                      <View style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: off ? colors.border3 : colors.teal, backgroundColor: off ? 'transparent' : colors.teal, alignItems: 'center', justifyContent: 'center' }}>
                        {!off && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Type variant="body" numberOfLines={1}>{l.name}</Type>
                        {(l.ziel || l.deadline) && (
                          <Type variant="caption" tone="text3" numberOfLines={1}>
                            {[l.ziel ?? '', l.deadline ? `bis ${formatDueDate(l.deadline, today)}` : ''].filter(Boolean).join(' · ')}
                          </Type>
                        )}
                      </View>
                      <Type variant="caption" tone="text3">Projekt</Type>
                    </PressableScale>
                  );
                })}
                {actions.aufgaben.map((a, i) => {
                  const off = deselected.has(`a${i}`);
                  return (
                    <View
                      key={`a${i}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 1, opacity: off ? 0.4 : 1 }}
                    >
                      <PressableScale
                        accessibilityLabel={`Aufgabe ${a.titel} ${off ? 'wieder auswählen' : 'abwählen'}`}
                        onPress={() => toggle(`a${i}`)}
                        style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: off ? colors.border3 : colors.teal, backgroundColor: off ? 'transparent' : colors.teal, alignItems: 'center', justifyContent: 'center' }}
                      >
                        {!off && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </PressableScale>
                      <PressableScale
                        accessibilityLabel={`Aufgabe ${a.titel} ändern`}
                        onPress={() => {
                          hapticSelect();
                          setEdit({ kind: 'aufgabe', index: i });
                        }}
                        pressedScale={0.99}
                        style={{ flex: 1 }}
                      >
                        <Type variant="body" numberOfLines={1}>{a.titel}</Type>
                        {(a.datum || a.zeit || a.liste) && (
                          <Type variant="caption" tone="text3" tabular>
                            {[a.datum ? formatDueDate(a.datum, today) : '', a.zeit ?? '', a.liste ? `→ ${a.liste}` : '']
                              .filter(Boolean)
                              .join(' · ')}
                          </Type>
                        )}
                        {/* Die Checkliste sichtbar machen: du sollst vor dem
                            Übernehmen sehen, dass EINE Aufgabe entsteht. */}
                        {describeSchritte(a.schritte) && (
                          <Type variant="caption" tone="text3" numberOfLines={2}>{describeSchritte(a.schritte)}</Type>
                        )}
                        {describeExtras(a) && (
                          <Type variant="caption" tone="text3" numberOfLines={1}>{describeExtras(a)}</Type>
                        )}
                      </PressableScale>
                      <Type variant="caption" tone="text3">Aufgabe</Type>
                    </View>
                  );
                })}
                {actions.termine.map((t, i) => {
                  const off = deselected.has(`t${i}`);
                  return (
                    <View
                      key={`t${i}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 1, opacity: off ? 0.4 : 1 }}
                    >
                      <PressableScale
                        accessibilityLabel={`Termin ${t.titel} ${off ? 'wieder auswählen' : 'abwählen'}`}
                        onPress={() => toggle(`t${i}`)}
                        style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: off ? colors.border3 : colors.teal, backgroundColor: off ? 'transparent' : colors.teal, alignItems: 'center', justifyContent: 'center' }}>
                        {!off && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </PressableScale>
                      <PressableScale
                        accessibilityLabel={`Termin ${t.titel} ändern`}
                        onPress={() => {
                          hapticSelect();
                          setEdit({ kind: 'termin', index: i });
                        }}
                        pressedScale={0.99}
                        style={{ flex: 1 }}
                      >
                        <Type variant="body" numberOfLines={1}>{t.titel}</Type>
                        <Type variant="caption" tone="text3" tabular>
                          {formatDueDate(t.datum, today)}{t.start ? ` · ${t.start}${t.ende ? `–${t.ende}` : ''}` : ' · ganztägig'}{ortZusatz(t)}
                        </Type>
                      </PressableScale>
                      <Type variant="caption" tone="text3">Termin</Type>
                    </View>
                  );
                })}
                {actions.notizen.map((n, i) => {
                  const off = deselected.has(`n${i}`);
                  return (
                    <View
                      key={`n${i}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 1, opacity: off ? 0.4 : 1 }}
                    >
                      <PressableScale
                        accessibilityLabel={`Notiz ${n.split('\n')[0]} ${off ? 'wieder auswählen' : 'abwählen'}`}
                        onPress={() => toggle(`n${i}`)}
                        style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: off ? colors.border3 : colors.teal, backgroundColor: off ? 'transparent' : colors.teal, alignItems: 'center', justifyContent: 'center' }}
                      >
                        {!off && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </PressableScale>
                      <PressableScale
                        accessibilityLabel={`Notiz ${n.split('\n')[0]} ändern`}
                        onPress={() => {
                          hapticSelect();
                          setEdit({ kind: 'notiz', index: i });
                        }}
                        pressedScale={0.99}
                        style={{ flex: 1 }}
                      >
                        <Type variant="body" numberOfLines={1}>{n.split('\n')[0]}</Type>
                        {n.includes('\n') && <Type variant="caption" tone="text3" numberOfLines={1}>{n.split('\n').slice(1).join(' · ')}</Type>}
                      </PressableScale>
                      <Type variant="caption" tone="text3">Notiz</Type>
                    </View>
                  );
                })}
              </View>
              <GlassButton
                accessibilityLabel="Auswahl übernehmen"
                onPress={() => void apply()}
                disabled={selectedCount === 0}
                style={{ marginTop: Spacing.md }}
              >
                <Type variant="label" style={{ color: '#FFFFFF' }}>
                  {selectedCount === 1 ? '1 Vorschlag übernehmen' : `${selectedCount} Vorschläge übernehmen`}
                </Type>
              </GlassButton>
            </GlassPanel>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Einen Vorschlag zurechtruecken, ohne ihn abzuwaehlen und neu anzulegen. */}
      {edit && actions && (
        <ActionEditSheet
          target={edit}
          actions={actions}
          lists={lists ?? []}
          onClose={() => setEdit(null)}
          onSave={(next) => finishRun(RUN_BRAINDUMP, { clean: run?.clean ?? '', actions: next })}
        />
      )}
      <KeyboardDoneBar />
    </View>
  );
}
