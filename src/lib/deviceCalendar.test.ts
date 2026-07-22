import { buildEventDraft } from './deviceCalendar';

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

  it('ohne start: ganztägig (start = Tag 0 Uhr, ende = Folgetag)', () => {
    const d = buildEventDraft({ titel: 'Geburtstag', datum: '2026-08-05' });
    expect(d.allDay).toBe(true);
    expect(d.start.getHours()).toBe(0);
    expect(d.start.getDate()).toBe(5);
    expect(d.end.getDate()).toBe(6);
  });
});
