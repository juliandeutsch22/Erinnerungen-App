// heute.tsx — Startscreen (Fahrplan §4): Datum-Eyebrow + Begrüßung mit Tages-
// Bilanz; darunter überfällig (Indigo, ruhig) → heute mit Uhrzeit → heute ohne
// Uhrzeit auf EINER Glass-Fläche mit Seams, plus dünne Fortschrittslinie und
// einklappbare „Erledigt heute"-Sektion. Abhaken = Teal-Puls + Haptik.
import { useRouter } from 'expo-router';
import { CalendarCheck, ChevronDown, ChevronRight, Plus, Settings, Sun } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { EventEditorSheet } from '@/components/EventEditorSheet';
import { EventRow } from '@/components/EventRow';
import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { QuickAdd } from '@/components/QuickAdd';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState, LoadingState } from '@/components/StateView';
import { TaskEditorSheet } from '@/components/TaskEditorSheet';
import { TaskQuickSheet } from '@/components/TaskQuickSheet';
import { TaskRow } from '@/components/TaskRow';
import { Type } from '@/components/Type';
import { useDeviceCalendars, useDeviceEvents } from '@/data/calendarQueries';
import { usePhotoCounts } from '@/data/photoQueries';
import { useAdoptOverdue, useCompleteTask, useLists, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { bucketEventsByDay } from '@/lib/calendarLogic';
import { buildDayTimeline, nowMarkerIndex } from '@/lib/dayTimeline';
import { addDays, formatDayHeading, toDateStr, todayStr } from '@/lib/dates';
import { type DeviceEvent, hasCalendarPermission } from '@/lib/deviceCalendar';
import { groupToday, groupUpcomingDays } from '@/lib/taskLogic';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { TAB_BAR_SAFE_BOTTOM } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

export default function HeuteScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: tasks, isLoading } = useTasks();
  const { data: lists } = useLists();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const adoptOverdue = useAdoptOverdue();

  // undefined = Editor zu, null = neue Aufgabe, Task = bearbeiten.
  const [editorTask, setEditorTask] = useState<Task | null | undefined>(undefined);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [quickTask, setQuickTask] = useState<Task | null>(null);
  const [editorEvent, setEditorEvent] = useState<DeviceEvent | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Termine erscheinen nur, wenn der Kalender-Zugriff schon gewährt wurde —
  // der Permission-Prompt selbst gehört in den Kalender-Tab.
  const [calGranted, setCalGranted] = useState(false);
  useEffect(() => {
    void hasCalendarPermission().then(setCalGranted);
  }, []);

  const today = todayStr();
  const listById = useMemo(() => new Map((lists ?? []).map((l) => [l.id, l])), [lists]);

  // Termine (heute + nächste 6 Tage) aus dem Gerätekalender.
  const horizon = addDays(today, 6);
  const { data: calendars } = useDeviceCalendars(calGranted);
  const { data: events } = useDeviceEvents(today, horizon, calGranted);
  const photoCounts = usePhotoCounts();
  const calendarById = useMemo(() => new Map((calendars ?? []).map((c) => [c.id, c])), [calendars]);
  const eventsByDay = useMemo(() => bucketEventsByDay(events ?? [], today, horizon), [events, today, horizon]);
  const todayEvents = eventsByDay.get(today) ?? [];

  // An heutige Termine gehängte Aufgaben: sie erscheinen eingerückt UNTER ihrem
  // Termin (der Termin wird zum kleinen Projekt) — und darum aus allen anderen
  // Sektionen herausgehalten, damit nichts doppelt auftaucht.
  const todayEventIds = useMemo(() => new Set(todayEvents.map((e) => e.id)), [todayEvents]);
  const attachedByEvent = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks ?? []) {
      if (t.eventId && todayEventIds.has(t.eventId)) {
        const arr = m.get(t.eventId) ?? [];
        arr.push(t);
        m.set(t.eventId, arr);
      }
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.completedAt ? 1 : 0) - (b.completedAt ? 1 : 0) || a.sort - b.sort);
    }
    return m;
  }, [tasks, todayEventIds]);
  const attachedIds = useMemo(
    () => new Set([...attachedByEvent.values()].flat().map((t) => t.id)),
    [attachedByEvent],
  );
  const freeTasks = useMemo(() => (tasks ?? []).filter((t) => !attachedIds.has(t.id)), [tasks, attachedIds]);

  const groups = useMemo(() => groupToday(freeTasks, today), [freeTasks, today]);
  const open = groups.overdue.length + groups.timed.length + groups.untimed.length;

  // Heute Erledigtes (lokales Datum!) — neueste zuerst, für Bilanz + Sektion.
  const doneToday = useMemo(
    () =>
      freeTasks
        .filter((t) => t.completedAt !== null && toDateStr(new Date(t.completedAt)) === today)
        .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1)),
    [freeTasks, today],
  );
  const dayTotal = open + doneToday.length;
  const allDone = dayTotal > 0 && open === 0;

  // Wochenvorschau: die nächsten 6 Tage — Erinnerungen + Termine vereint,
  // nur Tage, an denen etwas ansteht.
  const upcoming = useMemo(() => {
    const taskGroups = new Map(groupUpcomingDays(tasks ?? [], today).map((g) => [g.date, g.tasks]));
    const dates = new Set<string>(taskGroups.keys());
    for (const d of eventsByDay.keys()) {
      if (d > today) dates.add(d);
    }
    return [...dates].sort().map((date) => ({
      date,
      tasks: taskGroups.get(date) ?? [],
      events: eventsByDay.get(date) ?? [],
    }));
  }, [tasks, today, eventsByDay]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 5 ? 'Gute Nacht' : hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
  const dateLine = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  // Tagesplan: Termine (mit Uhrzeit) + Aufgaben (mit Uhrzeit) verschmelzen zu
  // EINEM chronologischen Ablauf mit „Jetzt"-Marker. Ganztägige Termine haben
  // keinen Slot und stehen als eigene Zeile über der Timeline.
  const nowMin = hour * 60 + now.getMinutes();
  const nowLabel = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const allDayEvents = useMemo(() => todayEvents.filter((e) => e.allDay), [todayEvents]);
  const timeline = useMemo(
    () => buildDayTimeline(todayEvents, groups.timed, today),
    [todayEvents, groups.timed, today],
  );
  const nowIdx = nowMarkerIndex(timeline, nowMin);

  // Ruhige Tages-Bilanz unter der Begrüßung (inkl. Termine).
  const eventSuffix =
    todayEvents.length > 0 ? ` · ${todayEvents.length} ${todayEvents.length === 1 ? 'Termin' : 'Termine'}` : '';
  const summary =
    (dayTotal === 0
      ? todayEvents.length > 0
        ? 'Keine Erinnerungen'
        : 'Nichts geplant für heute.'
      : allDone
        ? 'Alles für heute erledigt.'
        : `${open} offen${doneToday.length > 0 ? ` · ${doneToday.length} erledigt` : ''}`) + eventSuffix;

  const toggle = (task: Task) => (next: boolean) => {
    if (next) complete.mutate(task);
    else reopen.mutate(task.id);
  };

  const adoptAll = () => {
    hapticSuccess();
    adoptOverdue.mutate(tasks ?? []);
  };

  const renderRows = (items: Task[]) =>
    items.map((t) => (
      <TaskRow
        key={t.id}
        task={t}
        today={today}
        list={t.listId !== 'default' ? listById.get(t.listId) : undefined}
        onToggle={toggle(t)}
        onPress={() => setEditorTask(t)}
        onReschedule={() => setRescheduleTask(t)}
        onLongPress={() => setQuickTask(t)}
      />
    ));

  // An einen Termin gehängte Aufgaben, eingerückt unter dem Termin — mit
  // dünner Leiste als visuelle Klammer.
  const renderAttached = (eventId: string) => {
    const items = attachedByEvent.get(eventId);
    if (!items || items.length === 0) return null;
    return (
      <View
        style={{
          marginLeft: Spacing.lg,
          marginBottom: Spacing.xs,
          paddingLeft: Spacing.md,
          borderLeftWidth: 2,
          borderLeftColor: colors.chipBorder,
        }}
      >
        {items.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            today={today}
            showDue="time-only"
            showEventLink={false}
            onToggle={toggle(t)}
            onPress={() => setEditorTask(t)}
            onReschedule={() => setRescheduleTask(t)}
            onLongPress={() => setQuickTask(t)}
          />
        ))}
      </View>
    );
  };

  // „Jetzt"-Marker: Teal-Punkt + Uhrzeit + dünne Linie, sitzt zwischen den
  // Timeline-Einträgen an der Stelle der aktuellen Uhrzeit.
  const nowMarker = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: colors.teal }} />
      <Type variant="caption" tone="teal" tabular>Jetzt · {nowLabel}</Type>
      <View style={{ flex: 1, height: 1, borderRadius: 999, backgroundColor: colors.teal, opacity: 0.35 }} />
    </View>
  );

  // Sektionen des Tages als Liste — dazwischen Seams. Reihenfolge: überfällig →
  // Tagesplan (Termine + Aufgaben chronologisch) → ohne Uhrzeit → erledigt.
  const hasOverdue = groups.overdue.length > 0;
  const hasPlan = timeline.length > 0 || allDayEvents.length > 0;
  const hasUntimed = groups.untimed.length > 0;
  const hasDone = doneToday.length > 0;
  const nothingAtAll = !hasOverdue && !hasPlan && !hasUntimed && !hasDone;

  const sections: React.ReactNode[] = [];

  if (hasOverdue) {
    sections.push(
      <View key="overdue">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Type variant="eyebrow" tone="indigo">Überfällig · {groups.overdue.length}</Type>
          {/* Auto-Übernahme: alle überfälligen mit einem Tipp auf heute holen. */}
          <PressableScale
            accessibilityLabel="Alle überfälligen auf heute holen"
            onPress={adoptAll}
            pressedScale={0.97}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 8, marginRight: -8 }}
          >
            <CalendarCheck size={14} color={colors.indigo} strokeWidth={2} />
            <Type variant="caption" tone="indigo">Auf heute</Type>
          </PressableScale>
        </View>
        <View style={{ marginTop: Spacing.xs }}>{renderRows(groups.overdue)}</View>
      </View>,
    );
  }

  if (hasPlan) {
    sections.push(
      <View key="plan">
        <Type variant="eyebrow" tone="text3">Tagesplan</Type>
        <View style={{ marginTop: Spacing.xs }}>
          {/* Ganztägige Termine zuerst — ohne Zeit-Slot, über der Timeline. */}
          {allDayEvents.map((ev) => (
            <React.Fragment key={ev.key}>
              <EventRow
                event={ev}
                calendar={calendarById.get(ev.calendarId)}
                day={today}
                showCalendarName={false}
                photoCount={photoCounts.get(ev.id) ?? 0}
                onPress={() => setEditorEvent(ev)}
              />
              {renderAttached(ev.id)}
            </React.Fragment>
          ))}
          {timeline.map((entry, i) => (
            <React.Fragment key={entry.key}>
              {i === nowIdx && nowMarker}
              {entry.kind === 'event' ? (
                <>
                  <EventRow
                    event={entry.event}
                    calendar={calendarById.get(entry.event.calendarId)}
                    day={today}
                    showCalendarName={false}
                    photoCount={photoCounts.get(entry.event.id) ?? 0}
                    onPress={() => setEditorEvent(entry.event)}
                  />
                  {renderAttached(entry.event.id)}
                </>
              ) : (
                <TaskRow
                  task={entry.task}
                  today={today}
                  showDue="time-only"
                  list={entry.task.listId !== 'default' ? listById.get(entry.task.listId) : undefined}
                  onToggle={toggle(entry.task)}
                  onPress={() => setEditorTask(entry.task)}
                  onReschedule={() => setRescheduleTask(entry.task)}
                  onLongPress={() => setQuickTask(entry.task)}
                />
              )}
            </React.Fragment>
          ))}
          {/* Marker ans Ende, wenn schon alles vorbei ist. */}
          {nowIdx === timeline.length && timeline.length > 0 && nowMarker}
        </View>
      </View>,
    );
  }

  if (hasUntimed) {
    sections.push(
      <View key="untimed">
        <Type variant="eyebrow" tone="text3">Ohne Uhrzeit</Type>
        <View style={{ marginTop: Spacing.xs }}>{renderRows(groups.untimed)}</View>
      </View>,
    );
  }

  if (hasDone) {
    sections.push(
      <View key="done">
        {/* Erledigt heute — einklappbar, Abhaken bleibt sichtbar + rückholbar. */}
        <PressableScale
          accessibilityLabel={showCompleted ? 'Erledigte ausblenden' : 'Erledigte anzeigen'}
          onPress={() => {
            hapticSelect();
            setShowCompleted((v) => !v);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Type variant="eyebrow" tone="text3">Erledigt · {doneToday.length}</Type>
          {showCompleted ? (
            <ChevronDown size={16} color={colors.text3} strokeWidth={2} />
          ) : (
            <ChevronRight size={16} color={colors.text3} strokeWidth={2} />
          )}
        </PressableScale>
        {showCompleted && <View style={{ marginTop: Spacing.xs }}>{renderRows(doneToday)}</View>}
      </View>,
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <Screen contentContainerStyle={{ paddingBottom: TAB_BAR_SAFE_BOTTOM + 84 }}>
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          {/* flex:1 + adjustsFontSize: Begrüßung kann nie abgeschnitten werden. */}
          <View style={{ gap: Spacing.xs, flex: 1, paddingRight: Spacing.sm }}>
            <Type variant="eyebrow" tone="text3">{dateLine}</Type>
            <Type variant="title" numberOfLines={1} adjustsFontSizeToFit>{greeting}</Type>
            <Type variant="caption" tone={allDone ? 'teal' : 'text3'} tabular>{summary}</Type>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PressableScale
              accessibilityLabel="Neue Aufgabe"
              onPress={() => setEditorTask(null)}
              style={{ padding: Spacing.sm }}
            >
              <Plus size={22} color={colors.teal} strokeWidth={2.2} />
            </PressableScale>
            <PressableScale
              accessibilityLabel="Einstellungen öffnen"
              onPress={() => router.push('/einstellungen')}
              style={{ padding: Spacing.sm }}
            >
              <Settings size={21} color={colors.text3} strokeWidth={2} />
            </PressableScale>
          </View>
        </View>
      </Reveal>

      <Reveal delay={90}>
        <GlassPanel>
          {/* Dünne Fortschrittslinie: der Tag bekommt einen Körper. */}
          {dayTotal > 0 && (
            <View style={{ height: 3, borderRadius: 999, backgroundColor: colors.chip, marginBottom: Spacing.md, overflow: 'hidden' }}>
              <View
                style={{
                  height: 3,
                  width: `${Math.round((doneToday.length / dayTotal) * 100)}%`,
                  backgroundColor: colors.teal,
                  borderRadius: 999,
                }}
              />
            </View>
          )}

          {isLoading && nothingAtAll ? (
            <LoadingState />
          ) : nothingAtAll ? (
            <EmptyState
              icon={<Sun size={20} color={colors.teal} strokeWidth={2} />}
              title="Nichts für heute"
              body="Kopf frei. Neues landet unten in der Eingabezeile — oder du genießt die Ruhe."
            />
          ) : (
            sections.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <Seam marginVertical={Spacing.md} />}
                {s}
              </React.Fragment>
            ))
          )}
        </GlassPanel>
      </Reveal>

      {/* Wochenvorschau: kommende Tage, aufklappbar — nur Tage mit Erinnerungen. */}
      {upcoming.length > 0 && (
        <Reveal delay={160}>
          <GlassPanel>
            <Type variant="eyebrow" tone="text3">Nächste Tage</Type>
            {upcoming.map((day, i) => {
              const expanded = expandedDays.has(day.date);
              return (
                <View key={day.date}>
                  {i > 0 && <Seam marginVertical={Spacing.sm} />}
                  <PressableScale
                    accessibilityLabel={`${formatDayHeading(day.date, today)} ${expanded ? 'einklappen' : 'aufklappen'}`}
                    onPress={() => {
                      hapticSelect();
                      setExpandedDays((prev) => {
                        const next = new Set(prev);
                        if (next.has(day.date)) next.delete(day.date);
                        else next.add(day.date);
                        return next;
                      });
                    }}
                    pressedScale={0.99}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, marginTop: i === 0 ? Spacing.xs : 0 }}
                  >
                    <Type variant="label">{formatDayHeading(day.date, today)}</Type>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                      <Type variant="caption" tone="text3" tabular>{day.tasks.length + day.events.length}</Type>
                      {expanded ? (
                        <ChevronDown size={16} color={colors.text3} strokeWidth={2} />
                      ) : (
                        <ChevronRight size={16} color={colors.text3} strokeWidth={2} />
                      )}
                    </View>
                  </PressableScale>
                  {expanded && (
                    <View>
                      {day.events.map((ev) => (
                        <EventRow
                          key={ev.key}
                          event={ev}
                          calendar={calendarById.get(ev.calendarId)}
                          day={day.date}
                          showCalendarName={false}
                          photoCount={photoCounts.get(ev.id) ?? 0}
                          onPress={() => setEditorEvent(ev)}
                        />
                      ))}
                      {day.tasks.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          today={today}
                          showDue="time-only"
                          list={t.listId !== 'default' ? listById.get(t.listId) : undefined}
                          onToggle={toggle(t)}
                          onPress={() => setEditorTask(t)}
                          onReschedule={() => setRescheduleTask(t)}
                          onLongPress={() => setQuickTask(t)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </GlassPanel>
        </Reveal>
      )}

      {editorTask !== undefined && (
        <TaskEditorSheet task={editorTask} defaultDueDate={today} onClose={() => setEditorTask(undefined)} />
      )}
      {rescheduleTask && <RescheduleSheet task={rescheduleTask} onClose={() => setRescheduleTask(null)} />}
      {quickTask && <TaskQuickSheet task={quickTask} onClose={() => setQuickTask(null)} />}
      {editorEvent && (
        <EventEditorSheet event={editorEvent} defaultDate={today} calendars={calendars ?? []} onClose={() => setEditorEvent(null)} />
      )}
    </Screen>

    {/* Quick-Add klebt über der Tab-Bar — Gedanke rein, Kopf frei (§1). */}
    <QuickAdd />
    </View>
  );
}
