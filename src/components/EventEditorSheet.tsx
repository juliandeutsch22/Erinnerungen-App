// EventEditorSheet.tsx — Termin anlegen/bearbeiten im Gerätekalender, in der
// Formsprache des Aufgaben-Editors: Titel + Notiz oben, kompakte Detail-Zeilen
// (Kalender / Beginnt / Endet), Primär-Button fest im Footer. Termine können
// sich über mehrere Tage erstrecken; Uhrzeiten über natives iOS-Rad.
import { CalendarDays, Plus, Trash2, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { DisclosureChevron } from '@/components/DisclosureChevron';
import { Chip } from '@/components/Chip';
import { GlassButton } from '@/components/GlassButton';
import { LinkedNotes } from '@/components/LinkedNotes';
import { MiniCalendar } from '@/components/MiniCalendar';
import { DocumentStrip } from '@/components/DocumentStrip';
import { documentsAvailable } from '@/lib/documents';
import { PhotoStrip } from '@/components/PhotoStrip';
import { PressableScale } from '@/components/PressableScale';
import { Expanded, Group, RowDivider } from '@/components/SheetParts';
import { TaskCheck } from '@/components/TaskCheck';
import { TimeField } from '@/components/TimeField';
import { Type } from '@/components/Type';
import { LinkedChats } from '@/components/LinkedChats';
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from '@/data/calendarQueries';
import { buildEventContext } from '@/lib/assistant';
import { useSettings } from '@/theme/settings.store';
import { DEFAULT_LIST_ID } from '@/data/ListRepository';
import { useCompleteTask, useCreateTask, useReopenTask, useTasks, useUpdateTask } from '@/data/queries';
import { addDays, formatDueDate, parseDateStr, toDateStr, todayStr } from '@/lib/dates';
import type { DeviceCalendar, DeviceEvent } from '@/lib/deviceCalendar';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

function hm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeToDate(day: string, time: string): Date {
  const d = parseDateStr(day);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

const VALID_TIME = /^\d{2}:\d{2}$/;
type WhenRow = 'start' | 'end';

export function EventEditorSheet({
  event,
  defaultDate,
  calendars,
  onClose,
}: {
  /** null = neuer Termin. */
  event: DeviceEvent | null;
  defaultDate: string;
  calendars: DeviceCalendar[];
  onClose: () => void;
}) {
  const colors = useColors();
  const today = todayStr();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const writable = useMemo(() => calendars.filter((c) => c.allowsModifications), [calendars]);
  const isEdit = event !== null;
  const hasAssistantKey = useSettings((s) => s.geminiApiKey.length > 0);

  // Ende ganztägiger Termine wird exklusiv gespeichert (00:00 Folgetag) →
  // für die Anzeige einen Tag zurück, damit „bis" den letzten echten Tag zeigt.
  const initialEndDay = event
    ? event.allDay
      ? toDateStr(new Date(event.end.getTime() - 1))
      : toDateStr(event.end)
    : defaultDate;

  const [title, setTitle] = useState(event?.title ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [calendarId, setCalendarId] = useState(event?.calendarId ?? writable[0]?.id ?? '');
  const [startDay, setStartDay] = useState(event ? toDateStr(event.start) : defaultDate);
  const [endDay, setEndDay] = useState(initialEndDay);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startTime, setStartTime] = useState(event && !event.allDay ? hm(event.start) : '09:00');
  const [endTime, setEndTime] = useState(event && !event.allDay ? hm(event.end) : '10:00');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [section, setSection] = useState<'calendar' | WhenRow | null>(isEdit ? null : 'start');

  const canSave = title.trim().length > 0 && calendarId.length > 0;
  const currentCalendar = calendars.find((c) => c.id === calendarId);
  const multiDay = endDay !== startDay;

  const toggleSection = (s: 'calendar' | WhenRow) => {
    hapticSelect();
    setSection((cur) => (cur === s ? null : s));
  };

  // Ende nie vor Beginn: schiebt den Endtag mit, wenn der Beginn danach liegt.
  const setStartDaySafe = (d: string) => {
    setStartDay(d);
    if (endDay < d) setEndDay(d);
  };
  const setEndDaySafe = (d: string) => {
    setEndDay(d < startDay ? startDay : d);
  };

  const startLabel = allDay
    ? formatDueDate(startDay, today)
    : `${formatDueDate(startDay, today)}, ${startTime}`;
  const endLabel = allDay
    ? formatDueDate(endDay, today)
    : `${formatDueDate(endDay, today)}, ${endTime}`;

  const save = () => {
    if (!canSave) return;
    let start: Date;
    let end: Date;
    if (allDay) {
      start = timeToDate(startDay, '00:00');
      // Ende exklusiv: der Tag NACH dem letzten ganztägigen Tag.
      end = timeToDate(addDays(endDay, 1), '00:00');
    } else {
      const s = VALID_TIME.test(startTime) ? startTime : '09:00';
      const e = VALID_TIME.test(endTime) ? endTime : '10:00';
      start = timeToDate(startDay, s);
      end = timeToDate(endDay, e);
      // Gleicher Tag + Ende ≤ Beginn → mindestens eine Stunde.
      if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 60 * 60 * 1000);
    }
    const draft = { title: title.trim(), notes: notes.trim() ? notes.trim() : null, allDay, start, end };
    if (isEdit) updateEvent.mutate({ event, draft });
    else {
      createEvent.mutate({ calendarId, draft });
      hapticSuccess();
    }
    onClose();
  };

  const footer = (
    <View>
      <GlassButton accessibilityLabel={isEdit ? 'Termin sichern' : 'Termin anlegen'} onPress={save} disabled={!canSave}>
        <Type variant="label" style={{ color: '#FFFFFF' }}>{isEdit ? 'Sichern' : 'Termin anlegen'}</Type>
      </GlassButton>
      {isEdit && (
        <PressableScale
          accessibilityLabel={confirmDelete ? 'Endgültig löschen' : 'Termin löschen'}
          onPress={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            deleteEvent.mutate(event);
            onClose();
          }}
          style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, marginTop: Spacing.xs }}
        >
          <Trash2 size={15} color={confirmDelete ? colors.indigo : colors.text3} strokeWidth={2} />
          <Type variant="label" tone={confirmDelete ? 'indigo' : 'text3'}>
            {confirmDelete ? 'Wirklich löschen? Tippe erneut.' : 'Löschen'}
          </Type>
        </PressableScale>
      )}
    </View>
  );

  return (
    <BottomSheet visible title={isEdit ? 'Termin bearbeiten' : 'Neuer Termin'} onClose={onClose} footer={footer}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Titel des Termins"
        placeholderTextColor={colors.text3}
        autoFocus={!isEdit}
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="Termin-Titel"
        style={[
          { fontSize: T.xl, fontWeight: '600', color: colors.text, paddingVertical: Spacing.sm },
          webNoOutline,
        ]}
      />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Notiz"
        placeholderTextColor={colors.text3}
        multiline
        accessibilityLabel="Termin-Notiz"
        style={[
          { fontSize: T.md, color: colors.text2, paddingVertical: Spacing.sm, marginBottom: Spacing.sm, minHeight: 36 },
          webNoOutline,
        ]}
      />

      {event?.recurring && (
        <Type variant="caption" tone="text3" style={{ marginBottom: Spacing.sm }}>
          Serientermin — Änderungen können die ganze Serie betreffen.
        </Type>
      )}

      {/* Gruppierte Detail-Zeilen — Kalender / Ganztägig / Beginnt / Endet. */}
      <Group>
        {!isEdit && writable.length > 1 && (
          <>
            <PressableScale
              accessibilityLabel={`Kalender: ${currentCalendar?.title ?? '—'}`}
              onPress={() => toggleSection('calendar')}
              pressedScale={0.99}
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: currentCalendar?.color ?? colors.indigo }} />
              <Type variant="body" style={{ flex: 1 }}>Kalender</Type>
              <Type variant="label" tone="text2" numberOfLines={1} style={{ maxWidth: 170 }}>{currentCalendar?.title ?? '—'}</Type>
              <DisclosureChevron open={section === 'calendar'} color={colors.text3} />
            </PressableScale>
            {section === 'calendar' && (
              <Expanded>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                  {writable.map((c) => (
                    <Chip key={c.id} label={c.title} active={calendarId === c.id} onPress={() => setCalendarId(c.id)} />
                  ))}
                </View>
              </Expanded>
            )}
            <RowDivider />
          </>
        )}

        {/* Ganztägig-Schalter */}
        <PressableScale
          accessibilityRole="switch"
          accessibilityState={{ checked: allDay }}
          accessibilityLabel={allDay ? 'Ganztägig aus' : 'Ganztägig an'}
          onPress={() => {
            hapticSelect();
            setAllDay((v) => !v);
          }}
          pressedScale={0.99}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
        >
          <CalendarDays size={18} color={colors.teal} strokeWidth={2} />
          <Type variant="body" style={{ flex: 1 }}>Ganztägig</Type>
          <Type variant="label" tone={allDay ? 'teal' : 'text3'}>{allDay ? 'An' : 'Aus'}</Type>
        </PressableScale>
        <RowDivider />

        {/* Beginnt */}
        <WhenRowView
          label="Beginnt"
          value={startLabel}
          expanded={section === 'start'}
          onPress={() => toggleSection('start')}
          day={startDay}
          onSelectDay={setStartDaySafe}
          allDay={allDay}
          time={startTime}
          onChangeTime={setStartTime}
          today={today}
        />
        <RowDivider />

        {/* Endet */}
        <WhenRowView
          label="Endet"
          value={endLabel}
          expanded={section === 'end'}
          onPress={() => toggleSection('end')}
          day={endDay}
          onSelectDay={setEndDaySafe}
          allDay={allDay}
          time={endTime}
          onChangeTime={setEndTime}
          today={today}
          minDay={startDay}
        />
      </Group>

      {multiDay && (
        <Type variant="caption" tone="text3" style={{ marginTop: Spacing.sm }}>
          Erstreckt sich über mehrere Tage.
        </Type>
      )}

      {/* Aufgaben zum Termin — macht den Termin zum kleinen Projekt
          (Vorbereiten, Mitbringen …). Erst für gespeicherte Termine. */}
      {isEdit && event && (
        <View style={{ marginTop: Spacing.md }}>
          <Hairline />
          <View style={{ marginTop: Spacing.md }}>
            <EventTasks eventId={event.id} eventDay={startDay} />
          </View>
        </View>
      )}

      {/* Assistent: Chats mit eingefrorenem Termin-Kontext (Ort, Daten). */}
      {isEdit && event && hasAssistantKey && (
        <View style={{ marginTop: Spacing.md }}>
          <Hairline />
          <View style={{ marginTop: Spacing.md }}>
            <LinkedChats
              eventId={event.id}
              title={event.title}
              context={buildEventContext(event)}
              onNavigate={onClose}
            />
          </View>
        </View>
      )}

      {/* Verknüpfte Notizen — erst für gespeicherte Termine (brauchen eine Event-ID). */}
      {isEdit && event && (
        <View style={{ marginTop: Spacing.md }}>
          <Hairline />
          <View style={{ marginTop: Spacing.md }}>
            <LinkedNotes eventId={event.id} onNavigate={onClose} />
          </View>
        </View>
      )}

      {/* Dokumente: Tickets, Buchungen, PDFs — erst für gespeicherte Termine,
          nur wo der Datei-Picker existiert (sonst bliebe eine leere Hairline). */}
      {isEdit && event && documentsAvailable && (
        <View style={{ marginTop: Spacing.md }}>
          <Hairline />
          <View style={{ marginTop: Spacing.md }}>
            <DocumentStrip eventId={event.id} />
          </View>
        </View>
      )}

      {/* Fotos: erst für gespeicherte Termine (brauchen eine Event-ID). */}
      {isEdit && event && (
        <View style={{ marginTop: Spacing.md }}>
          <Hairline />
          <View style={{ marginTop: Spacing.md }}>
            <PhotoStrip eventId={event.id} />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

/** Aufgaben, die an diesen Termin gehängt sind: abhaken, lösen, direkt anlegen.
 *  Bewusst inline (kein zweites Sheet über dem Sheet) — nur Eingabe + Buttons. */
function EventTasks({ eventId, eventDay }: { eventId: string; eventDay: string }) {
  const colors = useColors();
  const { data: tasks } = useTasks();
  const createTask = useCreateTask();
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const updateTask = useUpdateTask();
  const [draft, setDraft] = useState('');

  const linked = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.eventId === eventId)
        .sort((a, b) => (a.completedAt ? 1 : 0) - (b.completedAt ? 1 : 0) || a.sort - b.sort),
    [tasks, eventId],
  );

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    hapticSuccess();
    // Auf den Termintag datiert, ohne Uhrzeit — erscheint dort im Tagesplan.
    createTask.mutate({ listId: DEFAULT_LIST_ID, title, eventId, dueDate: eventDay });
    setDraft('');
  };

  return (
    <View style={{ gap: Spacing.xs }}>
      <Type variant="eyebrow" tone="text3">Aufgaben</Type>
      {linked.map((t) => {
        const done = t.completedAt !== null;
        return (
          <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2 }}>
            <TaskCheck
              checked={done}
              accessibilityLabel={done ? `${t.title} wieder öffnen` : `${t.title} erledigen`}
              onToggle={(next) => (next ? completeTask.mutate(t) : reopenTask.mutate(t.id))}
            />
            <Type
              variant="body"
              tone={done ? 'text3' : 'text'}
              numberOfLines={2}
              style={{ flex: 1, textDecorationLine: done ? 'line-through' : 'none' }}
            >
              {t.title}
            </Type>
            <PressableScale
              accessibilityLabel={`„${t.title}" vom Termin lösen`}
              onPress={() => {
                hapticSelect();
                updateTask.mutate({ id: t.id, patch: { eventId: null } });
              }}
              style={{ padding: Spacing.xs }}
            >
              <X size={15} color={colors.text3} strokeWidth={2} />
            </PressableScale>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <View style={{ width: 22, alignItems: 'center' }}>
          <Plus size={18} color={colors.teal} strokeWidth={2.2} />
        </View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Aufgabe zum Termin"
          placeholderTextColor={colors.text3}
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={add}
          accessibilityLabel="Aufgabe zum Termin hinzufügen"
          style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: Spacing.xs }, webNoOutline]}
        />
        {draft.trim().length > 0 && (
          <PressableScale accessibilityLabel="Aufgabe übernehmen" onPress={add} style={{ padding: Spacing.xs }}>
            <Type variant="label" tone="teal">Hinzufügen</Type>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

function WhenRowView({
  label,
  value,
  expanded,
  onPress,
  day,
  onSelectDay,
  allDay,
  time,
  onChangeTime,
  today,
  minDay,
}: {
  label: string;
  value: string;
  expanded: boolean;
  onPress: () => void;
  day: string;
  onSelectDay: (d: string) => void;
  allDay: boolean;
  time: string;
  onChangeTime: (t: string) => void;
  today: string;
  minDay?: string;
}) {
  const colors = useColors();
  return (
    <>
      <PressableScale
        accessibilityLabel={`${label}: ${value}`}
        accessibilityState={{ expanded }}
        onPress={onPress}
        pressedScale={0.99}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
      >
        <View style={{ width: 18 }} />
        <Type variant="body" style={{ flex: 1 }}>{label}</Type>
        <Type variant="label" tone="teal" numberOfLines={1} style={{ maxWidth: 190 }}>{value}</Type>
        <DisclosureChevron open={expanded} color={colors.text3} />
      </PressableScale>
      {expanded && (
        <Expanded>
          <View style={{ gap: Spacing.md }}>
            {!allDay && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Type variant="caption" tone="text3">Uhrzeit</Type>
                <TimeField value={time} onChange={onChangeTime} accessibilityLabel={`${label} Uhrzeit wählen`} />
              </View>
            )}
            <View style={{ borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.bg2, padding: Spacing.sm }}>
              <MiniCalendar
                selected={day}
                onSelect={onSelectDay}
                minDate={minDay}
              />
            </View>
          </View>
        </Expanded>
      )}
    </>
  );
}

function Hairline() {
  const colors = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}
