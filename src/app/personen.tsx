// personen.tsx — alle Personen, vollständig.
//
// Der Listen-Tab zeigt seit v1.78.0 nur noch DREI — die, bei denen am meisten
// liegt. Er beantwortet „was liegt bei wem?", und dafür braucht es keine
// vollständige Liste. Hier ist der Ort für die vollständige, mit einem
// Suchfeld, damit man bei vielen Namen nicht scrollen muss.
//
// Bewusst KEIN sechster Tab: man kommt selten hierher, und wenn, dann von der
// Stelle, an der einem die Person gerade fehlt.
import { useRouter } from 'expo-router';
import { ChevronLeft, Search, UserRound } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassPanel } from '@/components/GlassPanel';
import { NeuLink } from '@/components/NeuKnopf';
import { PersonEditorSheet } from '@/components/PersonEditorSheet';
import { PersonZeile } from '@/components/PersonZeile';
import { PressableScale } from '@/components/PressableScale';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Seam } from '@/components/Seam';
import { EmptyState } from '@/components/StateView';
import { Type } from '@/components/Type';
import { usePeople, usePersonenLast } from '@/data/personQueries';
import type { Person } from '@/data/types';
import { hapticSelect } from '@/lib/haptics';
import { filterPersonen } from '@/lib/personen';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

export default function PersonenScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: people } = usePeople();
  const last = usePersonenLast();

  const [suche, setSuche] = useState('');
  // undefined = Sheet zu, null = neue Person, Person = bearbeiten.
  const [editorPerson, setEditorPerson] = useState<Person | null | undefined>(undefined);

  const treffer = useMemo(() => filterPersonen(people ?? [], suche), [people, suche]);
  const gesamt = (people ?? []).length;

  return (
    <Screen withTabBar={false} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
      <Reveal>
        <PressableScale accessibilityLabel="Zurück" onPress={() => router.back()} style={{ padding: Spacing.sm, marginLeft: -Spacing.sm, alignSelf: 'flex-start' }}>
          <ChevronLeft size={24} color={colors.text2} strokeWidth={2} />
        </PressableScale>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
          <UserRound size={24} color={colors.teal} strokeWidth={2.2} />
          <Type variant="title" style={{ flex: 1 }}>Personen</Type>
          <NeuLink label="Neue Person" icon={UserRound} onPress={() => setEditorPerson(null)} />
        </View>
        <Type variant="caption" tone="text3" style={{ marginTop: 2 }} tabular>
          {gesamt === 1 ? '1 Person' : `${gesamt} Personen`}
        </Type>
      </Reveal>

      {/* Erst ab einer Handvoll — darunter ist Suchen langsamer als Schauen. */}
      {gesamt > 5 && (
        <Reveal delay={60}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              borderRadius: R.lg,
              borderWidth: 1,
              borderColor: colors.chipBorder,
              backgroundColor: colors.bg2,
              paddingHorizontal: Spacing.md,
            }}
          >
            <Search size={16} color={colors.text3} strokeWidth={2} />
            <TextInput
              accessibilityLabel="Personen durchsuchen"
              value={suche}
              onChangeText={setSuche}
              placeholder="Name oder Notiz"
              placeholderTextColor={colors.text3}
              style={[{ flex: 1, fontSize: T.md, color: colors.text, paddingVertical: Spacing.sm + 2, minHeight: 24 }, webNoOutline]}
            />
          </View>
        </Reveal>
      )}

      <Reveal delay={90}>
        <GlassPanel>
          {treffer.length === 0 ? (
            <EmptyState
              icon={<UserRound size={20} color={colors.teal} strokeWidth={2} />}
              title={gesamt === 0 ? 'Noch niemand' : 'Niemand mit diesem Namen'}
              body={
                gesamt === 0
                  ? 'Personen entstehen dort, wo sie dir einfallen — in einer Aufgabe, an einem Termin, oder hier oben mit „Neue Person".'
                  : 'Andere Schreibweise? Gesucht wird auch in der Notiz.'
              }
            />
          ) : (
            treffer.map((p, i) => (
              <View key={p.id}>
                {i > 0 && <Seam marginVertical={2} />}
                <PersonZeile
                  person={p}
                  wartend={last.get(p.id)?.wartend ?? 0}
                  offen={last.get(p.id)?.offen ?? 0}
                  onPress={() => router.push(`/person/${p.id}`)}
                  onLongPress={() => {
                    hapticSelect();
                    setEditorPerson(p);
                  }}
                />
              </View>
            ))
          )}
        </GlassPanel>
      </Reveal>

      {editorPerson !== undefined && (
        <PersonEditorSheet person={editorPerson} onClose={() => setEditorPerson(undefined)} />
      )}
    </Screen>
  );
}
