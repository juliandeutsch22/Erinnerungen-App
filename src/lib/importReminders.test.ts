// importReminders.test.ts — Mapping Apple-Erinnerung → Aufgabe.
import type { RawReminder } from '@/lib/deviceReminders';

import { mapRecurrence, mapReminder, nearestListColor } from './importReminders';

const raw = (over: Partial<RawReminder> = {}): RawReminder => ({
  id: 'rem-1',
  listId: 'cal-1',
  title: 'Milch kaufen',
  notes: null,
  dueDate: null,
  allDay: false,
  recurrence: null,
  ...over,
});

describe('mapReminder', () => {
  it('übernimmt Titel, Notiz, Fälligkeit mit Uhrzeit', () => {
    const m = mapReminder(
      raw({ notes: 'Bio', dueDate: new Date(2026, 6, 20, 9, 30) }),
      'liste-1',
    );
    expect(m.task).toEqual({
      listId: 'liste-1',
      title: 'Milch kaufen',
      note: 'Bio',
      dueDate: '2026-07-20',
      dueTime: '09:30',
      rrule: null,
    });
    expect(m.lossyRecurrence).toBe(false);
  });

  it('ganztägig → keine Uhrzeit', () => {
    const m = mapReminder(raw({ dueDate: new Date(2026, 6, 20, 12, 0), allDay: true }), 'l');
    expect(m.task.dueDate).toBe('2026-07-20');
    expect(m.task.dueTime).toBeNull();
  });
});

describe('mapRecurrence', () => {
  it('einfache Frequenzen werden übernommen', () => {
    expect(mapRecurrence({ frequency: 'weekly', interval: 1 })).toEqual({ rrule: 'weekly', lossy: false });
    expect(mapRecurrence({ frequency: 'DAILY', interval: 1 }).rrule).toBe('daily');
  });
  it('Intervall > 1 fällt verlustbehaftet auf null zurück', () => {
    expect(mapRecurrence({ frequency: 'weekly', interval: 2 })).toEqual({ rrule: null, lossy: true });
  });
});

describe('nearestListColor', () => {
  it('liefert immer eine Farbe der kuratierten Palette', () => {
    expect(nearestListColor('#FF0000')).toMatch(/^#/);
    // Apples Standard-Blau landet auf unserem Kuppel-Blau-Umfeld.
    expect(nearestListColor('#1E6FD9')).toBe('#2B5FA6');
    expect(nearestListColor('kaputt')).toBe('#2B5FA6');
  });
});
