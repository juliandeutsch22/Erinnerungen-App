// noteLogic.test.ts — Titel/Vorschau-Ableitung (iOS-Verhalten) + Zuordnung.
import type { Note } from '@/data/types';

import { notePreview, notesForEvent, notesForTask, noteTitle } from './noteLogic';

const note = (body: string, taskId: string | null = null, eventId: string | null = null): Note => ({
  id: 'n1',
  body,
  taskId,
  eventId,
  createdAt: '2026-07-17T08:00:00.000Z',
  updatedAt: '2026-07-17T08:00:00.000Z',
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
});
