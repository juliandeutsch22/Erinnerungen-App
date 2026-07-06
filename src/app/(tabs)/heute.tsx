// heute.tsx — Startscreen (Fahrplan §4): Datum-Eyebrow + Begrüßung mit Tages-
// Bilanz; darunter überfällig (Indigo, ruhig) → heute mit Uhrzeit → heute ohne
// Uhrzeit auf EINER Glass-Fläche mit Seams, plus dünne Fortschrittslinie und
// einklappbare „Erledigt heute"-Sektion. Abhaken = Teal-Puls + Haptik.
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, Plus, Settings, Sun } from 'lucide-react-native';
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
import { TaskRow } from '@/components/TaskRow';
import { Type } from '@/components/Type';
import { useDeviceCalendars, useDeviceEvents } from '@/data/calendarQueries';
import { useCompleteTask, useLists, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { bucketEventsByDay } from '@/lib/calendarLogic';
import { addDays, formatDayHeading, toDateStr, todayStr } from '@/lib/dates';
import { type DeviceEvent, hasCalendarPermission } from '@/lib/deviceCalendar';
import { groupToday, groupUpcomingDays } from '@/lib/taskLogic';
import { hapticSelect } from '@/lib/haptics';
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

  // undefined = Editor zu, null = neue Aufgabe, Task = bearbeiten.
  const [editorTask, setEditorTask] = useState<Task | null | undefined>(undefined);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
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
  const groups = useMemo(() => groupToday(tasks ?? [], today), [tasks, today]);
  const listById = useMemo(() => new Map((lists ?? []).map((l) => [l.id, l])), [lists]);
  const open = groups.overdue.length + groups.timed.length + groups.untimed.length;

  // Heute Erledigtes (lokales Datum!) — neueste zuerst, für Bilanz + Sektion.
  const doneToday = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.completedAt !== null && toDateStr(new Date(t.completedAt)) === today)
        .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1)),
    [tasks, today],
  );
  const dayTotal = open + doneToday.length;
  const allDone = dayTotal > 0 && open === 0;

  // Termine (heute + nächste 6 Tage) aus dem Gerätekalender.
  const horizon = addDays(today, 6);
  const { data: calendars } = useDeviceCalendars(calGranted);
  const { data: events } = useDeviceEvents(today, horizon, calGranted);
  const calendarById = useMemo(() => new Map((calendars ?? []).map((c) => [c.id, c])), [calendars]);
  const eventsByDay = useMemo(() => bucketEventsByDay(events ?? [], today, horizon), [events, today, horizon]);
  const todayEvents = eventsByDay.get(today) ?? [];

  // Wochenvorschau: die nächsten 6 Tage — Erinnerungen + Termine vereint,
  // nur Tage, an denen etwas ansteht.
  const upcoming = useMemo(() => {
    const taskGroups = new Map(groupUpcomingDays(tasks ?? [], today).map((g) => [g.date, g.tasks]));
    const dates = new Set<string>(taskGroups.keys());
    for (const day of eventsByDay.keys()) {
      if (day > today) dates.add(day);
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
      />
    ));

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

          {/* Termine des Tages — aus allen iOS-Kalendern (inkl. Google). */}
          {todayEvents.length > 0 && (
            <>
              <Type variant="eyebrow" tone="text3">Termine</Type>
              <View style={{ marginTop: Spacing.xs }}>
                {todayEvents.map((ev) => (
                  <EventRow
                    key={ev.key}
                    event={ev}
                    calendar={calendarById.get(ev.calendarId)}
                    day={today}
                    showCalendarName={false}
                    onPress={() => setEditorEvent(ev)}
                  />
                ))}
              </View>
              {dayTotal > 0 && <Seam marginVertical={Spacing.md} />}
            </>
          )}

          {isLoading && dayTotal === 0 ? (
            <LoadingState />
          ) : dayTotal === 0 ? (
            todayEvents.length === 0 ? (
              <EmptyState
                icon={<Sun size={20} color={colors.teal} strokeWidth={2} />}
                title="Nichts für heute"
                body="Kopf frei. Neues landet unten in der Eingabezeile — oder du genießt die Ruhe."
              />
            ) : null
          ) : (
            <>
              {allDone && (
                <Type variant="body" tone="text2">
                  Alles erledigt — der Tag gehört dir.
                </Type>
              )}
              {groups.overdue.length > 0 && (
                <>
                  <Type variant="eyebrow" tone="indigo">Überfällig</Type>
                  <View style={{ marginTop: Spacing.xs }}>{renderRows(groups.overdue)}</View>
                  {(groups.timed.length > 0 || groups.untimed.length > 0) && <Seam marginVertical={Spacing.md} />}
                </>
              )}
              {groups.timed.length > 0 && (
                <>
                  <Type variant="eyebrow" tone="text3">Heute</Type>
                  <View style={{ marginTop: Spacing.xs }}>{renderRows(groups.timed)}</View>
                  {groups.untimed.length > 0 && <Seam marginVertical={Spacing.md} />}
                </>
              )}
              {groups.untimed.length > 0 && (
                <>
                  <Type variant="eyebrow" tone="text3">Ohne Uhrzeit</Type>
                  <View style={{ marginTop: Spacing.xs }}>{renderRows(groups.untimed)}</View>
                </>
              )}

              {/* Erledigt heute — einklappbar, Abhaken bleibt sichtbar + rückholbar. */}
              {doneToday.length > 0 && (
                <>
                  {!allDone && <Seam marginVertical={Spacing.md} />}
                  <PressableScale
                    accessibilityLabel={showCompleted ? 'Erledigte ausblenden' : 'Erledigte anzeigen'}
                    onPress={() => {
                      hapticSelect();
                      setShowCompleted((v) => !v);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: allDone ? Spacing.md : 0 }}
                  >
                    <Type variant="eyebrow" tone="text3">Erledigt · {doneToday.length}</Type>
                    {showCompleted ? (
                      <ChevronDown size={16} color={colors.text3} strokeWidth={2} />
                    ) : (
                      <ChevronRight size={16} color={colors.text3} strokeWidth={2} />
                    )}
                  </PressableScale>
                  {showCompleted && <View style={{ marginTop: Spacing.xs }}>{renderRows(doneToday)}</View>}
                </>
              )}
            </>
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
              const count = day.tasks.length + day.events.length;
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
                      <Type variant="caption" tone="text3" tabular>{count}</Type>
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
      {editorEvent && (
        <EventEditorSheet event={editorEvent} defaultDate={today} calendars={calendars ?? []} onClose={() => setEditorEvent(null)} />
      )}
    </Screen>

    {/* Quick-Add klebt über der Tab-Bar — Gedanke rein, Kopf frei (§1). */}
    <QuickAdd />
    </View>
  );
}
