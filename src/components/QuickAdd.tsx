// QuickAdd.tsx — die immer erreichbare Eingabezeile („Was liegt an?"), als
// Glass-Pill über der Tab-Bar (Fahrplan §3.4/§4). Deutscher Mini-Parser:
// erkannte Teile erscheinen als entfernbare Chips, Return legt die Aufgabe an —
// der Screen wechselt nicht, der Fokus bleibt.
import { CalendarDays, Clock, Plus, Repeat, X } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useCreateTask } from '@/data/queries';
import { DEFAULT_LIST_ID } from '@/data/ListRepository';
import { formatDueDate, todayStr } from '@/lib/dates';
import { hapticSuccess } from '@/lib/haptics';
import { parseQuickAdd } from '@/lib/quickAddParser';
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

type Removed = { date: boolean; time: boolean; rrule: boolean };
const NOTHING_REMOVED: Removed = { date: false, time: false, rrule: false };

export function QuickAdd({ listId = DEFAULT_LIST_ID }: { listId?: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const createTask = useCreateTask();
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState('');
  const [removed, setRemoved] = useState<Removed>(NOTHING_REMOVED);

  const today = todayStr();
  const parsed = useMemo(() => parseQuickAdd(text, today), [text, today]);
  const dueDate = removed.date ? null : parsed.dueDate;
  const dueTime = removed.date || removed.time ? null : parsed.dueTime;
  const rrule = removed.date || removed.rrule ? null : parsed.rrule;

  const submit = () => {
    const title = parsed.title;
    if (!title) return;
    createTask.mutate({ listId, title, dueDate, dueTime, rrule });
    hapticSuccess();
    setText('');
    setRemoved(NOTHING_REMOVED);
    // Fokus behalten — nächster Gedanke sofort rein (unter 3 Sekunden).
    inputRef.current?.focus();
  };

  const chips: { key: keyof Removed; icon: typeof Clock; label: string }[] = [];
  if (dueDate) chips.push({ key: 'date', icon: CalendarDays, label: formatDueDate(dueDate, today) });
  if (dueTime) chips.push({ key: 'time', icon: Clock, label: dueTime });
  if (rrule) chips.push({ key: 'rrule', icon: Repeat, label: RRULE_LABEL[rrule] });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'position' : undefined}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
    >
      <View
        pointerEvents="box-none"
        style={{
          alignItems: 'center',
          paddingHorizontal: Spacing.lg,
          // Direkt über der schwebenden Tab-Bar parken.
          paddingBottom: Math.max(insets.bottom, Spacing.md) + TAB_BAR_HEIGHT + Spacing.sm,
        }}
      >
        <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: Spacing.xs }}>
          {chips.length > 0 && (
            <View style={{ flexDirection: 'row', gap: Spacing.xs, justifyContent: 'flex-start', paddingLeft: Spacing.sm }}>
              {chips.map((c) => (
                <PressableScale
                  key={c.key}
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
              ))}
            </View>
          )}
          <Glass
            variant="pill"
            intensity={85}
            style={Shadow.md}
            contentStyle={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              paddingVertical: Spacing.sm + 2,
              paddingHorizontal: Spacing.md,
            }}
          >
            <Plus size={18} color={colors.text3} strokeWidth={2.2} />
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (v.length === 0) setRemoved(NOTHING_REMOVED);
              }}
              placeholder="Was liegt an?"
              placeholderTextColor={colors.text3}
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={submit}
              accessibilityLabel="Schnell hinzufügen"
              style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: 2 }, webNoOutline]}
            />
            {text.trim().length > 0 && (
              <PressableScale
                accessibilityLabel="Aufgabe anlegen"
                onPress={submit}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: R.pill,
                  backgroundColor: colors.teal,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={17} color="#FFFFFF" strokeWidth={2.6} />
              </PressableScale>
            )}
          </Glass>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
