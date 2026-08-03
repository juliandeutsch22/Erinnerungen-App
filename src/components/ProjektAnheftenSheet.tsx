// ProjektAnheftenSheet.tsx — „Vorhandenes anheften": bestehende Notizen und
// Chats einem Projekt zuordnen (Tippen heftet an/löst, das Sheet bleibt offen —
// man sieht sofort, was dazugehört).
//
// Das Gegenstück zu „Neue Notiz" / „Assistent fragen" auf dem Projekt-Screen:
// dort entsteht etwas NEUES, das schon zugeordnet ist; hier zieht man etwas
// hinzu, das es längst gibt. Beide Wege sind nötig — sonst müsste man eine alte
// Notiz abschreiben, nur damit sie am richtigen Ort liegt.
//
// Warum Zuordnung statt Ordner: siehe `Note.listId` in data/types.ts.
import { Check } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { PressableScale } from '@/components/PressableScale';
import { Group, RowDivider } from '@/components/SheetParts';
import { Type } from '@/components/Type';
import { useChats, useUpdateChat } from '@/data/chatQueries';
import { useNotes, useUpdateNote } from '@/data/noteQueries';
import { hapticSelect } from '@/lib/haptics';
import { noteTitle } from '@/lib/noteLogic';
import { useSettings } from '@/theme/settings.store';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

/** So viele stehen zur Auswahl — genug für den Alltag, kurz genug fürs Sheet. */
const MAX = 30;

export function ProjektAnheftenSheet({ listId, onClose }: { listId: string; onClose: () => void }) {
  const colors = useColors();
  const { data: notes } = useNotes();
  const { data: chats } = useChats();
  const updateNote = useUpdateNote();
  const updateChat = useUpdateChat();
  const hasKey = useSettings((s) => s.geminiApiKey.length > 0);

  // Zuerst, was schon dazugehört — sonst müsste man zum Lösen erst suchen.
  const auswahlNotizen = useMemo(() => {
    const aktiv = (notes ?? []).filter((n) => n.deletedAt === null);
    return [...aktiv].sort((a, b) => Number(b.listId === listId) - Number(a.listId === listId)).slice(0, MAX);
  }, [notes, listId]);

  const auswahlChats = useMemo(() => {
    const aktiv = (chats ?? []).filter((c) => c.deletedAt === null);
    return [...aktiv].sort((a, b) => Number(b.listId === listId) - Number(a.listId === listId)).slice(0, MAX);
  }, [chats, listId]);

  return (
    <BottomSheet visible title="Anheften" onClose={onClose}>
      <Type variant="eyebrow" tone="text3" style={{ marginBottom: Spacing.xs }}>Notizen</Type>
      {auswahlNotizen.length === 0 ? (
        <Type variant="caption" tone="text3">Noch keine Notizen.</Type>
      ) : (
        <Group>
          {auswahlNotizen.map((n, i) => {
            const dran = n.listId === listId;
            return (
              <React.Fragment key={n.id}>
                {i > 0 && <RowDivider />}
                <PressableScale
                  accessibilityLabel={`Notiz „${noteTitle(n.body)}" ${dran ? 'lösen' : 'anheften'}`}
                  onPress={() => {
                    hapticSelect();
                    updateNote.mutate({ id: n.id, patch: { listId: dran ? null : listId } });
                  }}
                  pressedScale={0.99}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md }}
                >
                  <Type variant="body" numberOfLines={1} style={{ flex: 1 }}>{noteTitle(n.body)}</Type>
                  {dran && <Check size={18} color={colors.teal} strokeWidth={2.4} />}
                </PressableScale>
              </React.Fragment>
            );
          })}
        </Group>
      )}

      {/* Chats nur mit Schlüssel — ohne Assistent gibt es sie schlicht nicht. */}
      {hasKey && (
        <>
          <Type variant="eyebrow" tone="text3" style={{ marginTop: Spacing.lg, marginBottom: Spacing.xs }}>Chats</Type>
          {auswahlChats.length === 0 ? (
            <Type variant="caption" tone="text3">Noch keine Chats.</Type>
          ) : (
            <Group>
              {auswahlChats.map((c, i) => {
                const dran = c.listId === listId;
                return (
                  <React.Fragment key={c.id}>
                    {i > 0 && <RowDivider />}
                    <PressableScale
                      accessibilityLabel={`Chat „${c.title}" ${dran ? 'lösen' : 'anheften'}`}
                      onPress={() => {
                        hapticSelect();
                        updateChat.mutate({ id: c.id, patch: { listId: dran ? null : listId } });
                      }}
                      pressedScale={0.99}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md }}
                    >
                      <Type variant="body" numberOfLines={1} style={{ flex: 1 }}>{c.title}</Type>
                      {dran && <Check size={18} color={colors.teal} strokeWidth={2.4} />}
                    </PressableScale>
                  </React.Fragment>
                );
              })}
            </Group>
          )}
        </>
      )}

      <View style={{ height: Spacing.sm }} />
    </BottomSheet>
  );
}
