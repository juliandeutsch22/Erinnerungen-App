// inputRoute.test.ts — die Weiche der EINEN Zeile.
//
// Der teuerste Fehler wäre hier NICHT, eine Frage für eine Aufgabe zu halten
// (dann steht eine seltsame Aufgabe da, ein Tipp auf Rückgängig genügt),
// sondern jede harmlose Notiz an den Assistenten zu schicken: das kostet
// Wartezeit und Kontingent für etwas, das der Parser in Mikrosekunden kann.
// Deshalb prüft die Mehrzahl der Fälle hier, dass etwas LOKAL bleibt.
import type { Task } from '@/data/types';

import { routeInput, warteText, WURF_LAENGE, zeileVorschlaege } from './inputRoute';

const TODAY = '2026-07-28';
const route = (s: string, mitAssistent = true) => routeInput(s, TODAY, mitAssistent);

describe('routeInput — was lokal bleibt', () => {
  it('gewöhnliche Erfassungen gehen nie an den Assistenten', () => {
    for (const s of [
      'Milch kaufen',
      'Zahnarzt morgen 10 Uhr',
      'Müll rausbringen',
      'Anna anrufen wegen Geschenk',
      'Miete am 1. jeden Monat',
      'Reifen wechseln #auto',
    ]) {
      expect(route(s).ziel).toBe('lokal');
    }
  });

  it('ein Verb am ENDE ist eine Notiz, kein Auftrag', () => {
    // „Zahnarzt verschieben" schreibt man sich auf. „Verschieb den Zahnarzt"
    // sagt man der App. Der deutsche Imperativ steht vorn — daran hängt die
    // ganze Unterscheidung.
    expect(route('Zahnarzt verschieben').ziel).toBe('lokal');
    expect(route('Altpapier entsorgen').ziel).toBe('lokal');
    expect(route('Rechnung prüfen und löschen').ziel).toBe('lokal');
  });

  it('ohne Schlüssel bleibt ALLES lokal — die Zeile darf nie vom Netz abhängen', () => {
    expect(route('Was steht morgen an?', false).ziel).toBe('lokal');
    expect(route('Verschieb den Zahnarzt auf Freitag', false).ziel).toBe('lokal');
    expect(route('a'.repeat(WURF_LAENGE + 50), false).ziel).toBe('lokal');
  });
});

describe('routeInput — was an den Assistenten geht', () => {
  it('Fragen', () => {
    expect(route('Was steht morgen an?')).toEqual({ ziel: 'assistent', grund: 'frage' });
    expect(route('Wann ist der Zahnarzt')).toEqual({ ziel: 'assistent', grund: 'frage' });
    // Auch ohne Fragewort: das Fragezeichen genügt.
    expect(route('Habe ich noch Milch besorgt?')).toEqual({ ziel: 'assistent', grund: 'frage' });
  });

  it('Aufträge an Bestehendem', () => {
    expect(route('Verschieb den Zahnarzt auf Freitag')).toEqual({ ziel: 'assistent', grund: 'auftrag' });
    expect(route('Hak die drei Einkäufe ab')).toEqual({ ziel: 'assistent', grund: 'auftrag' });
    expect(route('Zeig mir alles zu Umzug')).toEqual({ ziel: 'assistent', grund: 'auftrag' });
  });

  it('ein ganzer Wurf — mehrzeilig oder lang', () => {
    expect(route('Milch kaufen\nZahnarzt anrufen')).toEqual({ ziel: 'assistent', grund: 'wurf' });
    const lang = route('x '.repeat(WURF_LAENGE));
    expect(lang).toEqual({ ziel: 'assistent', grund: 'wurf' });
  });

  it('bleibt kein Titel übrig, gäbe es nichts anzulegen', () => {
    expect(route('morgen 10 Uhr')).toEqual({ ziel: 'assistent', grund: 'kein-titel' });
  });
});

