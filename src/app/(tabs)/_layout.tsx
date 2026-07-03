import { Tabs } from 'expo-router';
import React from 'react';

import { GlassTabBar } from '@/components/GlassTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tabs.Screen name="heute" options={{ title: 'Heute' }} />
      <Tabs.Screen name="listen" options={{ title: 'Listen' }} />
      <Tabs.Screen name="suche" options={{ title: 'Suche' }} />
    </Tabs>
  );
}
