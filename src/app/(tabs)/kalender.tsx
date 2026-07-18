// kalender.tsx — Kalender-Tab: Monatsansicht + Tages-Agenda. Zeigt Termine
// ALLER in iOS eingerichteten Kalender (iCloud, Google, Outlook, … via
// EventKit) UND die eigenen Erinnerungen des Tages. Termine lassen sich
// anlegen, bearbeiten und löschen; Erinnerungen öffnen ihren Editor.
import { useRouter } from 'expo-router';
import { CalendarPlus, Images, Sun } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { CalendarMonth, type MonthAnchor, monthGridRange } from '@/components/CalendarMonth';
import { EventEditorSheet } from '@/components/EventEditorSheet';
import { EventRow } from '@/components/EventRow';
import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState, LoadingState } from '@/components/StateView';
import { TaskEditorSheet } from '@/components/TaskEditorSheet';
import { TaskQuickSheet } from '@/components/TaskQuickSheet';
import { TaskRow } from '@/components/TaskRow';
import { Type } from '@/components/Type';
import { usePhotoCounts } from '@/data/photoQueries';
import { useDeviceCalendars, useDeviceEvents } from '@/data/calendarQueries';
import { useCompleteTask, useLists, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { bucketEventsByDay } from '@/lib/calendarLogic';
import { formatDayHeading, parseDateStr, todayStr } from '@/lib/dates';
import { deviceCalendarAvailable, type DeviceEvent, ensureCalendarPermission } from '@/lib/deviceCalendar';
import { hapticSelect } from '@/lib/haptics';
import { byTimeThenCreation, isOpen } from '@/lib/taskLogic';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

type Permission = 'unknown' | 'granted' | 'denied';

export default function KalenderScreen() {
  const colors = useColors();
  const router = useRouter();
  const today = todayStr();
  const t = parseDateStr(today);
  const photoCounts = usePhotoCounts();

  const [permission, setPermission] = useState<Permission>(deviceCalendarAvailable ? 'unknown' : 'denied');
  const [anchor, setAnchor] = useState<MonthAnchor>({ year: t.getFullYear(), month: t.getMonth() });
  const [selected, setSelected] = useState(today);
  const [editorEvent, setEditorEvent] = useState<DeviceEvent | null | undefined>(undefined);
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [quickTask, setQuickTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!deviceCalendarAvailable) return;
    void ensureCalendarPermission().then((granted) => setPermission(granted ? 'granted' : 'denied'));
  }, []);

  const granted = permission === 'granted';
  const { from, to } = monthGridRange(anchor);
  const { data: calendars } = useDeviceCalendars(granted);
  const { data: events, isLoading: eventsLoading } = useDeviceEvents(from, to, granted);
  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const complete = useCompleteTask();
  const reopen = useReopenTask();

  const listById = useMemo(() => new Map((lists ?? []).map((l) => [l.id, l])), [lists]);
  const calendarById = useMemo(() => new Map((calendars ?? []).map((c) => [c.id, c])), [calendars]);

  // Tages-Buckets für Marker + Agenda.
  const eventsByDay = useMemo(() => bucketEventsByDay(events ?? [], from, to), [events, from, to]);
  const openTaskDays = useMemo(() => {
    const set = new Map<string, Task[]>();
    for (const task of tasks ?? []) {
      if (!isOpen(task) || !task.dueDate) continue;
      if (task.dueDate < from || task.dueDate > to) continue;
      const arr = set.get(task.dueDate) ?? [];
      arr.push(task);
      set.set(task.dueDate, arr);
    }
    return set;
  }, [tasks, from, to]);

  const markers = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [day, dayEvents] of eventsByDay) {
      const colorsForDay: string[] = [];
      for (const ev of dayEvents) {
        const c = calendarById.get(ev.calendarId)?.color ?? colors.indigo;
        if (!colorsForDay.includes(c)) colorsForDay.push(c);
      }
      map.set(day, colorsForDay);
    }
    // Erinnerungen als Teal-Punkt (vorn — die eigene App zuerst).
    for (const day of openTaskDays.keys()) {
      map.set(day, [colors.teal, ...(map.get(day) ?? [])]);
    }
    return map;
  }, [eventsByDay, openTaskDays, calendarById, colors.teal, colors.indigo]);

  const dayEvents = eventsByDay.get(selected) ?? [];
  const dayTasks = useMemo(
    () => (openTaskDays.get(selected) ?? []).slice().sort(byTimeThenCreation),
    [openTaskDays, selected],
  );

  const toggle = (task: Task) => (next: boolean) => {
    if (next) complete.mutate(task);
    else reopen.mutate(task.id);
  };

  const writableExists = (calendars ?? []).some((c) => c.allowsModifications);

  // Langes Drücken auf einen Tag: Tag wählen und (wenn möglich) direkt einen
  // neuen Termin für diesen Tag anlegen.
  const handleDayLongPress = (day: string) => {
    hapticSelect();
    setSelected(day);
    if (granted && writableExists) setEditorEvent(null);
  };

  const dayCount = dayEvents.length + dayTasks.length;

  return (
    <Screen>
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: Spacing.xs, flex: 1 }}>
            <Type variant="title">Kalender</Type>
            {/* Ruhige Zähl-Zeile — dieselbe Stimme wie die Tages-Bilanz auf Heute. */}
            <Type variant="caption" tone="text3" tabular>
              {(() => {
                const n = (eventsByDay.get(today)?.length ?? 0) + (openTaskDays.get(today)?.length ?? 0);
                return n === 0 ? 'Heute nichts geplant' : n === 1 ? 'Heute 1 Eintrag' : `Heute ${n} Einträge`;
              })()}
            </Type>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PressableScale
              accessibilityLabel="Rückblick öffnen"
              onPress={() => router.push('/rueckblick')}
              style={{ padding: Spacing.sm }}
            >
              <Images size={21} color={colors.text3} strokeWidth={2} />
            </PressableScale>
            {granted && writableExists && (
              <PressableScale
                accessibilityLabel="Neuer Termin"
                onPress={() => setEditorEvent(null)}
                style={{ padding: Spacing.sm }}
              >
                <CalendarPlus size={22} color={colors.teal} strokeWidth={2.2} />
              </PressableScale>
            )}
          </View>
        </View>
      </Reveal>

      <Reveal delay={80}>
        <GlassPanel>
          <CalendarMonth anchor={anchor} onAnchorChange={setAnchor} selected={selected} onSelect={setSelected} markers={markers} onDayLongPress={handleDayLongPress} />
        </GlassPanel>
      </Reveal>

      <Reveal delay={140}>
        <GlassPanel>
          {/* Kopf: gewählter Tag mit Teal-Akzent — visuell an die Grid-Auswahl gebunden. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              {/* Punkt trägt Teal nur für heute — sonst neutral wie der Text daneben. */}
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: selected === today ? colors.teal : colors.border3 }} />
              <Type variant="eyebrow" tone={selected === today ? 'teal' : 'text3'}>{formatDayHeading(selected, today)}</Type>
            </View>
            {dayCount > 0 && <Type variant="caption" tone="text3" tabular>{dayCount}</Type>}
          </View>

          {/* Inhalt fadet bei jedem Tageswechsel neu ein (Grid ↔ Agenda verbunden). */}
          <Reveal key={selected} delay={0}>
          {/* Termine des Tages */}
          {permission === 'denied' && deviceCalendarAvailable && (
            <EmptyState
              title="Kein Kalenderzugriff"
              body="Erlaube den Zugriff unter iOS-Einstellungen → Stoa → Kalender, dann erscheinen deine Termine hier."
            />
          )}
          {!deviceCalendarAvailable && (
            <Type variant="caption" tone="text3" style={{ marginTop: Spacing.xs }}>
              Gerätekalender sind nur in der App auf dem iPhone verfügbar.
            </Type>
          )}
          {granted && eventsLoading && dayEvents.length === 0 && <LoadingState label="Termine werden geladen…" />}
          {granted && !eventsLoading && dayEvents.length === 0 && dayTasks.length === 0 && (
            <EmptyState icon={<Sun size={20} color={colors.teal} strokeWidth={2} />} body="Nichts geplant an diesem Tag." />
          )}
          {granted && dayEvents.length > 0 && (
            <View style={{ marginTop: Spacing.xs }}>
              {dayEvents.map((ev) => (
                <EventRow
                  key={ev.key}
                  event={ev}
                  calendar={calendarById.get(ev.calendarId)}
                  day={selected}
                  photoCount={photoCounts.get(ev.id) ?? 0}
                  onPress={() => setEditorEvent(ev)}
                />
              ))}
            </View>
          )}

          {/* Erinnerungen des Tages */}
          {dayTasks.length > 0 && (
            <>
              {(dayEvents.length > 0 || permission === 'denied') && <Seam variant="ornament" marginVertical={Spacing.md} />}
              <Type variant="eyebrow" tone="teal">Erinnerungen</Type>
              <View style={{ marginTop: Spacing.xs }}>
                {dayTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    showDue="time-only"
                    list={task.listId !== 'default' ? listById.get(task.listId) : undefined}
                    onToggle={toggle(task)}
                    onPress={() => setEditorTask(task)}
                    onReschedule={() => setRescheduleTask(task)}
                    onLongPress={() => setQuickTask(task)}
                  />
                ))}
              </View>
            </>
          )}
          </Reveal>
        </GlassPanel>
      </Reveal>

      {granted && (
        <Reveal delay={200}>
          <Type variant="caption" tone="text3" style={{ textAlign: 'center' }}>
            Google-, Outlook- oder andere Kalender? In den iOS-Einstellungen unter Apps → Kalender →
            Accounts hinzufügen — sie erscheinen hier automatisch.
          </Type>
        </Reveal>
      )}

      {editorEvent !== undefined && (
        <EventEditorSheet
          event={editorEvent}
          defaultDate={selected}
          calendars={calendars ?? []}
          onClose={() => setEditorEvent(undefined)}
        />
      )}
      {editorTask && <TaskEditorSheet task={editorTask} onClose={() => setEditorTask(null)} />}
      {rescheduleTask && <RescheduleSheet task={rescheduleTask} onClose={() => setRescheduleTask(null)} />}
      {quickTask && <TaskQuickSheet task={quickTask} onClose={() => setQuickTask(null)} />}
    </Screen>
  );
}
