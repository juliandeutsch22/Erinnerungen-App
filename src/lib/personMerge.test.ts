// personMerge.test.ts — der Kitt zwischen den zwei Wegen zu einer Person.
//
// Stoa hat zwei: den schnellen im Aufgaben-/Termin-Editor (nur ein Name) und
// den ausführlichen im Listen-Tab (Nummer, E-Mail, Adressbuch). Der schnelle
// wäre eine Sackgasse, wenn er eine Person erzeugte, die man später nicht mehr
// anreichern kann — oder schlimmer: ein Duplikat, das die offenen Punkte auf
// zwei Ansichten verteilt. Diese Datei prüft, dass beides nicht passiert.
import type { NewPerson, Person } from '@/data/types';

import { findePerson, personNachtrag } from './personMerge';

const person = (p: Partial<Person> & { id: string; name: string }): Person => ({
  note: null,
  phone: null,
  email: null,
  contactId: null,
  sort: 0,
  createdAt: '2026-08-03T09:00:00.000Z',
  ...p,
});

const eingabe = (p: Partial<NewPerson> & { name: string }): NewPerson => ({ ...p });

describe('findePerson', () => {
  const anna = person({ id: 'p1', name: 'Anna' });
  const brandt = person({ id: 'p2', name: 'Herr Brandt', contactId: 'ab-77' });

  it('erkennt denselben Namen ungeachtet Groß-, Klein- und Leerraum', () => {
    expect(findePerson([anna, brandt], eingabe({ name: '  aNNa ' }))?.id).toBe('p1');
  });

  it('findet niemanden, wenn der Name neu ist', () => {
    expect(findePerson([anna, brandt], eingabe({ name: 'Papa' }))).toBeUndefined();
  });

  it('lässt die Adressbuch-Herkunft den Namen schlagen', () => {
    // Derselbe Kontakt, im Adressbuch inzwischen anders geschrieben — es bleibt
    // dieselbe Person, sonst stünde ihr Wartendes plötzlich an zwei Orten.
    const treffer = findePerson([anna, brandt], eingabe({ name: 'Bedachungen Brandt', contactId: 'ab-77' }));
    expect(treffer?.id).toBe('p2');
  });

  it('fällt auf den Namen zurück, wenn die Herkunft unbekannt ist', () => {
    expect(findePerson([anna, brandt], eingabe({ name: 'Anna', contactId: 'ab-neu' }))?.id).toBe('p1');
  });
});

describe('personNachtrag', () => {
  it('reicht nach, was fehlt — der Kern der Sache', () => {
    // Genau der Ablauf, der die zwei Wege verbindet: erst schnell in einer
    // Aufgabe angelegt, Wochen später aus den Kontakten übernommen.
    const schnell = person({ id: 'p1', name: 'Herr Brandt' });
    expect(personNachtrag(schnell, eingabe({ name: 'Herr Brandt', phone: '0176 1234567', email: 'b@dach.example', contactId: 'ab-77' }))).toEqual({
      phone: '0176 1234567',
      email: 'b@dach.example',
      contactId: 'ab-77',
    });
  });

  it('überschreibt NICHTS, was schon dasteht', () => {
    const gepflegt = person({ id: 'p1', name: 'Herr Brandt', phone: '030 111', email: 'alt@dach.example', note: 'Dachdecker' });
    expect(personNachtrag(gepflegt, eingabe({ name: 'Herr Brandt', phone: '0176 999', email: 'neu@dach.example', note: 'Firma' }))).toEqual({});
  });

  it('füllt einzelne Lücken, ohne die gefüllten anzurühren', () => {
    const halb = person({ id: 'p1', name: 'Anna', phone: '030 111' });
    expect(personNachtrag(halb, eingabe({ name: 'Anna', phone: '0176 999', email: 'anna@example.org' }))).toEqual({
      email: 'anna@example.org',
    });
  });

  it('lässt den Namen in Ruhe', () => {
    // „Papa" darf durch einen Import nicht zu „Hans-Jürgen Deutsch" werden.
    const papa = person({ id: 'p1', name: 'Papa', contactId: 'ab-3' });
    expect(personNachtrag(papa, eingabe({ name: 'Hans-Jürgen Deutsch', contactId: 'ab-3' }))).toEqual({});
  });

  it('sagt mit einem leeren Ergebnis, dass nichts zu schreiben ist', () => {
    const anna = person({ id: 'p1', name: 'Anna' });
    expect(personNachtrag(anna, eingabe({ name: 'Anna' }))).toEqual({});
  });
});
