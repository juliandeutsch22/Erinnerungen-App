// noteLogic.test.ts — Titel/Vorschau-Ableitung (iOS-Verhalten), Zuordnung,
// Datumsgruppen und Papierkorb-Fenster.
import type { Note } from '@/data/types';

import {
  checklistItems,
  checklistProgress,
  continueChecklist,
  expiredTrash,
  groupNotes,
  notePreview,
  notesForEvent,
  notesForTask,
  noteTitle,
  toggleChecklistItem,
  trashedNotes,
} from './noteLogic';

const note = (body: string, taskId: string | null = null, eventId: string | null = null, extra: Partial<Note> = {}): Note => ({
  id: 'n1',
  body,
  taskId,
  eventId,
  pinned: false,
  deletedAt: null,
  createdAt: '2026-07-17T08:00:00.000Z',
  updatedAt: '2026-07-17T08:00:00.000Z',
  ...extra,
});

describe('noteTitle', () => {
  it('erste nichtleere Zeile ist der Titel', () => {
    expect(noteTitle('Einkauf Ideen\nMilch, Brot')).toBe('Einkauf Ideen');
    expect(noteTitle('\n\n  Plan B  \nRest')).toBe('Plan B');
  });
  it('leer → Platzhalter, lange Zeile wird gekürzt', () => {
    expect(noteTitle('')).toBe('Neue Notiz');
    expect(noteTitle('x'.repeat(100))).toHaveLength(80);
  });
});

describe('notePreview', () => {
  it('erste Zeile nach dem Titel', () => {
    expect(notePreview('Titel\n\nZweite Zeile\nDritte')).toBe('Zweite Zeile');
    expect(notePreview('Nur Titel')).toBe('');
  });
});

describe('Zuordnung', () => {
  const ns = [note('a', 't1'), note('b', null, 'e1'), note('c', 't1', 'e1')];
  it('nach Aufgabe und Termin filterbar', () => {
    expect(notesForTask(ns, 't1')).toHaveLength(2);
    expect(notesForEvent(ns, 'e1')).toHaveLength(2);
  });
  it('Papierkorb-Notizen zählen nicht als verknüpft', () => {
    const withTrash = [...ns, note('d', 't1', null, { deletedAt: '2026-07-16T10:00:00.000Z' })];
    expect(notesForTask(withTrash, 't1')).toHaveLength(2);
  });
});

describe('groupNotes', () => {
  const today = '2026-07-17';
  const at = (iso: string, extra: Partial<Note> = {}) => note('x', null, null, { updatedAt: iso, ...extra });
  it('Angeheftet zuerst, dann Datumsgruppen; leere Gruppen entfallen', () => {
    const groups = groupNotes(
      [
        at('2026-07-17T09:00:00.000Z', { pinned: true }),
        at('2026-07-17T08:00:00.000Z'),
        at('2026-07-16T20:00:00.000Z'),
        at('2026-07-12T08:00:00.000Z'),
        at('2026-06-20T08:00:00.000Z'),
        at('2026-01-01T08:00:00.000Z'),
      ],
      today,
    );
    expect(groups.map((g) => g.title)).toEqual(['Angeheftet', 'Heute', 'Gestern', 'Letzte 7 Tage', 'Letzte 30 Tage', 'Älter']);
    expect(groups[0].notes[0].pinned).toBe(true);
  });
  it('angeheftete Notizen tauchen nicht doppelt auf', () => {
    const groups = groupNotes([at('2026-07-17T08:00:00.000Z', { pinned: true })], today);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('pinned');
  });
});

describe('Checklisten', () => {
  const body = 'Einkauf\n- [ ] Milch\n- [x] Brot\n- Oliven\nNotiztext';

  it('erkennt Zeilen inkl. nacktem „- Text" als offen', () => {
    expect(checklistItems(body)).toEqual([
      { lineIndex: 1, text: 'Milch', done: false },
      { lineIndex: 2, text: 'Brot', done: true },
      { lineIndex: 3, text: 'Oliven', done: false },
    ]);
    expect(checklistProgress(body)).toEqual({ done: 1, total: 3 });
  });

  it('Toggle schaltet um und normalisiert', () => {
    expect(toggleChecklistItem(body, 1)).toContain('- [x] Milch');
    expect(toggleChecklistItem(body, 2)).toContain('- [ ] Brot');
    expect(toggleChecklistItem(body, 3)).toContain('- [x] Oliven');
    expect(toggleChecklistItem(body, 0)).toBe(body); // keine Checklisten-Zeile
  });

  it('Enter setzt die Liste fort, Enter auf leerer Zeile beendet sie', () => {
    const prev = 'A\n- [ ] Milch';
    expect(continueChecklist(prev, `${prev}\n`)).toBe(`${prev}\n- [ ] `);
    const empty = 'A\n- [ ] ';
    expect(continueChecklist(empty, `${empty}\n`)).toBe('A\n');
    // Enter mitten im Fließtext bleibt unangetastet.
    expect(continueChecklist('Hallo', 'Hallo\n')).toBe('Hallo\n');
  });
});

describe('Papierkorb', () => {
  const today = '2026-07-17';
  const ns = [
    note('aktiv'),
    note('frisch gelöscht', null, null, { deletedAt: '2026-07-10T08:00:00.000Z' }),
    note('alt gelöscht', null, null, { deletedAt: '2026-05-01T08:00:00.000Z' }),
  ];
  it('30-Tage-Fenster: frisch bleibt sichtbar, alt läuft ab', () => {
    expect(trashedNotes(ns, today).map((n) => n.body)).toEqual(['frisch gelöscht']);
    expect(expiredTrash(ns, today).map((n) => n.body)).toEqual(['alt gelöscht']);
  });
});
