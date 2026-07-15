// filter.tsx — Smart-Filter: Aufgaben nach Tag / Flagge / Zeitraum kombinieren,
// Ergebnis live, und als benannten Filter speichern. Mit ?id=<filterId> wird ein
// gespeicherter Filter geladen.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bookmark, BookmarkCheck, ChevronLeft, Flag, Trash2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { GlassButton } from '@/components/GlassButton';
import { GlassPanel } from '@/components/GlassPanel';
import { PressableScale } from '@/components/PressableScale';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState } from '@/components/StateView';
import { TaskEditorSheet } from '@/components/TaskEditorSheet';
import { TaskQuickSheet } from '@/components/TaskQuickSheet';
import { TaskRow } from '@/components/TaskRow';
import { Type } from '@/components/Type';
import { useCompleteTask, useLists, useReopenTask, useTasks } from '@/data/queries';
import type { Task } from '@/data/types';
import { newId } from '@/data/types';
import { todayStr } from '@/lib/dates';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { applyFilter, emptyFilter, type FilterRange, tagCounts } from '@/lib/taskFilters';
import { webNoOutline } from '@/theme/layout';
import { useSettings } from '@/theme/settings.store';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

const RANGES: { value: FilterRange; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'today', label: 'Heute' },
  { value: 'week', label: 'Diese Woche' },
  { value: 'overdue', label: 'Überfällig' },
  { value: 'undated', label: 'Ohne Datum' },
];

export default function FilterScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const router = useRouter();
  const today = todayStr();

  const { data: tasks } = useTasks();
  const { data: lists } = useLists();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const savedFilters = useSettings((s) => s.savedFilters);
  const addSavedFilter = useSettings((s) => s.addSavedFilter);
  const removeSavedFilter = useSettings((s) => s.removeSavedFilter);

  const saved = savedFilters.find((f) => f.id === id);
  const [tags, setTags] = useState<string[]>(saved?.tags ?? []);
  const [flagged, setFlagged] = useState(saved?.flagged ?? false);
  const [range, setRange] = useState<FilterRange>(saved?.range ?? 'all');
  const [includeCompleted, setIncludeCompleted] = useState(saved?.includeCompleted ?? false);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(saved?.name ?? '');

  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [quickTask, setQuickTask] = useState<Task | null>(null);

  const criteria = { tags, flagged, range, includeCompleted };
  const results = useMemo(() => applyFilter(tasks ?? [], criteria, today), [tasks, tags, flagged, range, includeCompleted, today]);
  const allTags = useMemo(() => tagCounts(tasks ?? []), [tasks]);
  const listById = useMemo(() => new Map((lists ?? []).map((l) => [l.id, l])), [lists]);

  const isActive = tags.length > 0 || flagged || range !== 'all' || includeCompleted;

  const toggle = (task: Task) => (next: boolean) => {
    if (next) complete.mutate(task);
    else reopen.mutate(task.id);
  };

  const saveFilter = () => {
    const name = nameDraft.trim();
    if (!name) return;
    addSavedFilter({ id: newId(), name, tags, flagged, range, includeCompleted });
    hapticSuccess();
    setNaming(false);
  };

  return (
    // Tastatur-Insets: das „Name des Filters"-Feld liegt unter den Kriterien —
    // bei offener Tastatur muss es sichtbar bleiben (scrollt automatisch mit).
    <Screen withTabBar={false} automaticallyAdjustKeyboardInsets>
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm, marginLeft: -Spacing.sm }}>
            <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
          </PressableScale>
          {saved && (
            <PressableScale
              accessibilityLabel="Filter löschen"
              onPress={() => {
                removeSavedFilter(saved.id);
                router.back();
              }}
              style={{ padding: Spacing.sm }}
            >
              <Trash2 size={18} color={colors.text3} strokeWidth={2} />
            </PressableScale>
          )}
        </View>
        <Type variant="title" style={{ marginTop: Spacing.xs }}>{saved?.name ?? 'Filter'}</Type>
        <Type variant="caption" tone="text3" style={{ marginTop: 2 }} tabular>
          {results.length === 1 ? '1 Treffer' : `${results.length} Treffer`}
        </Type>
      </Reveal>

      {/* Kriterien */}
      <Reveal delay={70}>
        <GlassPanel>
          <Type variant="label" tone="text2">Zeitraum</Type>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm }}>
            {RANGES.map((r) => (
              <Chip key={r.value} label={r.label} active={range === r.value} onPress={() => setRange(r.value)} />
            ))}
          </View>

          {allTags.length > 0 && (
            <>
              <Seam />
              <Type variant="label" tone="text2">Tags</Type>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm }}>
                {allTags.map(({ tag, count }) => (
                  <Chip
                    key={tag}
                    label={`#${tag} · ${count}`}
                    active={tags.includes(tag)}
                    onPress={() => setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]))}
                  />
                ))}
              </View>
            </>
          )}

          <Seam />
          <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
            <Chip label="Nur Flagge" icon={Flag} active={flagged} onPress={() => setFlagged((v) => !v)} />
            <Chip label="Erledigte zeigen" active={includeCompleted} onPress={() => setIncludeCompleted((v) => !v)} />
          </View>

          {/* Speichern */}
          {!saved && (
            <>
              <Seam />
              {naming ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    placeholder="Name des Filters"
                    placeholderTextColor={colors.text3}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={saveFilter}
                    accessibilityLabel="Name des Filters"
                    style={[{ flex: 1, fontSize: T.md, color: colors.text, borderBottomWidth: 1, borderColor: colors.border2, paddingVertical: Spacing.xs }, webNoOutline]}
                  />
                  <GlassButton size="sm" accessibilityLabel="Filter sichern" onPress={saveFilter} disabled={!nameDraft.trim()}>
                    <Type variant="label" style={{ color: '#FFFFFF' }}>Sichern</Type>
                  </GlassButton>
                </View>
              ) : (
                <PressableScale
                  accessibilityLabel="Als Filter speichern"
                  onPress={() => {
                    if (!isActive) return;
                    hapticSelect();
                    setNaming(true);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, opacity: isActive ? 1 : 0.4 }}
                >
                  <Bookmark size={18} color={colors.teal} strokeWidth={2} />
                  <Type variant="label" tone="teal">Als Filter speichern</Type>
                </PressableScale>
              )}
            </>
          )}
          {saved && (
            <>
              <Seam />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <BookmarkCheck size={18} color={colors.teal} strokeWidth={2} />
                <Type variant="label" tone="text3">Gespeicherter Filter</Type>
              </View>
            </>
          )}
        </GlassPanel>
      </Reveal>

      {/* Ergebnis */}
      <Reveal delay={130}>
        <GlassPanel>
          {results.length === 0 ? (
            <EmptyState title="Keine Treffer" body="Passe die Kriterien an, um Aufgaben zu finden." />
          ) : (
            <View>
              {results.map((t) => (
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
              ))}
            </View>
          )}
        </GlassPanel>
      </Reveal>

      {editorTask && <TaskEditorSheet task={editorTask} onClose={() => setEditorTask(null)} />}
      {rescheduleTask && <RescheduleSheet task={rescheduleTask} onClose={() => setRescheduleTask(null)} />}
      {quickTask && <TaskQuickSheet task={quickTask} onClose={() => setQuickTask(null)} />}
    </Screen>
  );
}
