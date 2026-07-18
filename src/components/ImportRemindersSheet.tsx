// ImportRemindersSheet.tsx — einmaliger Import aus Apple Erinnerungen:
// Listen (mit Anzahl offener Erinnerungen) wählen → jede Apple-Liste wird
// zu einer App-Liste (Namens-Match, sonst neu), offene Erinnerungen werden
// Aufgaben. Rein lesend; bereits importierte IDs (settings.store) werden
// übersprungen — der Import ist beliebig wiederholbar.
import { Check, CloudDownload } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { GlassButton } from '@/components/GlassButton';
import { PressableScale } from '@/components/PressableScale';
import { Group, RowDivider } from '@/components/SheetParts';
import { Type } from '@/components/Type';
import { LoadingState } from '@/components/StateView';
import { getListRepository, getTaskRepository } from '@/data';
import { queryKeys, useLists } from '@/data/queries';
import type { List, Task } from '@/data/types';
import { newId } from '@/data/types';
import {
  deviceRemindersAvailable,
  ensureRemindersPermission,
  getOpenRemindersByList,
  type RawReminder,
  type ReminderList,
} from '@/lib/deviceReminders';
import { mapReminder, nearestListColor } from '@/lib/importReminders';
import { hapticSuccess } from '@/lib/haptics';
import { requestReschedule } from '@/lib/notifications';
import { useSettings } from '@/theme/settings.store';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';
import { useQueryClient } from '@tanstack/react-query';

type Phase = 'loading' | 'denied' | 'ready' | 'importing' | 'done';
type Bucket = { list: ReminderList; reminders: RawReminder[] };

