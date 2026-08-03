// TaskEditorSheet.tsx — Aufgaben-Editor als Glass-Bottom-Sheet (Fahrplan §4).
// Aufbau nach iOS-Muster: Titel + Notiz immer sichtbar, darunter kompakte
// Detail-Zeilen (Liste / Fällig / Wiederholung / Flagge) mit aktuellem Wert,
// die erst beim Antippen ihre Chips aufklappen — keine Chip-Wand. Der
// Primär-Button sitzt fest im Sheet-Footer. Löschen zweistufig.
import { CalendarDays, CalendarX2, Clock, Flag, ListChecks, type LucideIcon, Minus, PauseCircle, Plus, Repeat, Tag as TagIcon, Trash2, UserRound, X, Hourglass, Moon } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { DisclosureChevron } from '@/components/DisclosureChevron';
import { Chip } from '@/components/Chip';
import { GlassButton } from '@/components/GlassButton';
import { KeyboardDoneBar, keyboardDoneProps } from '@/components/KeyboardDone';
import { LinkedChats } from '@/components/LinkedChats';
import { LinkedNotes } from '@/components/LinkedNotes';
import { listIcon } from '@/components/listMeta';
import { Seam } from '@/components/Seam';
import { MiniCalendar } from '@/components/MiniCalendar';
import { PersonWahl } from '@/components/PersonWahl';
import { PressableScale } from '@/components/PressableScale';
import { Expanded, Group, RowDivider } from '@/components/SheetParts';
import { TaskCheck } from '@/components/TaskCheck';
import { TimeField } from '@/components/TimeField';
import { Type } from '@/components/Type';
import { usePeople } from '@/data/personQueries';
import { useCreateTask, useDeleteTask, useLists, useTasks, useUpdateTask } from '@/data/queries';
import type { Rrule, RruleUnit, Subtask, Task } from '@/data/types';
import { newId, normalizeTag } from '@/data/types';
import { addMonths, anchorWeekdayRrule, buildRrule, buildWeekdayRrule, formatDueDate, isWeekdayRule, rruleLabel, rruleParts, todayStr, weekdaysOf, WEEKDAY_ORDER, WEEKDAY_SHORT } from '@/lib/dates';
import { tagCounts } from '@/lib/taskFilters';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { useSettings } from '@/theme/settings.store';
import { R, Spacing, T } from '@/theme/theme.tokens';

const UNITS: { value: RruleUnit; label: string }[] = [
  { value: 'd', label: 'Tage' },
  { value: 'w', label: 'Wochen' },
  { value: 'm', label: 'Monate' },
  { value: 'y', label: 'Jahre' },
];
// Serienende, relativ gerechnet — kein Datumswähler nötig.
const ENDS: { label: string; months: number | null }[] = [
  { label: 'Ohne Ende', months: null },
  { label: 'Nach 1 Monat', months: 1 },
  { label: 'Nach 3 Monaten', months: 3 },
  { label: 'Nach 1 Jahr', months: 12 },
];

type Section = 'list' | 'due' | 'repeat' | 'span' | 'waiting' | 'person';

