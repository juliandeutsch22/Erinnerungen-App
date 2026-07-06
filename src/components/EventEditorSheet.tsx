// EventEditorSheet.tsx — Termin anlegen/bearbeiten im Gerätekalender, in der
// Formsprache des Aufgaben-Editors: Titel + Notiz oben, kompakte Detail-Zeilen
// (Kalender / Wann), Primär-Button fest im Footer. Löschen zweistufig.
import { CalendarDays, ChevronDown, ChevronRight, Trash2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { GlassButton } from '@/components/GlassButton';
import { MiniCalendar } from '@/components/MiniCalendar';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from '@/data/calendarQueries';
import { addDays, formatDueDate, parseDateStr, toDateStr, todayStr } from '@/lib/dates';
import type { DeviceCalendar, DeviceEvent } from '@/lib/deviceCalendar';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

const START_PRESETS = ['09:00', '12:00', '15:00', '18:00'];
const DURATIONS: { label: string; minutes: number }[] = [
  { label: '30 Min', minutes: 30 },
  { label: '1 Std', minutes: 60 },
  { label: '2 Std', minutes: 120 },
];

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

  const [title, setTitle] = useState(event?.title ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [calendarId, setCalendarId] = useState(event?.calendarId ?? writable[0]?.id ?? '');
  const [day, setDay] = useState(event ? toDateStr(event.start) : defaultDate);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startTime, setStartTime] = useState(event && !event.allDay ? hm(event.start) : '09:00');
  const [endTime, setEndTime] = useState(event && !event.allDay ? hm(event.end) : '10:00');
  const [showCalendarGrid, setShowCalendarGrid] = useState(false);
  const [customStart, setCustomStart] = useState(false);
  const [customEnd, setCustomEnd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [section, setSection] = useState<'calendar' | 'when' | null>(isEdit ? null : 'when');

  const canSave = title.trim().length > 0 && calendarId.length > 0;
  const currentCalendar = calendars.find((c) => c.id === calendarId);

  const toggleSection = (s: 'calendar' | 'when') => {
    hapticSelect();
    setSection((cur) => (cur === s ? null : s));
    setShowCalendarGrid(false);
  };

  const whenLabel = allDay
    ? `${formatDueDate(day, today)}, Ganztägig`
    : `${formatDueDate(day, today)}, ${startTime} – ${endTime}`;

  const save = () => {
    if (!canSave) return;
    const validStart = VALID_TIME.test(startTime) ? startTime : '09:00';
    let start: Date;
    let end: Date;
    if (allDay) {
      start = timeToDate(day, '00:00');
      end = timeToDate(addDays(day, 1), '00:00');
    } else {
      start = timeToDate(day, validStart);
      end = VALID_TIME.test(endTime) ? timeToDate(day, endTime) : new Date(start.getTime() + 60 * 60 * 1000);
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
          { fontSize: T.lg, color: colors.text, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderColor: colors.border2 },
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

      {/* Kalender-Wahl (nur beim Anlegen; bestehende Termine bleiben in ihrem Kalender). */}
      {!isEdit && writable.length > 1 && (
        <>
          <PressableScale
            accessibilityLabel={`Kalender: ${currentCalendar?.title ?? '—'}`}
            onPress={() => toggleSection('calendar')}
            pressedScale={0.99}
            style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md }}
          >
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: currentCalendar?.color ?? colors.indigo }} />
            <Type variant="body" style={{ flex: 1 }}>Kalender</Type>
            <Type variant="label" tone="text2" numberOfLines={1} style={{ maxWidth: 170 }}>{currentCalendar?.title ?? '—'}</Type>
            {section === 'calendar' ? (
              <ChevronDown size={16} color={colors.text3} strokeWidth={2} />
            ) : (
              <ChevronRight size={16} color={colors.text3} strokeWidth={2} />
            )}
          </PressableScale>
          {section === 'calendar' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: Spacing.sm }}>
              {writable.map((c) => (
                <Chip key={c.id} label={c.title} active={calendarId === c.id} onPress={() => setCalendarId(c.id)} />
              ))}
            </View>
          )}
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
        </>
      )}

      {/* Wann: Datum + Ganztägig + Zeiten. */}
      <PressableScale
        accessibilityLabel={`Wann: ${whenLabel}`}
        onPress={() => toggleSection('when')}
        pressedScale={0.99}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md }}
      >
        <CalendarDays size={18} color={colors.teal} strokeWidth={2} />
        <Type variant="body" style={{ flex: 1 }}>Wann</Type>
        <Type variant="label" tone="teal" numberOfLines={1} style={{ maxWidth: 190 }}>{whenLabel}</Type>
        {section === 'when' ? (
          <ChevronDown size={16} color={colors.text3} strokeWidth={2} />
        ) : (
          <ChevronRight size={16} color={colors.text3} strokeWidth={2} />
        )}
      </PressableScale>
      {section === 'when' && (
        <View style={{ gap: Spacing.md, paddingBottom: Spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
            <Chip label="Heute" active={day === today} onPress={() => setDay(today)} />
            <Chip label="Morgen" active={day === addDays(today, 1)} onPress={() => setDay(addDays(today, 1))} />
            <Chip label="Kalender" icon={CalendarDays} active={showCalendarGrid} onPress={() => setShowCalendarGrid((v) => !v)} />
            <Chip label="Ganztägig" active={allDay} onPress={() => setAllDay((v) => !v)} />
          </View>
          {showCalendarGrid && (
            <View style={{ borderRadius: R.lg, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.chip, padding: Spacing.sm }}>
              <MiniCalendar
                selected={day}
                onSelect={(d) => {
                  setDay(d);
                  setShowCalendarGrid(false);
                }}
              />
            </View>
          )}
          {!allDay && (
            <>
              <View style={{ gap: Spacing.sm }}>
                <Type variant="caption" tone="text3">Beginn</Type>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' }}>
                  {START_PRESETS.map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      active={startTime === t && !customStart}
                      onPress={() => {
                        setCustomStart(false);
                        setStartTime(t);
                      }}
                    />
                  ))}
                  <Chip label="Eigene" active={customStart} onPress={() => setCustomStart((v) => !v)} />
                  {customStart && (
                    <TextInput
                      value={startTime}
                      onChangeText={(v) => setStartTime(/^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, '0') : v)}
                      placeholder="09:00"
                      placeholderTextColor={colors.text3}
                      keyboardType="numbers-and-punctuation"
                      accessibilityLabel="Eigener Beginn (HH:MM)"
                      style={[{ fontSize: T.md, color: colors.text, borderBottomWidth: 1, borderColor: colors.border2, minWidth: 64, paddingVertical: Spacing.xs }, webNoOutline]}
                    />
                  )}
                </View>
              </View>
              <View style={{ gap: Spacing.sm }}>
                <Type variant="caption" tone="text3">Dauer / Ende</Type>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' }}>
                  {DURATIONS.map((d) => {
                    const base = VALID_TIME.test(startTime) ? startTime : '09:00';
                    const end = hm(new Date(timeToDate(today, base).getTime() + d.minutes * 60 * 1000));
                    return (
                      <Chip
                        key={d.label}
                        label={d.label}
                        active={endTime === end && !customEnd}
                        onPress={() => {
                          setCustomEnd(false);
                          setEndTime(end);
                        }}
                      />
                    );
                  })}
                  <Chip label="Eigene" active={customEnd} onPress={() => setCustomEnd((v) => !v)} />
                  {customEnd && (
                    <TextInput
                      value={endTime}
                      onChangeText={(v) => setEndTime(/^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, '0') : v)}
                      placeholder="10:00"
                      placeholderTextColor={colors.text3}
                      keyboardType="numbers-and-punctuation"
                      accessibilityLabel="Eigenes Ende (HH:MM)"
                      style={[{ fontSize: T.md, color: colors.text, borderBottomWidth: 1, borderColor: colors.border2, minWidth: 64, paddingVertical: Spacing.xs }, webNoOutline]}
                    />
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      )}
    </BottomSheet>
  );
}
