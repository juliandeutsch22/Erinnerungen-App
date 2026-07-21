// aufgabe/[id].tsx — Deep-Link-Ziel für Notifications (Fahrplan §3.5):
// öffnet die Aufgabe direkt im Editor-Sheet über dem Heute-Kontext.
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { Backdrop } from '@/components/Backdrop';
import { TaskEditorSheet } from '@/components/TaskEditorSheet';
import { useTasks } from '@/data/queries';

export default function AufgabeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: tasks, isLoading } = useTasks();
  const task = useMemo(() => (tasks ?? []).find((t) => t.id === id) ?? null, [tasks, id]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/heute');
  };

  // Aufgabe existiert nicht (mehr) → zurück zur Übersicht.
  const missing = !isLoading && !task;
  useEffect(() => {
    if (missing) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      {task && <TaskEditorSheet task={task} onClose={close} />}
    </View>
  );
}