export function TaskEditorSheet({
  task,
  defaultListId,
  defaultDueDate,
  defaultTitle,
  onClose,
  onSaved,
}: {
  /** null = neue Aufgabe. */
  task: Task | null;
  defaultListId?: string;
  defaultDueDate?: string | null;
  /**
   * Starttitel für eine NEUE Aufgabe — das, was schon in der EINEN Zeile
   * stand, als der ausführliche Weg aufgerufen wurde. Damit sind die beiden
   * Wege keine Konkurrenz, sondern eine Steigerung: unten anfangen, oben
   * weitermachen. Beim BEARBEITEN wirkungslos (der Titel gehört der Aufgabe).
   */
  defaultTitle?: string;
  onClose: () => void;
  /** Wurde wirklich etwas angelegt/gesichert? Erst dann darf der Aufrufer die
   *  Zeile leeren — bei „abbrechen" bleibt der Entwurf, wo er war. */
  onSaved?: () => void;
}) {
  const colors = useColors();
  const today = todayStr();
  const { data: lists } = useLists();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const defaultDueTime = useSettings((s) => s.defaultDueTime);

  const [title, setTitle] = useState(task?.title ?? defaultTitle ?? '');
  const [note, setNote] = useState(task?.note ?? '');
  const [listId, setListId] = useState(task?.listId ?? defaultListId ?? lists?.[0]?.id ?? 'default');
  const [dueDate, setDueDate] = useState<string | null>(task?.dueDate ?? defaultDueDate ?? null);
  const [dueTime, setDueTime] = useState<string | null>(task?.dueTime ?? null);
  const [rrule, setRrule] = useState<Rrule | null>(task?.rrule ?? null);
  const [rruleUntil, setRruleUntil] = useState<string | null>(task?.rruleUntil ?? null);
  const [evening, setEvening] = useState<boolean>(task?.evening ?? false);
  const [startDate, setStartDate] = useState<string | null>(task?.startDate ?? null);
  const [waiting, setWaiting] = useState<boolean>(task?.waiting ?? false);
  const [waitingFor, setWaitingFor] = useState(task?.waitingFor ?? '');
  const [personId, setPersonId] = useState<string | null>(task?.personId ?? null);
  const [expiresOn, setExpiresOn] = useState<string | null>(task?.expiresOn ?? null);
  // Bausteine des Satzes „Alle [n] [Einheit], gezählt ab [Fälligkeit|Erledigen]".
  // Startwerte aus einer bestehenden Regel; 'weekdays' hat keine → Vorgabe.
  const initialParts = rruleParts(task?.rrule ?? null);
  const [count, setCount] = useState(String(initialParts?.n ?? 1));
  const [unit, setUnit] = useState<RruleUnit>(initialParts?.unit ?? 'w');
  const [afterDone, setAfterDone] = useState(initialParts?.after ?? false);
  /** Übernimmt die Bausteine in die Regel (n wird beim Bauen geklemmt). */
  const applyParts = (n: string, u: RruleUnit, after: boolean) => {
    setCount(n);
    setUnit(u);
    setAfterDone(after);
    setRrule(buildRrule(Number(n), u, after));
  };
  const [flagged, setFlagged] = useState(task?.flagged ?? false);
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [subDraft, setSubDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Neue Aufgabe: Fällig direkt offen (häufigste Aktion); Bearbeiten: alles kompakt.
  const [section, setSection] = useState<Section | null>(task === null ? 'due' : null);

  const canSave = title.trim().length > 0;
  const isEdit = task !== null;
  const hasAssistantKey = useSettings((s) => s.geminiApiKey.length > 0);

  const toggleSection = (s: Section) => {
    hapticSelect();
    setSection((cur) => (cur === s ? null : s));
  };

  // Uhrzeit an/aus: an → Standard-Uhrzeit (Datum notfalls heute), aus → keine.
  const toggleTime = () => {
    hapticSelect();
    if (dueTime !== null) {
      setDueTime(null);
    } else {
      if (!dueDate) setDueDate(today);
      setDueTime(defaultDueTime);
    }
  };

  const currentList = useMemo(() => (lists ?? []).find((l) => l.id === listId), [lists, listId]);
  const { data: people } = usePeople();
  const currentPerson = useMemo(() => (people ?? []).find((p) => p.id === personId), [people, personId]);
  const personLabel = currentPerson ? currentPerson.name : 'Niemand';
  // Kurzform für die zugeklappte Zeile — die ausführliche Beschriftung steht
  // an der Aufgabe selbst (taskLogic.waitingLabel).
  const waitingLabelKurz = !waiting ? 'Nein' : waitingFor.trim() ? waitingFor.trim() : 'Ja';

  const dueLabel = dueDate ? formatDueDate(dueDate, today) + (dueTime ? `, ${dueTime}` : '') : 'Kein Datum';
  // Beschriftung der Lebensspanne: „ab …", „bis …" oder beides.
  const spanLabel = startDate
    ? expiresOn
      ? `${formatDueDate(startDate, today)} – ${formatDueDate(expiresOn, today)}`
      : `ab ${formatDueDate(startDate, today)}`
    : expiresOn
      ? `bis ${formatDueDate(expiresOn, today)}`
      : 'Immer';

  // Tag-Vorschläge aus dem Bestand (die noch nicht gewählt sind).
  const { data: allTasks } = useTasks();
  const suggestions = useMemo(
    () => tagCounts(allTasks ?? []).map((t) => t.tag).filter((t) => !tags.includes(t)).slice(0, 6),
    [allTasks, tags],
  );

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
    setTagDraft('');
  };
  const addSubtask = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setSubtasks((prev) => [...prev, { id: newId(), title: t, done: false }]);
    setSubDraft('');
  };

  const save = () => {
    if (!canSave) return;
    // Nur gültige Uhrzeiten übernehmen — halbe Eingaben („9:3", Text) verfallen.
    const validTime = dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : null;
    // Uhrzeit ohne Datum → heute; Wiederholung braucht ein Datum. Bei festen
    // Wochentagen rückt das ABGELEITETE Datum auf den nächsten gewählten Tag —
    // ein selbst ausgesuchtes Datum bleibt unangetastet.
    const finalDate = dueDate ?? (validTime || rrule ? anchorWeekdayRrule(today, rrule) : null);
    // Offener Entwurf im Eingabefeld nicht verschlucken.
    const finalTags = tagDraft.trim() ? [...tags, normalizeTag(tagDraft)].filter((v, i, a) => v && a.indexOf(v) === i) : tags;
    const finalSubs = subDraft.trim() ? [...subtasks, { id: newId(), title: subDraft.trim(), done: false }] : subtasks;
    const payload = {
      title: title.trim(),
      note: note.trim() ? note.trim() : null,
      listId,
      dueDate: finalDate,
      dueTime: finalDate ? validTime : null,
      startDate,
      expiresOn,
      // Mit Uhrzeit hat die Aufgabe ihren Platz — dann ist „Abends" gegenstandslos.
      evening: dueTime === null ? evening : false,
      waiting,
      // Der Text ist rein beschreibend — ohne Wartezustand hat er keinen Sinn
      // und würde beim nächsten Öffnen einen Zustand vortäuschen.
      waitingFor: waiting && waitingFor.trim() ? waitingFor.trim() : null,
      personId,
      rrule: finalDate ? rrule : null,
      rruleUntil: finalDate && rrule ? rruleUntil : null,
      flagged,
      tags: finalTags,
      subtasks: finalSubs,
    };
    if (isEdit) {
      updateTask.mutate({ id: task.id, patch: payload });
    } else {
      createTask.mutate(payload);
      hapticSuccess();
    }
    onSaved?.();
    onClose();
  };

  const footer = (
    <View>
      <GlassButton accessibilityLabel={isEdit ? 'Änderungen sichern' : 'Aufgabe hinzufügen'} onPress={save} disabled={!canSave}>
        <Type variant="label" style={{ color: '#FFFFFF' }}>{isEdit ? 'Sichern' : 'Hinzufügen'}</Type>
      </GlassButton>
      {isEdit && (
        <PressableScale
          accessibilityLabel={confirmDelete ? 'Löschen bestätigen' : 'Aufgabe löschen'}
          onPress={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            deleteTask.mutate(task.id);
            onClose();
          }}
          style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, marginTop: Spacing.xs }}
        >
          <Trash2 size={15} color={confirmDelete ? colors.indigo : colors.text3} strokeWidth={2} />
          <Type variant="label" tone={confirmDelete ? 'indigo' : 'text3'}>
            {confirmDelete ? 'In den Papierkorb? Tippe erneut.' : 'Löschen'}
          </Type>
        </PressableScale>
      )}
    </View>
  );

  const ListIcon = currentList ? listIcon(currentList.icon) : undefined;

  return (
    <BottomSheet visible title={isEdit ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} onClose={onClose} footer={footer}>
      {/* Titel */}
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Was liegt an?"
        placeholderTextColor={colors.text3}
        autoFocus={!isEdit}
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="Titel"
        style={[
          { fontSize: T.xl, fontWeight: '600', color: colors.text, paddingVertical: Spacing.sm },
          webNoOutline,
        ]}
      />
      {/* Notiz */}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Notiz"
        placeholderTextColor={colors.text3}
        multiline
        accessibilityLabel="Notiz"
        {...keyboardDoneProps}
        style={[
          { fontSize: T.md, color: colors.text2, paddingVertical: Spacing.sm, marginBottom: Spacing.sm, minHeight: 36 },
          webNoOutline,
        ]}
      />

      {/* Unteraufgaben — Checkliste innerhalb der Aufgabe. */}
      <View style={{ gap: Spacing.xs, marginBottom: Spacing.sm }}>
        {subtasks.map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <TaskCheck
              checked={s.done}
              accessibilityLabel={`${s.title} ${s.done ? 'wieder öffnen' : 'erledigen'}`}
              onToggle={(next) => setSubtasks((prev) => prev.map((x) => (x.id === s.id ? { ...x, done: next } : x)))}
            />
            <Type variant="body" tone={s.done ? 'text3' : 'text'} style={{ flex: 1, textDecorationLine: s.done ? 'line-through' : 'none' }}>
              {s.title}
            </Type>
            <PressableScale
              accessibilityLabel={`Schritt „${s.title}" entfernen`}
              onPress={() => setSubtasks((prev) => prev.filter((x) => x.id !== s.id))}
              style={{ padding: Spacing.xs }}
            >
              <X size={15} color={colors.text3} strokeWidth={2} />
            </PressableScale>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <ListChecks size={18} color={colors.text3} strokeWidth={2} />
          <TextInput
            value={subDraft}
            onChangeText={setSubDraft}
            placeholder="Schritt hinzufügen"
            placeholderTextColor={colors.text3}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={() => addSubtask(subDraft)}
            accessibilityLabel="Schritt hinzufügen"
            style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: Spacing.xs }, webNoOutline]}
          />
          {subDraft.trim().length > 0 && (
            <PressableScale accessibilityLabel="Schritt übernehmen" onPress={() => addSubtask(subDraft)} style={{ padding: Spacing.xs }}>
              <Plus size={18} color={colors.teal} strokeWidth={2.4} />
            </PressableScale>
          )}
        </View>
      </View>
      {/* Gruppierte Detail-Zeilen — iOS-Grouped-Look statt frei schwebender Zeilen. */}
      <Group>
        {(lists?.length ?? 0) > 1 && (
          <>
            <DetailRow
              icon={ListIcon ?? CalendarDays}
              iconColor={currentList?.color ?? colors.text3}
              label="Liste"
              value={currentList?.name ?? '—'}
              valueTone="text2"
              expanded={section === 'list'}
              onPress={() => toggleSection('list')}
            />
            {section === 'list' && (
              <Expanded>
                <ChipWrap>
                  {(lists ?? []).map((l) => (
                    <Chip key={l.id} label={l.name} active={listId === l.id} onPress={() => setListId(l.id)} />
                  ))}
                </ChipWrap>
              </Expanded>
            )}
            <RowDivider />
          </>
        )}

        {/* Fällig: Datum + Uhrzeit gemeinsam (gehören zusammen). */}
        <DetailRow
          icon={CalendarDays}
          iconColor={dueDate ? colors.teal : colors.text3}
          label="Fällig"
          value={dueLabel}
          valueTone={dueDate ? 'teal' : 'text3'}
          expanded={section === 'due'}
          onPress={() => toggleSection('due')}
        />
        {section === 'due' && (
          <Expanded>
            <View style={{ gap: Spacing.md }}>
              {/* Datum direkt im Kalender antippen — keine Schnell-Chips. */}
              <View style={{ borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.bg2, padding: Spacing.sm }}>
                <MiniCalendar selected={dueDate} onSelect={setDueDate} />
              </View>

              {/* Uhrzeit: Schalter + natives Rad (statt Presets). */}
              <View style={{ gap: Spacing.sm }}>
                <PressableScale
                  accessibilityRole="switch"
                  accessibilityState={{ checked: dueTime !== null }}
                  accessibilityLabel={dueTime !== null ? 'Uhrzeit entfernen' : 'Uhrzeit hinzufügen'}
                  onPress={toggleTime}
                  pressedScale={0.99}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs }}
                >
                  <Clock size={18} color={dueTime !== null ? colors.teal : colors.text3} strokeWidth={2} />
                  <Type variant="body" style={{ flex: 1 }}>Uhrzeit</Type>
                  <Type variant="label" tone={dueTime !== null ? 'teal' : 'text3'}>{dueTime !== null ? 'An' : 'Aus'}</Type>
                </PressableScale>
                {dueTime !== null && (
                  <TimeField value={dueTime} onChange={setDueTime} accessibilityLabel="Uhrzeit wählen" />
                )}
                {/* Ohne Uhrzeit: gehört es in den Tag oder in den Abend? */}
                {dueTime === null && (
                  <PressableScale
                    accessibilityRole="switch"
                    accessibilityState={{ checked: evening }}
                    accessibilityLabel={evening ? 'Nicht mehr für den Abend' : 'Für den Abend'}
                    onPress={() => {
                      hapticSelect();
                      setEvening((v) => !v);
                    }}
                    pressedScale={0.99}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs }}
                  >
                    <Moon size={18} color={evening ? colors.teal : colors.text3} strokeWidth={2} />
                    <Type variant="body" style={{ flex: 1 }}>Abends</Type>
                    <Type variant="label" tone={evening ? 'teal' : 'text3'}>{evening ? 'An' : 'Aus'}</Type>
                  </PressableScale>
                )}
              </View>

              {/* Datum wieder entfernen (dezenter Text-Link statt Chip). */}
              {dueDate && (
                <PressableScale
                  accessibilityLabel="Datum entfernen"
                  onPress={() => {
                    hapticSelect();
                    setDueDate(null);
                    setDueTime(null);
                    setRrule(null);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs }}
                >
                  <CalendarX2 size={15} color={colors.text3} strokeWidth={2} />
                  <Type variant="label" tone="text3">Datum entfernen</Type>
                </PressableScale>
              )}
            </View>
          </Expanded>
        )}
        <RowDivider />

        {/* Lebensspanne — ab wann sie auftaucht, bis wann sie Sinn hat.
            Zusammen in EINER Zeile: es sind die zwei Enden derselben Sache,
            und getrennt wären es zwei Zeilen, die fast nie beide benutzt werden. */}
        <DetailRow
          icon={Hourglass}
          iconColor={startDate || expiresOn ? colors.teal : colors.text3}
          label="Zeitraum"
          value={spanLabel}
          valueTone={startDate || expiresOn ? 'teal' : 'text3'}
          expanded={section === 'span'}
          onPress={() => toggleSection('span')}
        />
        {section === 'span' && (
          <Expanded>
            <View style={{ gap: Spacing.md }}>
              <View style={{ gap: Spacing.xs }}>
                <Type variant="label" tone="text2">Zeig sie mir ab</Type>
                <Type variant="caption" tone="text3">
                  Vorher liegt sie nicht im Weg — sie ist da, nur nicht jetzt.
                </Type>
                <View style={{ borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.bg2, padding: Spacing.sm }}>
                  <MiniCalendar selected={startDate} onSelect={setStartDate} />
                </View>
                {startDate && (
                  <PressableScale
                    accessibilityLabel="Startdatum entfernen"
                    onPress={() => {
                      hapticSelect();
                      setStartDate(null);
                    }}
                    style={{ alignSelf: 'center', paddingVertical: Spacing.xs }}
                  >
                    <Type variant="label" tone="text3">Startdatum entfernen</Type>
                  </PressableScale>
                )}
              </View>

              <Seam />

              <View style={{ gap: Spacing.xs }}>
                <Type variant="label" tone="text2">Danach ist sie gegenstandslos</Type>
                <Type variant="caption" tone="text3">
                  Nicht überfällig, sondern erledigt durch Zeitablauf — Karten fürs
                  Konzert kauft man danach nicht mehr.
                </Type>
                <View style={{ borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.bg2, padding: Spacing.sm }}>
                  <MiniCalendar selected={expiresOn} onSelect={setExpiresOn} />
                </View>
                {expiresOn && (
                  <PressableScale
                    accessibilityLabel="Verfallsdatum entfernen"
                    onPress={() => {
                      hapticSelect();
                      setExpiresOn(null);
                    }}
                    style={{ alignSelf: 'center', paddingVertical: Spacing.xs }}
                  >
                    <Type variant="label" tone="text3">Verfallsdatum entfernen</Type>
                  </PressableScale>
                )}
              </View>
            </View>
          </Expanded>
        )}

        <RowDivider />

        {/* An wem hängt das? Steht VOR „Warten auf", weil das Warten meistens
            auf genau diesen Menschen zeigt — und weil die Person auch ohne
            Warten trägt („mit Anna wegen Urlaub reden"). */}
        <DetailRow
          icon={UserRound}
          iconColor={personId ? colors.teal : colors.text3}
          label="Mensch"
          value={personLabel}
          valueTone={personId ? 'teal' : 'text3'}
          expanded={section === 'person'}
          onPress={() => toggleSection('person')}
        />
        {section === 'person' && (
          <Expanded>
            <View style={{ gap: Spacing.xs }}>
              <Type variant="caption" tone="text3">
                Wer hat damit zu tun? Alles zu einem Menschen steht danach an einem Ort.
              </Type>
              <PersonWahl selected={personId} onSelect={setPersonId} />
            </View>
          </Expanded>
        )}

        <RowDivider />

        {/* Warten auf — die Aufgabe liegt bei jemand anderem. */}
        <DetailRow
          icon={PauseCircle}
          iconColor={waiting ? colors.teal : colors.text3}
          label="Warten auf"
          value={waitingLabelKurz}
          valueTone={waiting ? 'teal' : 'text3'}
          expanded={section === 'waiting'}
          onPress={() => toggleSection('waiting')}
        />
        {section === 'waiting' && (
          <Expanded>
            <View style={{ gap: Spacing.sm }}>
              <Type variant="caption" tone="text3">
                Liegt bei jemand anderem: verschwindet aus „Heute" und aus dem
                Überfällig-Stapel, bleibt aber im Projekt, in der Suche und in
                der eigenen Ansicht. Es mahnt nichts.
              </Type>
              <PressableScale
                accessibilityRole="switch"
                accessibilityState={{ checked: waiting }}
                accessibilityLabel={waiting ? 'Nicht mehr warten' : 'Auf jemanden warten'}
                onPress={() => {
                  hapticSelect();
                  setWaiting((v) => !v);
                }}
                pressedScale={0.99}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs }}
              >
                <PauseCircle size={18} color={waiting ? colors.teal : colors.text3} strokeWidth={2} />
                <Type variant="body" style={{ flex: 1 }}>Ich warte darauf</Type>
                <Type variant="label" tone={waiting ? 'teal' : 'text3'}>{waiting ? 'An' : 'Aus'}</Type>
              </PressableScale>
              {waiting && (
                <TextInput
                  accessibilityLabel="Worauf gewartet wird"
                  value={waitingFor}
                  onChangeText={setWaitingFor}
                  placeholder="Worauf? (z. B. Angebot, Rückruf)"
                  placeholderTextColor={colors.text3}
                  style={[
                    { fontSize: T.md, color: colors.text, borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.bg2, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
                    webNoOutline,
                  ]}
                />
              )}
            </View>
          </Expanded>
        )}

        <RowDivider />

        {/* Wiederholung */}
        <DetailRow
          icon={Repeat}
          iconColor={rrule ? colors.teal : colors.text3}
          label="Wiederholung"
          value={rrule ? rruleLabel(rrule) + (rruleUntil ? ' · endet' : '') : 'Nie'}
          valueTone={rrule ? 'teal' : 'text3'}
          expanded={section === 'repeat'}
          onPress={() => toggleSection('repeat')}
        />
        {section === 'repeat' && (
          <Expanded>
            {/* Ein Satz statt einer Chip-Liste: „Alle [n] [Einheit]" — damit ist
                JEDER Zeitraum möglich, nicht nur vorgedachte. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Type variant="body" tone="text2">Alle</Type>
              <PressableScale
                accessibilityLabel="Weniger"
                onPress={() => applyParts(String(Math.max(1, Number(count) - 1)), unit, afterDone)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}
              >
                <Minus size={16} color={colors.text2} strokeWidth={2.4} />
              </PressableScale>
              <TextInput
                value={count}
                onChangeText={(t) => applyParts(t.replace(/[^0-9]/g, '').slice(0, 3), unit, afterDone)}
                keyboardType="number-pad"
                accessibilityLabel="Anzahl"
                selectTextOnFocus
                {...keyboardDoneProps}
                style={[
                  { width: 56, textAlign: 'center', paddingVertical: 6, borderRadius: R.md, backgroundColor: colors.chip, color: colors.text, fontSize: T.md, fontVariant: ['tabular-nums'] },
                  webNoOutline,
                ]}
              />
              <PressableScale
                accessibilityLabel="Mehr"
                onPress={() => applyParts(String(Math.min(999, Number(count) + 1)), unit, afterDone)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={16} color={colors.text2} strokeWidth={2.4} />
              </PressableScale>
            </View>
            <ChipWrap>
              {UNITS.map((u) => (
                <Chip
                  key={u.value}
                  label={u.label}
                  active={rrule !== null && !isWeekdayRule(rrule) && unit === u.value}
                  onPress={() => applyParts(count, u.value, afterDone)}
                />
              ))}
            </ChipWrap>

            {/* Der eigentliche Unterschied — in einem Satz erklärt. */}
            <Type variant="eyebrow" tone="text3" style={{ marginTop: Spacing.md, marginBottom: Spacing.xs }}>Gezählt ab</Type>
            <ChipWrap>
              <Chip
                label="Fälligkeit"
                active={rrule !== null && !isWeekdayRule(rrule) && !afterDone}
                onPress={() => applyParts(count, unit, false)}
              />
              <Chip
                label="Erledigen"
                active={afterDone}
                onPress={() => applyParts(count, unit, true)}
              />
            </ChipWrap>
            <Type variant="caption" tone="text3" style={{ marginTop: Spacing.xs }}>
              {afterDone
                ? 'Der nächste Termin zählt ab dem Tag, an dem du abhakst.'
                : 'Der nächste Termin folgt dem Kalender, unabhängig vom Abhaken.'}
            </Type>

            {/* Feste Tage: „jeden Montag und Donnerstag" lässt sich als „alle n
                Wochen" nicht ausdrücken. Mo–Fr ergibt automatisch das
                bestehende Preset „Werktags" (buildWeekdayRrule) — deshalb
                braucht es dafür keinen eigenen Knopf mehr. */}
            <Type variant="eyebrow" tone="text3" style={{ marginTop: Spacing.md, marginBottom: Spacing.xs }}>An festen Tagen</Type>
            <ChipWrap>
              {WEEKDAY_ORDER.map((tag) => {
                const gewaehlt = weekdaysOf(rrule);
                const an = gewaehlt.includes(tag);
                return (
                  <Chip
                    key={tag}
                    label={WEEKDAY_SHORT[tag]}
                    active={an}
                    onPress={() => {
                      const naechste = an ? gewaehlt.filter((t) => t !== tag) : [...gewaehlt, tag];
                      const gebaut = buildWeekdayRrule(naechste);
                      setRrule(gebaut);
                      if (!gebaut) setRruleUntil(null);
                    }}
                  />
                );
              })}
            </ChipWrap>

            <Type variant="eyebrow" tone="text3" style={{ marginTop: Spacing.md, marginBottom: Spacing.xs }}>Sonderfall</Type>
            <ChipWrap>
              <Chip label="Nie" active={rrule === null} onPress={() => { setRrule(null); setRruleUntil(null); }} />
            </ChipWrap>

            {rrule && (
              <>
                <Type variant="eyebrow" tone="text3" style={{ marginTop: Spacing.md, marginBottom: Spacing.xs }}>Endet</Type>
                <ChipWrap>
                  {ENDS.map((e) => {
                    const date = e.months === null ? null : addMonths(today, e.months);
                    const active = e.months === null ? rruleUntil === null : rruleUntil === date;
                    return <Chip key={e.label} label={e.label} active={active} onPress={() => setRruleUntil(date)} />;
                  })}
                </ChipWrap>
              </>
            )}
          </Expanded>
        )}
        <RowDivider />

        {/* Flagge: direkter Schalter, kein Aufklappen nötig. */}
        <PressableScale
          accessibilityRole="switch"
          accessibilityState={{ checked: flagged }}
          accessibilityLabel={flagged ? 'Flagge entfernen' : 'Flagge setzen'}
          onPress={() => {
            hapticSelect();
            setFlagged((v) => !v);
          }}
          pressedScale={0.99}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
        >
          <Flag
            size={18}
            color={flagged ? colors.indigo : colors.text3}
            fill={flagged ? colors.indigo : 'transparent'}
            strokeWidth={2}
          />
          <Type variant="body" style={{ flex: 1 }}>Flagge</Type>
          <Type variant="label" tone={flagged ? 'indigo' : 'text3'}>{flagged ? 'Gesetzt' : 'Aus'}</Type>
        </PressableScale>
      </Group>

      {/* Tags — kontextübergreifend, per Eingabe + Vorschläge. */}
      <View style={{ gap: Spacing.sm, paddingTop: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <TagIcon size={18} color={colors.text3} strokeWidth={2} />
          <TextInput
            value={tagDraft}
            onChangeText={(v) => setTagDraft(v.replace(/\s/g, ''))}
            placeholder="Tag hinzufügen"
            placeholderTextColor={colors.text3}
            autoCapitalize="none"
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={() => addTag(tagDraft)}
            accessibilityLabel="Tag hinzufügen"
            style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: Spacing.xs }, webNoOutline]}
          />
        </View>
        {(tags.length > 0 || suggestions.length > 0) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
            {tags.map((t) => (
              <Chip key={t} label={`#${t} ✕`} active accessibilityLabel={`Tag ${t} entfernen`} onPress={() => setTags((prev) => prev.filter((x) => x !== t))} />
            ))}
            {suggestions.map((t) => (
              <Chip key={t} label={`#${t}`} accessibilityLabel={`Tag ${t} hinzufügen`} onPress={() => addTag(t)} />
            ))}
          </View>
        )}
      </View>

      {/* Verknüpfte Notizen — nur im Bearbeiten-Modus (neue Aufgaben haben noch keine ID). */}
      {isEdit && task && (
        <View style={{ paddingTop: Spacing.lg }}>
          <LinkedNotes taskId={task.id} onNavigate={onClose} />
        </View>
      )}

      {/* Assistent mit Live-Zugriff auf die Aufgabe (Titel, Fälligkeit, Schritte). */}
      {isEdit && task && hasAssistantKey && (
        <View style={{ paddingTop: Spacing.lg }}>
          <LinkedChats taskId={task.id} title={task.title} onNavigate={onClose} />
        </View>
      )}
      <KeyboardDoneBar />
    </BottomSheet>
  );
}

/** Kompakte Detail-Zeile: Icon · Label · aktueller Wert · Chevron. */
function DetailRow({
  icon: Icon,
  iconColor,
  label,
  value,
  valueTone,
  expanded,
  onPress,
}: {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  value: string;
  valueTone: 'teal' | 'text2' | 'text3';
  expanded: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      pressedScale={0.99}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
    >
      <Icon size={18} color={iconColor} strokeWidth={2} />
      <Type variant="body" style={{ flex: 1 }}>{label}</Type>
      <Type variant="label" tone={valueTone} numberOfLines={1} style={{ maxWidth: 170 }}>{value}</Type>
      <DisclosureChevron open={expanded} color={colors.text3} />
    </PressableScale>
  );
}

function ChipWrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>{children}</View>;
}
