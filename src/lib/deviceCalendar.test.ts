import { buildEventDraft, updateDeviceEvent, type DeviceEvent, type EventDraft } from './deviceCalendar';

describe('buildEventDraft', () => {
  it('baut einen einstündigen Termin aus datum + start (lokale Zeit)', () => {
    const d = buildEventDraft({ titel: 'Zahnarzt', datum: '2026-08-03', start: '10:00' });
    expect(d.allDay).toBe(false);
    expect(d.start.getFullYear()).toBe(2026);
    expect(d.start.getMonth()).toBe(7); // August = Index 7
    expect(d.start.getDate()).toBe(3);
    expect(d.start.getHours()).toBe(10);
    expect(d.start.getMinutes()).toBe(0);
    // Default-Dauer = 1 Stunde
    expect(d.end.getTime() - d.start.getTime()).toBe(60 * 60 * 1000);
  });

  it('nutzt ende, wenn angegeben', () => {
    const d = buildEventDraft({ titel: 'Meeting', datum: '2026-08-03', start: '09:00', ende: '10:30' });
    expect(d.end.getHours()).toBe(10);
    expect(d.end.getMinutes()).toBe(30);
  });

  it('ende ≤ start fällt auf eine Stunde zurück', () => {
    const d = buildEventDraft({ titel: 'Kaputt', datum: '2026-08-03', start: '12:00', ende: '11:00' });
    expect(d.end.getTime() - d.start.getTime()).toBe(60 * 60 * 1000);
  });

  it('trägt einen Ort durch, wenn einer mitkommt — und sonst null', () => {
    expect(buildEventDraft({ titel: 'Zahnarzt', datum: '2026-08-03', start: '10:00' }).location).toBeNull();
    expect(
      buildEventDraft({ titel: 'Zahnarzt', datum: '2026-08-03', start: '10:00', ort: 'Bahnhofstraße 4' }).location,
    ).toBe('Bahnhofstraße 4');
    // Auch am ganztägigen Zweig — der ist ein eigener return.
    expect(buildEventDraft({ titel: 'Umzug', datum: '2026-08-05', ort: 'Alte Wohnung' }).location).toBe('Alte Wohnung');
  });

  it('ohne start: ganztägig (start = Tag 0 Uhr, ende = Folgetag)', () => {
    const d = buildEventDraft({ titel: 'Geburtstag', datum: '2026-08-05' });
    expect(d.allDay).toBe(true);
    expect(d.start.getHours()).toBe(0);
    expect(d.start.getDate()).toBe(5);
    expect(d.end.getDate()).toBe(6);
  });
});

describe('updateDeviceEvent', () => {
  // Der Rest der Kalender-Anbindung braucht das native Modul und ist im Web
  // nicht prüfbar (UEBERGABE §8.5). `update` aber geht direkt auf das
  // Shared Object des Termins — und genau dort steckt die Feinheit, die man
  // beim Ort leicht falsch macht.
  const fakeEvent = (): { ev: DeviceEvent; calls: Record<string, unknown>[] } => {
    const calls: Record<string, unknown>[] = [];
    const ev = {
      key: 'k', id: 'e1', calendarId: 'c1', title: 'Zahnarzt', notes: null,
      location: 'Bahnhofstraße 4', allDay: false,
      start: new Date(2026, 7, 3, 10, 0), end: new Date(2026, 7, 3, 11, 0),
      recurring: false,
      native: { update: async (p: Record<string, unknown>) => { calls.push(p); } },
    } as unknown as DeviceEvent;
    return { ev, calls };
  };

  const draft = (over: Partial<EventDraft> = {}): EventDraft => ({
    title: 'Zahnarzt', notes: null, location: null, allDay: false,
    start: new Date(2026, 7, 3, 10, 0), end: new Date(2026, 7, 3, 11, 0),
    ...over,
  });

  it('schreibt einen neuen Ort durch', async () => {
    const { ev, calls } = fakeEvent();
    await updateDeviceEvent(ev, draft({ location: 'Praxis Dr. Weiß' }));
    expect(calls[0].location).toBe('Praxis Dr. Weiß');
  });

  it('LÖSCHT einen Ort mit leerem Text, nicht mit undefined', async () => {
    // `undefined` hieße für EventKit „nicht anfassen" — der alte Ort bliebe
    // stehen, und ein Ort ließe sich nur setzen, nie wieder entfernen.
    const { ev, calls } = fakeEvent();
    await updateDeviceEvent(ev, draft({ location: null }));
    expect(calls[0].location).toBe('');
    expect(calls[0].location).not.toBeUndefined();
  });
});