export function ImportRemindersSheet({ onClose }: { onClose: () => void }) {
  const colors = useColors();
  const qc = useQueryClient();
  const { data: appLists } = useLists();
  const importedIds = useSettings((s) => s.importedReminderIds);
  const addImportedReminderIds = useSettings((s) => s.addImportedReminderIds);

  const [phase, setPhase] = useState<Phase>('loading');
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState('');

  useEffect(() => {
    void (async () => {
      const granted = await ensureRemindersPermission();
      if (!granted) {
        setPhase('denied');
        return;
      }
      const all = await getOpenRemindersByList();
      const done = new Set(importedIds);
      const fresh = all
        .map((b) => ({ ...b, reminders: b.reminders.filter((r) => !done.has(r.id)) }))
        .filter((b) => b.reminders.length > 0);
      setBuckets(fresh);
      setSelected(new Set(fresh.map((b) => b.list.id)));
      setPhase('ready');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(
    () => buckets.filter((b) => selected.has(b.list.id)).reduce((n, b) => n + b.reminders.length, 0),
    [buckets, selected],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runImport = async () => {
    if (phase !== 'ready' || total === 0) return;
    setPhase('importing');
    const listRepo = getListRepository();
    const taskRepo = getTaskRepository();
    const byName = new Map((appLists ?? []).map((l) => [l.name.trim().toLowerCase(), l]));
    const now = new Date();
    let createdLists = 0;
    let createdTasks = 0;
    let lossy = 0;
    const doneIds: string[] = [];

    for (const bucket of buckets) {
      if (!selected.has(bucket.list.id)) continue;
      // Ziel-Liste: Namens-Match (auch „Erinnerungen" → Standardliste), sonst neu.
      let target: List | undefined = byName.get(bucket.list.title.trim().toLowerCase());
      if (!target) {
        target = {
          id: newId(),
          name: bucket.list.title.trim(),
          icon: 'inbox',
          color: nearestListColor(bucket.list.color),
          goal: null,
          deadline: null,
          sort: now.getTime() + createdLists,
          createdAt: now.toISOString(),
        };
        await listRepo.create(target);
        byName.set(target.name.toLowerCase(), target);
        createdLists += 1;
      }
      for (const r of bucket.reminders) {
        const mapped = mapReminder(r, target.id);
        if (mapped.lossyRecurrence) lossy += 1;
        const task: Task = {
          id: newId(),
          listId: mapped.task.listId,
          title: mapped.task.title,
          note: mapped.task.note ?? null,
          dueDate: mapped.task.dueDate ?? null,
          dueTime: mapped.task.dueTime ?? null,
          rrule: mapped.task.rrule ?? null,
          flagged: false,
          eventId: null,
          completedAt: null,
          notificationId: null,
          tags: [],
          subtasks: [],
          createdAt: now.toISOString(),
          sort: now.getTime() + createdTasks,
        };
        await taskRepo.create(task);
        doneIds.push(mapped.reminderId);
        createdTasks += 1;
      }
    }

    addImportedReminderIds(doneIds);
    await qc.invalidateQueries({ queryKey: queryKeys.tasks });
    await qc.invalidateQueries({ queryKey: queryKeys.lists });
    requestReschedule();
    hapticSuccess();
    setSummary(
      `${createdTasks} ${createdTasks === 1 ? 'Erinnerung' : 'Erinnerungen'} importiert` +
        (createdLists > 0 ? `, ${createdLists} ${createdLists === 1 ? 'Liste' : 'Listen'} neu angelegt` : '') +
        (lossy > 0 ? `. ${lossy} komplexe Wiederholungsregel${lossy === 1 ? '' : 'n'} (z. B. „alle 2 Wochen") wurden als einmalig übernommen — bei Bedarf in der Aufgabe neu setzen.` : '.'),
    );
    setPhase('done');
  };

  const footer =
    phase === 'ready' && buckets.length > 0 ? (
      <GlassButton accessibilityLabel="Import starten" onPress={() => void runImport()} disabled={total === 0}>
        <CloudDownload size={17} color="#FFFFFF" strokeWidth={2.2} />
        <Type variant="label" style={{ color: '#FFFFFF' }}>
          {total === 1 ? '1 Erinnerung importieren' : `${total} Erinnerungen importieren`}
        </Type>
      </GlassButton>
    ) : undefined;

  return (
    <BottomSheet visible title="Aus Apple Erinnerungen" onClose={onClose} footer={footer}>
      {!deviceRemindersAvailable && (
        <Type variant="body" tone="text2">Der Import ist nur in der App auf dem iPhone verfügbar.</Type>
      )}
      {phase === 'loading' && <LoadingState label="Erinnerungen werden gelesen…" />}
      {phase === 'importing' && <LoadingState label="Import läuft…" />}
      {phase === 'denied' && (
        <Type variant="body" tone="text2">
          Kein Zugriff auf Apple Erinnerungen. Erlaube ihn unter iOS-Einstellungen → Stoa → Erinnerungen
          und öffne den Import erneut.
        </Type>
      )}
      {phase === 'ready' && buckets.length === 0 && (
        <Type variant="body" tone="text2">
          Nichts zu importieren — alle offenen Apple-Erinnerungen sind bereits übernommen.
        </Type>
      )}
      {phase === 'ready' && buckets.length > 0 && (
        <>
          <Type variant="caption" tone="text3" style={{ marginBottom: Spacing.sm }}>
            Wähle die Listen. Deine Apple-Erinnerungen bleiben unverändert; bereits Importiertes wird
            übersprungen.
          </Type>
          <Group>
            {buckets.map((b, i) => {
              const on = selected.has(b.list.id);
              return (
                <View key={b.list.id}>
                  {i > 0 && <RowDivider />}
                  <PressableScale
                    accessibilityLabel={`Liste ${b.list.title} ${on ? 'abwählen' : 'auswählen'}`}
                    onPress={() => toggle(b.list.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: nearestListColor(b.list.color) }} />
                    <View style={{ flex: 1 }}>
                      <Type variant="body">{b.list.title}</Type>
                      <Type variant="caption" tone="text3" tabular>
                        {b.reminders.length === 1 ? '1 offene Erinnerung' : `${b.reminders.length} offene Erinnerungen`}
                      </Type>
                    </View>
                    {on && <Check size={17} color={colors.teal} strokeWidth={2.4} />}
                  </PressableScale>
                </View>
              );
            })}
          </Group>
        </>
      )}
      {phase === 'done' && (
        <>
          <Type variant="body" tone="text2">{summary}</Type>
          <GlassButton
            size="sm"
            accessibilityLabel="Import schließen"
            onPress={onClose}
            style={{ marginTop: Spacing.md, alignSelf: 'flex-start' }}
          >
            <Type variant="label" style={{ color: '#FFFFFF' }}>Fertig</Type>
          </GlassButton>
        </>
      )}
    </BottomSheet>
  );
}