describe('routeInput — die lokale Aufgabe kommt fertig zurück', () => {
  it('reicht das Parser-Ergebnis durch, statt es später neu zu rechnen', () => {
    const r = route('Zahnarzt morgen 10:00');
    expect(r.ziel).toBe('lokal');
    if (r.ziel !== 'lokal') return;
    expect(r.aufgabe.title).toBe('Zahnarzt');
    expect(r.aufgabe.dueDate).toBe('2026-07-29');
    expect(r.aufgabe.dueTime).toBe('10:00');
  });
});

describe('warteText', () => {
  it('sagt, was gerade passiert — nicht bloß „lädt"', () => {
    expect(warteText('frage')).toBe('Sehe nach …');
    expect(warteText('wurf')).toBe('Sortiere …');
    expect(warteText('auftrag')).toBe('Einen Moment …');
  });
});

describe('zeileVorschlaege', () => {
  const today = '2026-07-28';
  const t = (over: Partial<Task>): Task => ({
    id: Math.random().toString(36).slice(2),
    listId: 'default',
    title: 'X',
    note: null,
    dueDate: null,
    dueTime: null,
    rrule: null,
    startDate: null,
    expiresOn: null,
    evening: false,
    flagged: false,
    eventId: null,
    completedAt: null,
    notificationId: null,
    tags: [],
    subtasks: [],
    createdAt: '',
    sort: 0,
    ...over,
  });

  it('nennt Überfälliges nur, wenn wirklich etwas überfällig ist', () => {
    expect(zeileVorschlaege([t({ dueDate: '2026-07-20' })], today)).toContain('Was ist überfällig?');
    expect(zeileVorschlaege([t({ dueDate: '2026-07-29' })], today)).not.toContain('Was ist überfällig?');
    expect(zeileVorschlaege([], today)).not.toContain('Was ist überfällig?');
  });

  it('bietet Sortieren erst ab einem vollen Tag an', () => {
    const drei = [t({ dueDate: today }), t({ dueDate: today }), t({ dueDate: today })];
    expect(zeileVorschlaege(drei, today)).not.toContain('Sortier meinen Tag');
    expect(zeileVorschlaege([...drei, t({ dueDate: today })], today)).toContain('Sortier meinen Tag');
  });

  it('erledigte Aufgaben zählen nicht mit', () => {
    expect(zeileVorschlaege([t({ dueDate: '2026-07-20', completedAt: '2026-07-21T10:00:00.000Z' })], today))
      .not.toContain('Was ist überfällig?');
  });

  // Der Grund, warum hier `taskLogic` benutzt wird und nicht `dueDate < today`:
  // die Lebensspanne. Eine zweite, schlichtere Fassung dieser Regel hat schon
  // einmal dafuer gesorgt, dass „Heute" etwas als ueberfaellig zeigte, was
  // nirgends sonst so galt.
  it('eine VERFALLENE Aufgabe ist nicht überfällig, sondern gegenstandslos', () => {
    const verfallen = t({ dueDate: '2026-07-20', expiresOn: '2026-07-22' });
    expect(zeileVorschlaege([verfallen], today)).not.toContain('Was ist überfällig?');
  });

  it('eine noch SCHLAFENDE Aufgabe zählt weder als überfällig noch als heute', () => {
    const schlaeft = t({ dueDate: today, startDate: '2026-08-01' });
    const vier = [schlaeft, schlaeft, schlaeft, schlaeft];
    expect(zeileVorschlaege(vier, today)).not.toContain('Sortier meinen Tag');
  });

  it('gibt immer mindestens einen und höchstens drei Vorschläge', () => {
    expect(zeileVorschlaege([], today)).toHaveLength(1);
    const voll = [
      t({ dueDate: '2026-07-01' }),
      t({ dueDate: today }),
      t({ dueDate: today }),
      t({ dueDate: today }),
      t({ dueDate: today }),
    ];
    expect(zeileVorschlaege(voll, today)).toHaveLength(3);
  });
});
