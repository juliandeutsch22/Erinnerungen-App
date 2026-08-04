// personen.test.ts — der Kitt zwischen den zwei Wegen zu einer Person.
//
// Stoa hat zwei: den schnellen im Aufgaben-/Termin-Editor (nur ein Name) und
// den ausführlichen im Listen-Tab (Nummer, E-Mail, Adressbuch). Der schnelle
// wäre eine Sackgasse, wenn er eine Person erzeugte, die man später nicht mehr
// anreichern kann — oder schlimmer: ein Duplikat, das die offenen Punkte auf
// zwei Ansichten verteilt. Diese Datei prüft, dass beides nicht passiert.
import type { NewPerson, Person } from '@/data/types';

import { filterPersonen, findePerson, kuerzePersonen, ordnePersonen, personNachtrag } from './personen';

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

describe('filterPersonen', () => {
  const alle = [
    person({ id: 'p1', name: 'Anna Meier', note: 'Kollegin' }),
    person({ id: 'p2', name: 'Herr Brandt', note: 'Dachdecker' }),
    person({ id: 'p3', name: 'Papa' }),
  ];

  it('gibt ohne Suche alle zurück', () => {
    expect(filterPersonen(alle, '   ')).toHaveLength(3);
  });

  it('findet mitten im Namen und ohne Rücksicht auf Groß/Klein', () => {
    expect(filterPersonen(alle, 'BRAND').map((p) => p.id)).toEqual(['p2']);
    expect(filterPersonen(alle, 'meier').map((p) => p.id)).toEqual(['p1']);
  });

  it('findet auch über die Notiz — man weiß oft nur, WAS jemand ist', () => {
    expect(filterPersonen(alle, 'dachdecker').map((p) => p.id)).toEqual(['p2']);
  });

  it('kommt mit einer Person ohne Notiz klar', () => {
    expect(filterPersonen(alle, 'papa').map((p) => p.id)).toEqual(['p3']);
  });

  it('gibt nichts zurück, wenn nichts passt — das ist das Signal zum Anlegen', () => {
    expect(filterPersonen(alle, 'Zlatan')).toEqual([]);
  });
});

describe('kuerzePersonen', () => {
  const viele = Array.from({ length: 10 }, (_, i) => person({ id: `p${i}`, name: `Person ${i}` }));

  it('lässt kurze Listen unangetastet', () => {
    const [gezeigt, versteckt] = kuerzePersonen(viele.slice(0, 4), new Set(), 6);
    expect(gezeigt).toHaveLength(4);
    expect(versteckt).toBe(0);
  });

  it('kürzt und sagt, wie viele fehlen', () => {
    const [gezeigt, versteckt] = kuerzePersonen(viele, new Set(), 6);
    expect(gezeigt.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
    expect(versteckt).toBe(4);
  });

  it('zeigt Gewählte IMMER — sonst könnte man sie nicht mehr lösen', () => {
    // p9 steht weit hinten und wäre weggekürzt worden.
    const [gezeigt, versteckt] = kuerzePersonen(viele, new Set(['p9']), 6);
    expect(gezeigt.map((p) => p.id)).toContain('p9');
    expect(gezeigt).toHaveLength(7);
    expect(versteckt).toBe(3);
  });

  it('zählt eine Gewählte nicht doppelt, wenn sie ohnehin vorn steht', () => {
    const [gezeigt, versteckt] = kuerzePersonen(viele, new Set(['p1']), 6);
    expect(gezeigt).toHaveLength(6);
    expect(versteckt).toBe(4);
  });
});

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

describe('ordnePersonen', () => {
  const anna = person({ id: 'p1', name: 'Anna', createdAt: '2026-01-01T00:00:00.000Z' });
  const brandt = person({ id: 'p2', name: 'Brandt', createdAt: '2026-02-01T00:00:00.000Z' });
  const papa = person({ id: 'p3', name: 'Papa', createdAt: '2026-03-01T00:00:00.000Z' });
  const alle = [anna, brandt, papa];

  it('stellt die jüngste nach vorn, wenn bei niemandem etwas liegt', () => {
    // Sonst wäre eine gerade angelegte Person hinter allen älteren — und damit
    // hinter der Kürzungsgrenze. Man legt sie an und sie ist weg.
    expect(ordnePersonen(alle, new Map()).map((p) => p.id)).toEqual(['p3', 'p2', 'p1']);
  });

  it('holt trotzdem nach vorn, bei wem etwas liegt', () => {
    const last = new Map([['p1', { wartend: 0, offen: 2 }]]);
    expect(ordnePersonen(alle, last).map((p) => p.id)).toEqual(['p1', 'p3', 'p2']);
  });

  it('wiegt Wartendes schwerer als Offenes — daran arbeitet man selbst nicht', () => {
    const last = new Map([
      ['p1', { wartend: 0, offen: 9 }],
      ['p2', { wartend: 1, offen: 0 }],
    ]);
    expect(ordnePersonen(alle, last).map((p) => p.id)).toEqual(['p2', 'p1', 'p3']);
  });

  it('entscheidet Gleichstand nach dem Alter', () => {
    const last = new Map([
      ['p1', { wartend: 1, offen: 0 }],
      ['p2', { wartend: 1, offen: 0 }],
    ]);
    expect(ordnePersonen(alle, last).map((p) => p.id)).toEqual(['p2', 'p1', 'p3']);
  });
});
