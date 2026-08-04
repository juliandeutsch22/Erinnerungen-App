// PersonEditorSheet.tsx — eine Person anlegen oder pflegen.
//
// Bis v1.74 gab es Personen NUR als Nebenprodukt: man tippte einen Namen in
// einer Aufgabe, einer Notiz oder einem Termin, und dabei entstand einer. Der
// Personen-Abschnitt im Listen-Tab erschien überdies erst, WENN es welche gab —
// ein Henne-Ei-Problem, das den einzigen Weg über die Aufgabe erzwang.
//
// Hier ist der eigenständige Ort dafür: Name, Notiz, Telefon, E-Mail — und der
// Weg ins Adressbuch. Der Import kopiert (siehe `Person.contactId`), er
// verlinkt nicht: was hier steht, gehört danach Stoa und übersteht sowohl eine
// entzogene Berechtigung als auch ein neues iPhone.
import { Trash2, UserRound } from 'lucide-react-native';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { GlassButton } from '@/components/GlassButton';
import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { useCreatePerson, useDeletePerson, useUpdatePerson } from '@/data/personQueries';
import type { Person } from '@/data/types';
import { contactsAvailable, kontaktWaehlen } from '@/lib/contacts';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { webNoOutline } from '@/theme/layout';
import { useColors } from '@/theme/ThemeProvider';
import { R, Spacing, T } from '@/theme/theme.tokens';

export function PersonEditorSheet({
  person,
  onClose,
  onSaved,
}: {
  /** null = neuer Person. */
  person: Person | null;
  onClose: () => void;
  /** Bekommt die angelegte/gesicherte Person — für „gleich zuordnen". */
  onSaved?: (p: Person) => void;
}) {
  const colors = useColors();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const deletePerson = useDeletePerson();

  const [name, setName] = useState(person?.name ?? '');
  const [note, setNote] = useState(person?.note ?? '');
  const [phone, setPhone] = useState(person?.phone ?? '');
  const [email, setEmail] = useState(person?.email ?? '');
  const [contactId, setContactId] = useState<string | null>(person?.contactId ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [holt, setHolt] = useState(false);

  const isEdit = person !== null;
  const canSave = name.trim().length > 0;

  const ausKontakten = async () => {
    hapticSelect();
    setHolt(true);
    const treffer = await kontaktWaehlen();
    setHolt(false);
    if (!treffer) return;
    hapticSuccess();
    // Der Name wird immer übernommen (man hat ihn ja gerade ausgesucht);
    // Nummer und E-Mail nur, wo noch nichts steht — Getipptes gehört dem
    // Nutzer und wird nicht von einem Import überschrieben.
    setName(treffer.name);
    if (treffer.phone && !phone.trim()) setPhone(treffer.phone);
    if (treffer.email && !email.trim()) setEmail(treffer.email);
    setContactId(treffer.contactId);
  };

  const save = () => {
    if (!canSave) return;
    const werte = {
      name: name.trim(),
      note: note.trim() ? note.trim() : null,
      phone: phone.trim() ? phone.trim() : null,
      email: email.trim() ? email.trim() : null,
      contactId,
    };
    if (isEdit) {
      updatePerson.mutate({ id: person.id, patch: werte });
      onSaved?.({ ...person, ...werte });
    } else {
      hapticSuccess();
      createPerson.mutate(werte, { onSuccess: (p) => onSaved?.(p) });
    }
    onClose();
  };

  const feldStil = {
    fontSize: T.md,
    color: colors.text,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    backgroundColor: colors.bg2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  } as const;

  const footer = (
    <View>
      <GlassButton accessibilityLabel={isEdit ? 'Person sichern' : 'Person anlegen'} onPress={save} disabled={!canSave}>
        <Type variant="label" style={{ color: '#FFFFFF' }}>{isEdit ? 'Sichern' : 'Anlegen'}</Type>
      </GlassButton>
      {/* Löschen zweistufig — und ehrlich darüber, was dabei passiert. */}
      {isEdit && (
        <PressableScale
          accessibilityLabel={confirmDelete ? 'Löschen bestätigen' : 'Person löschen'}
          onPress={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            deletePerson.mutate(person.id);
            onClose();
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md }}
        >
          <Trash2 size={16} color={colors.indigo} strokeWidth={2} />
          <Type variant="label" tone="indigo">
            {confirmDelete ? 'Wirklich löschen? Tippe erneut.' : 'Löschen — Aufgaben und Notizen bleiben'}
          </Type>
        </PressableScale>
      )}
    </View>
  );

  return (
    <BottomSheet visible title={isEdit ? 'Person' : 'Neue Person'} onClose={onClose} footer={footer}>
      <View style={{ gap: Spacing.sm }}>
        <TextInput
          accessibilityLabel="Name der Person"
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={colors.text3}
          autoFocus={!isEdit}
          style={[feldStil, webNoOutline]}
        />

        {/* Der Weg ins Adressbuch. Nur dort, wo es eines gibt — im Web fehlt
            das native Modul, und ein Knopf, der nichts tut, ist schlimmer als
            keiner. Apples Auswahl läuft AUSSERHALB der App: es kommt nur der
            eine gewählte Eintrag zurück, kein Zugriff aufs ganze Buch. */}
        {contactsAvailable && (
          <PressableScale
            accessibilityLabel="Aus den Kontakten übernehmen"
            onPress={() => void ausKontakten()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs + 2 }}
          >
            <View style={{ width: 16, alignItems: 'center' }}>
              <UserRound size={16} color={colors.teal} strokeWidth={2.2} />
            </View>
            <Type variant="label" tone="teal">
              {holt ? 'Kontakte öffnen …' : contactId ? 'Anderen Kontakt wählen' : 'Aus den Kontakten übernehmen'}
            </Type>
          </PressableScale>
        )}

        <TextInput
          accessibilityLabel="Telefonnummer"
          value={phone}
          onChangeText={setPhone}
          placeholder="Telefon"
          placeholderTextColor={colors.text3}
          keyboardType="phone-pad"
          style={[feldStil, webNoOutline]}
        />
        <TextInput
          accessibilityLabel="E-Mail-Adresse"
          value={email}
          onChangeText={setEmail}
          placeholder="E-Mail"
          placeholderTextColor={colors.text3}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[feldStil, webNoOutline]}
        />
        <TextInput
          accessibilityLabel="Notiz zur Person"
          value={note}
          onChangeText={setNote}
          placeholder="Notiz (z. B. Dachdecker, über Kollegin)"
          placeholderTextColor={colors.text3}
          style={[feldStil, webNoOutline]}
        />

        {contactId && (
          <Type variant="caption" tone="text3">
            Aus deinen Kontakten übernommen. Name, Nummer und E-Mail liegen ab
            jetzt in Stoa — Änderungen im Adressbuch kommen nicht von selbst an.
          </Type>
        )}
      </View>
    </BottomSheet>
  );
}
