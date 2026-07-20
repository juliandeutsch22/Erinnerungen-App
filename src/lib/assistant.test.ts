// assistant.test.ts — Prompt-Bau, Antwort-Extraktion, Fehlertexte.
import type { ChatMessage } from '@/data/types';

import { buildAppContext, buildRequestBody, describeError, extractActions, extractText, pickModelsFromList } from './assistant';

const msg = (role: 'user' | 'assistant', content: string, at: string): ChatMessage => ({
  id: `m-${at}`, chatId: 'c1', role, content, createdAt: at,
});

describe('buildRequestBody', () => {
  it('mappt Rollen und hängt den Termin-Kontext an die System-Instruction', () => {
    const body = buildRequestBody(
      [msg('user', 'Hallo', '1'), msg('assistant', 'Hi!', '2')],
      'Termin: Rom-Reise',
    ) as { systemInstruction: { parts: { text: string }[] }; contents: { role: string }[] };
    expect(body.systemInstruction.parts[0].text).toContain('Termin: Rom-Reise');
    expect(body.contents.map((c) => c.role)).toEqual(['user', 'model']);
  });

  it('kappt den Verlauf auf das Limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => msg('user', `n${i}`, String(i).padStart(3, '0')));
    const body = buildRequestBody(many, null) as { contents: unknown[] };
    expect(body.contents.length).toBe(24);
  });
});

describe('extractText', () => {
  it('liest den Text aus einer Gemini-Antwort', () => {
    expect(
      extractText({ candidates: [{ content: { parts: [{ text: 'Hallo ' }, { text: 'Welt' }] } }] }),
    ).toBe('Hallo Welt');
  });
  it('liefert null bei leeren/kaputten Antworten', () => {
    expect(extractText({})).toBeNull();
    expect(extractText({ candidates: [] })).toBeNull();
    expect(extractText(null)).toBeNull();
  });
});

describe('extractActions', () => {
  it('zieht Aufgaben + Checkliste aus dem Block und säubert den Text', () => {
    const text = 'Hier die Liste:\n```stoa-aktionen\n{"aufgaben":[{"titel":"Pass","datum":"2026-08-01","zeit":"09:00"},{"titel":"Kabel"}],"checkliste":["Milch"]}\n```';
    const { clean, actions } = extractActions(text);
    expect(clean).toBe('Hier die Liste:');
    expect(actions?.aufgaben).toEqual([
      { titel: 'Pass', datum: '2026-08-01', zeit: '09:00' },
      { titel: 'Kabel', datum: undefined, zeit: undefined },
    ]);
    expect(actions?.checkliste).toEqual(['Milch']);
  });
  it('verkraftet echte Zeilenumbrüche in JSON-Strings (Modell-Marotte)', () => {
    const { actions } = extractActions('```stoa-aktionen\n{"notizen":["Idee\nZweite Zeile"]}\n```');
    expect(actions?.notizen).toEqual(['Idee\nZweite Zeile']);
  });
  it('liest Notizen (Braindump) aus dem Block', () => {
    const { actions } = extractActions('```stoa-aktionen\n{"notizen":["Geschenkidee\\nBuch für Anna"]}\n```');
    expect(actions?.notizen).toEqual(['Geschenkidee\nBuch für Anna']);
    expect(actions?.aufgaben).toEqual([]);
  });
  it('ohne Block / bei kaputtem JSON: nur Text, keine Aktionen', () => {
    expect(extractActions('Nur Text').actions).toBeNull();
    const broken = extractActions('X\n```stoa-aktionen\n{kaputt\n```');
    expect(broken.actions).toBeNull();
    expect(broken.clean).toBe('X');
  });
  it('ungültige Datums-/Zeitformate werden verworfen', () => {
    const { actions } = extractActions('```stoa-aktionen\n{"aufgaben":[{"titel":"A","datum":"morgen","zeit":"9 Uhr"}]}\n```');
    expect(actions?.aufgaben[0]).toEqual({ titel: 'A', datum: undefined, zeit: undefined });
  });
});

describe('describeError', () => {
  it('übersetzt die wichtigsten Statuscodes', () => {
    expect(describeError(403)).toContain('Schlüssel');
    expect(describeError(429)).toContain('Kontingent');
    expect(describeError(503)).toContain('nicht erreichbar');
  });
});

