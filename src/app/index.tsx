// index.tsx — Einstieg: direkt in den Heute-Tab (kein Onboarding, ein Nutzer).
import { Redirect } from 'expo-router';
import React from 'react';

export default function Index() {
  return <Redirect href="/heute" />;
}
