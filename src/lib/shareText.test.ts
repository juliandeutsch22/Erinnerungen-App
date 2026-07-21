// shareText.test.ts — Notiz/Liste → Teilen-Text (reine Logik).
import { listToShareText, noteShareTitle, noteToShareText } from './shareText';
import type { List, Task } from '@/data/types';

function task(overrides: Partial<Task>): Task {
  return {
    id: 't', listId: 'l1', title: 'Aufgabe', note: null, dueDate: null, dueTime: null,
    rrule: null, flagged: false, eventId: null, completedAt: null, notificationId: null,
    tags: [], subtasks: [], createdAt: '2026-07-01T08:00:00.000Z', sort: 1, ...overrides,
  };
}

const list: List = {
  id: 'l1', name: 'Rom-Reise', icon: 'inbox', color: '#2B5FA6',
  goal: null, deadline: null, sort: 1, createdAt: '2026-07-01T08:00:00.000Z',
};

describe('noteToShareText', () => {
  it('gibt den Body getrimmt zurück', () => {
    expect(noteToShareText('  Einkaufen\nMilch, Brot  \n\n')).toBe('Einkaufen\nMilch, Brot');
  });
});

describe('noteShareTitle', () => {
  it('nimmt die erste Zeile als Titel', () => {
    expect(noteShareTitle('Packliste\n- Zelt\n- Schlafsack')).toBe('Packliste');
  });
});

describe('listToShareText', () => {
  it('setzt Überschrift, offene und erledigte Aufgaben', () => {
    const text = listToShareText(
      list,
      [
        task({ id: 'a', title: 'Tickets kaufen', dueDate: '2026-07-25', dueTime: '18:00' }),
        task({ id: 'b', title: 'Koffer packen' }),
        task({ id: 'c', title: 'Reisepass prüfen', completedAt: '2026-07-10T09:00:00.000Z' }),
      ],
      '2026-07-21',
    );
    expect(text).toContain('Rom-Reise');
    expect(text).toContain('☐ Tickets kaufen — 2026-07-25 18:00');
    expect(text).toContain('☐ Koffer packen');
    expect(text).toContain('☑ Reisepass prüfen');
    // Offene vor erledigten.
    expect(text.indexOf('Koffer packen')).toBeLessThan(text.indexOf('Reisepass prüfen'));
  });

  it('nimmt Ziel und Deadline mit', () => {
    const text = listToShareText({ ...list, goal: 'Entspannen', deadline: '2026-08-01' }, [], '2026-07-21');
    expect(text).toContain('Ziel: Entspannen');
    expect(text).toContain('Deadline: 2026-08-01');
  });

  it('rückt Unteraufgaben ein', () => {
    const text = listToShareText(
      list,
      [task({ id: 'a', title: 'Packen', subtasks: [{ id: 's1', title: 'Zelt', done: true }, { id: 's2', title: 'Schlafsack', done: false }] })],
      '2026-07-21',
    );
    expect(text).toContain('   ☑ Zelt');
    expect(text).toContain('   ☐ Schlafsack');
  });

  it('eine leere Liste ergibt nur die Überschrift', () => {
    expect(listToShareText(list, [], '2026-07-21')).toBe('Rom-Reise');
  });
});