describe('pickModelsFromList', () => {
  const list = (names: string[], methods: string[] = ['generateContent']) => ({
    models: names.map((n) => ({ name: `models/${n}`, supportedGenerationMethods: methods })),
  });

  it('wählt das neueste stabile Flash-Modell plus Lite-Variante', () => {
    const { model, lite } = pickModelsFromList(
      list([
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-pro',
        'gemini-embedding-001',
        'gemini-2.5-flash-preview-09-2025',
        'gemini-2.5-flash-image',
      ]),
    );
    expect(model).toBe('gemini-2.5-flash');
    expect(lite).toBe('gemini-2.5-flash-lite');
  });

  it('ignoriert Modelle ohne generateContent und fällt notfalls auf Nicht-Flash zurück', () => {
    expect(pickModelsFromList(list(['gemini-2.5-flash'], ['embedContent'])).model).toBeNull();
    expect(pickModelsFromList(list(['gemini-2.5-pro'])).model).toBe('gemini-2.5-pro');
  });

  it('bleibt bei kaputten Antworten ruhig', () => {
    expect(pickModelsFromList(null)).toEqual({ model: null, lite: null });
    expect(pickModelsFromList({ models: 'quatsch' })).toEqual({ model: null, lite: null });
    expect(pickModelsFromList({})).toEqual({ model: null, lite: null });
  });
});

describe('buildRequestBody — Datum', () => {
  it('gibt dem Modell immer das heutige Datum mit (gegen Trainingsdaten-Raten)', () => {
    const body = buildRequestBody([], null, new Date(2026, 6, 20, 21, 5)) as {
      systemInstruction: { parts: { text: string }[] };
    };
    const system = body.systemInstruction.parts[0].text;
    expect(system).toContain('2026-07-20');
    expect(system).toContain('Juli');
    expect(system).toContain('„heute"');
  });
});

describe('buildAppContext', () => {
  const task = (title: string, over: Partial<import('@/data/types').Task> = {}): import('@/data/types').Task => ({
    id: title, listId: 'default', title, note: null, dueDate: null, dueTime: null, rrule: null,
    flagged: false, eventId: null, completedAt: null, notificationId: null, tags: [], subtasks: [],
    createdAt: '2026-07-01T08:00:00.000Z', sort: 0, ...over,
  });
  const list = (id: string, name: string, goal: string | null = null, deadline: string | null = null): import('@/data/types').List => ({
    id, name, icon: 'inbox', color: '#2B5FA6', goal, deadline, sort: 0, createdAt: '2026-07-01T08:00:00.000Z',
  });
  const note = (body: string, deletedAt: string | null = null): import('@/data/types').Note => ({
    id: body, body, taskId: null, eventId: null, pinned: false, deletedAt,
    createdAt: '2026-07-01T08:00:00.000Z', updatedAt: '2026-07-01T08:00:00.000Z',
  });

  it('fasst Termine, Aufgaben, Projekte und Notiz-Titel kompakt zusammen', () => {
    const ctx = buildAppContext({
      events: [{ title: 'Zahnarzt', start: new Date(2026, 6, 21, 14, 30), allDay: false }],
      tasks: [
        task('Steuer', { dueDate: '2026-07-22', dueTime: '18:00' }),
        task('Keller', { dueDate: '2026-07-10' }),
        task('Erledigt', { completedAt: '2026-07-19T10:00:00.000Z' }),
      ],
      lists: [list('default', 'Erinnerungen'), list('p1', 'Umzug', 'Bis Ende Juli', '2026-07-31')],
      notes: [note('Packliste Rom\n- [ ] Pass'), note('Gelöschte Notiz', '2026-07-01T00:00:00.000Z')],
      today: '2026-07-20',
    });
    expect(ctx).toContain('Di 21.7. 14:30: Zahnarzt');
    expect(ctx).toContain('Steuer · fällig 2026-07-22 18:00');
    expect(ctx).toContain('Keller · fällig 2026-07-10 (überfällig)');
    expect(ctx).not.toContain('Erledigt ·');
    expect(ctx).toContain('Umzug (Ziel: Bis Ende Juli · Deadline: 2026-07-31)');
    expect(ctx).toContain('„Packliste Rom"');
    expect(ctx).not.toContain('Gelöschte Notiz');
  });

  it('sagt bei leerem Bestand ausdrücklich „keine" (verhindert Halluzinationen)', () => {
    const ctx = buildAppContext({ events: [], tasks: [], lists: [], notes: [], today: '2026-07-20' });
    expect(ctx).toContain('Termine der nächsten ~5 Wochen:\n- keine');
    expect(ctx).toContain('Offene Aufgaben:\n- keine');
    expect(ctx).toContain('existiert in der App nicht');
  });

  it('kappt große Bestände (Limits)', () => {
    const many = Array.from({ length: 60 }, (_, i) => task(`Aufgabe ${i}`, { dueDate: '2026-08-01' }));
    const ctx = buildAppContext({ events: [], tasks: many, lists: [], notes: [], today: '2026-07-20' });
    expect((ctx.match(/- Aufgabe /g) ?? []).length).toBe(40);
  });
});
