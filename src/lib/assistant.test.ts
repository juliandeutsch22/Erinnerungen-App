// assistant.test.ts — Prompt-Bau, Antwort-Extraktion, Fehlertexte.
import type { ChatMessage, Task } from '@/data/types';

import { buildAppContext,  buildBraindumpContext, buildRequestBody, createSseParser, describeError, describeSchritte, extractActions, extractChunkText, extractText, pickModelsFromList, promptChips, resolveListId, sanitizeChatTitle, SYSTEM_PROMPT, subtasksFromSchritte, describeExtras, describeAenderung, MEMORY_LIMIT, resolveTaskHandle, taskHandle, ASSISTANT_TOOLS, extractCalls, runAssistantTool, type ToolData, MAX_TOOL_ROUNDS, actionDueDate, hasCapturableActions, SCHRITTE_LIMIT, IMAGE_LIMIT, type AssistantImage, systemPrompt, usesNewConfigDialect, tuneForModel, MODEL_CHAIN, LITE_CHAIN } from './assistant';

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
  it('zieht Termine (mit/ohne Uhrzeit) und verwirft solche ohne gültiges Datum', () => {
    const text =
      '```stoa-aktionen\n{"termine":[{"titel":"Zahnarzt","datum":"2026-08-03","start":"10:00","ende":"11:00"},{"titel":"Geburtstag","datum":"2026-08-05"},{"titel":"Ohne Datum"}]}\n```';
    const { actions } = extractActions(text);
    expect(actions?.termine).toEqual([
      { titel: 'Zahnarzt', datum: '2026-08-03', start: '10:00', ende: '11:00' },
      { titel: 'Geburtstag', datum: '2026-08-05', start: undefined, ende: undefined },
    ]);
  });
  it('liest die vorgeschlagene Liste an einer Aufgabe mit', () => {
    const { actions } = extractActions('```stoa-aktionen\n{"aufgaben":[{"titel":"Reifen","liste":"Auto"},{"titel":"Ohne"}]}\n```');
    expect(actions?.aufgaben[0].liste).toBe('Auto');
    expect(actions?.aufgaben[1].liste).toBeUndefined();
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
    // Seit v1.36.0 trägt jede Zeile ihr Handle: '- [ab12cd] Aufgabe 3 · …'
    expect((ctx.match(/- \[[^\]]+\] Aufgabe /g) ?? []).length).toBe(40);
  });
});

describe('buildAppContext — Kalenderzugriff', () => {
  it('sagt „unbekannt" statt „keine", wenn der Kalenderzugriff fehlt', () => {
    const ctx = buildAppContext({ events: [], tasks: [], lists: [], notes: [], today: '2026-07-20', calendarDenied: true });
    expect(ctx).toContain('keinen Kalenderzugriff');
    expect(ctx).not.toContain('Termine der nächsten ~5 Wochen:\n- keine');
  });
});

describe('createSseParser / extractChunkText — Streaming', () => {
  const event = (text: string) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n`;

  it('extrahiert Chunk-Text OHNE trim (Wortabstände bleiben erhalten)', () => {
    expect(extractChunkText({ candidates: [{ content: { parts: [{ text: ' Welt' }] } }] })).toBe(' Welt');
    expect(extractChunkText({ kaputt: true })).toBe('');
    expect(extractChunkText(null)).toBe('');
  });

  it('liefert Deltas aus vollständigen data-Zeilen', () => {
    const p = createSseParser();
    expect(p.push(event('Hallo') + event(' Welt'))).toEqual(['Hallo', ' Welt']);
  });

  it('puffert Chunk-Grenzen mitten in einer Zeile', () => {
    const p = createSseParser();
    const line = event('Zusammen');
    expect(p.push(line.slice(0, 20))).toEqual([]);
    expect(p.push(line.slice(20))).toEqual(['Zusammen']);
  });

  it('flush liest eine letzte Zeile ohne Zeilenumbruch', () => {
    const p = createSseParser();
    expect(p.push('data: {"candidates":[{"content":{"parts":[{"text":"Ende"}]}}]}')).toEqual([]);
    expect(p.flush()).toEqual(['Ende']);
  });

  it('ignoriert Leerzeilen, [DONE] und kaputtes JSON still', () => {
    const p = createSseParser();
    expect(p.push('\r\n' + 'data: [DONE]\n' + 'data: {kaputt\n' + event('ok'))).toEqual(['ok']);
  });

  it('verkraftet CRLF-Zeilenenden', () => {
    const p = createSseParser();
    expect(p.push(event('a').replace('\n', '\r\n'))).toEqual(['a']);
  });
});

describe('sanitizeChatTitle', () => {
  it('streift Anführungszeichen und Label ab', () => {
    expect(sanitizeChatTitle('Titel: „Rom-Reise planen"')).toBe('Rom-Reise planen');
    expect(sanitizeChatTitle('"Packliste erstellen"')).toBe('Packliste erstellen');
  });

  it('nimmt nur die erste Zeile und entfernt Sternchen/Endpunkt', () => {
    expect(sanitizeChatTitle('**Wocheneinkauf.**\nnoch was')).toBe('Wocheneinkauf');
  });

  it('deckelt auf sechs Wörter', () => {
    expect(sanitizeChatTitle('eins zwei drei vier fünf sechs sieben acht')).toBe('eins zwei drei vier fünf sechs');
  });

  it('kürzt sehr lange Titel mit Ellipse', () => {
    const long = sanitizeChatTitle('a'.repeat(80));
    expect(long.length).toBe(48);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('promptChips', () => {
  it('gibt je Verknüpfung passende Vorschläge', () => {
    expect(promptChips('note')[0]).toContain('zusammen');
    expect(promptChips('task')[0]).toContain('Teilschritte');
    expect(promptChips('event').some((c) => c.includes('Packliste'))).toBe(true);
    expect(promptChips('none')).toContain('Plane meinen Tag');
  });

  it('liefert immer mindestens zwei Chips', () => {
    for (const link of ['note', 'task', 'event', 'none'] as const) {
      expect(promptChips(link).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('resolveListId', () => {
  const lists = [
    { id: 'default', name: 'Erinnerungen' },
    { id: 'l-auto', name: 'Auto' },
    { id: 'l-haus', name: 'Haus & Garten' },
  ];
  it('trifft exakt, unabhängig von Groß-/Kleinschreibung und Rand-Leerzeichen', () => {
    expect(resolveListId('Auto', lists)).toBe('l-auto');
    expect(resolveListId('  haus & garten ', lists)).toBe('l-haus');
  });
  it('fällt ohne klaren Treffer auf den Eingang zurück (nie die falsche Liste)', () => {
    expect(resolveListId('Werkstatt', lists)).toBe('default');
    expect(resolveListId(undefined, lists)).toBe('default');
    expect(resolveListId('', lists)).toBe('default');
  });
});


describe('Schritte → Unteraufgaben', () => {
  it('macht offene Unteraufgaben mit eigenen IDs', () => {
    const subs = subtasksFromSchritte(['Milch', 'Brot']);
    expect(subs.map((s) => s.title)).toEqual(['Milch', 'Brot']);
    expect(subs.every((s) => !s.done)).toBe(true);
    expect(new Set(subs.map((s) => s.id)).size).toBe(2);
  });

  it('beschreibt die Checkliste für die Bestätigungskarte', () => {
    expect(describeSchritte(undefined)).toBeNull();
    expect(describeSchritte(['Milch'])).toBe('1 Schritt: Milch');
    expect(describeSchritte(['Milch', 'Brot', 'Butter', 'Äpfel'])).toBe('4 Schritte: Milch, Brot, Butter …');
  });

  // Ohne diese Regel im Prompt zerlegt das Modell die Einkaufsliste wieder in
  // Einzelaufgaben — die Regel ist der eigentliche Fix, nicht das Parsen.
  it('Prompt und Braindump-Kontext verlangen das Bündeln', () => {
    expect(SYSTEM_PROMPT).toContain('schritte');
    expect(SYSTEM_PROMPT).toContain('NICHT viele Aufgaben');
    expect(buildBraindumpContext('Montag, 27. Juli 2026 (2026-07-27)')).toContain('BÜNDELN statt zerstückeln');
  });
});

describe('Aktions-Sprache: Wiederholung, Tags, Notiz, Projekte', () => {
  it('übernimmt eine gültige Wiederholung und verwirft erfundene Formen', () => {
    const ok = extractActions('```stoa-aktionen\n{"aufgaben":[{"titel":"Müll","wiederholung":"every:2w"}]}\n```');
    expect(ok.actions!.aufgaben[0].wiederholung).toBe('every:2w');
    // „jeden zweiten Montag" kann die App nicht abbilden — dann lieber einmalig
    // als mit einer kaputten Regel.
    const bad = extractActions('```stoa-aktionen\n{"aufgaben":[{"titel":"X","wiederholung":"jeden 2. Montag"}]}\n```');
    expect(bad.actions!.aufgaben[0].wiederholung).toBeUndefined();
  });

  it('normalisiert Tags wie die App und nimmt auch einen Komma-String', () => {
    const a = extractActions('```stoa-aktionen\n{"aufgaben":[{"titel":"X","tags":["#Arbeit"," Neues Projekt ","arbeit"]}]}\n```');
    expect(a.actions!.aufgaben[0].tags).toEqual(['arbeit', 'neues-projekt']);
    const b = extractActions('```stoa-aktionen\n{"aufgaben":[{"titel":"X","tags":"haus, garten"}]}\n```');
    expect(b.actions!.aufgaben[0].tags).toEqual(['haus', 'garten']);
  });

  it('liest Projekte mit Ziel und Deadline', () => {
    const { actions } = extractActions(
      '```stoa-aktionen\n{"listen":[{"name":"Umzug","ziel":"Bis Ende August raus","deadline":"2026-08-31"}]}\n```',
    );
    expect(actions!.listen).toEqual([{ name: 'Umzug', ziel: 'Bis Ende August raus', deadline: '2026-08-31' }]);
  });

  it('ein Block mit NUR einem Projekt ist trotzdem gültig', () => {
    expect(extractActions('```stoa-aktionen\n{"listen":[{"name":"Umzug"}]}\n```').actions).not.toBeNull();
  });

  it('beschreibt Wiederholung und Tags für die Bestätigungskarte', () => {
    expect(describeExtras({})).toBeNull();
    expect(describeExtras({ wiederholung: 'weekly', tags: ['haus'] })).toBe('Wöchentlich · #haus');
  });
});

describe('Merkzettel', () => {
  const body = (memory: string | null) =>
    (buildRequestBody([msg('user', 'Hi', '1')], 'Kontext', new Date('2026-07-27T09:00:00'), memory) as {
      systemInstruction: { parts: { text: string }[] };
    }).systemInstruction.parts[0].text;

  it('steht vor dem Datenkontext und ist als Vorgabe des Nutzers ausgewiesen', () => {
    const text = body('Besorgungen kommen in die Liste Erledigungen.');
    expect(text).toContain('MERKZETTEL');
    expect(text).toContain('Besorgungen kommen in die Liste Erledigungen.');
    expect(text.indexOf('MERKZETTEL')).toBeLessThan(text.indexOf('Kontext aus der App'));
  });

  it('ohne Merkzettel bleibt die Instruktion unverändert', () => {
    expect(body(null)).not.toContain('MERKZETTEL');
    expect(body('   ')).not.toContain('MERKZETTEL');
  });

  it('deckelt die Länge — er geht bei JEDEM Aufruf mit', () => {
    expect(body('x'.repeat(5000))).toContain('x'.repeat(MEMORY_LIMIT));
    expect(body('x'.repeat(5000))).not.toContain('x'.repeat(MEMORY_LIMIT + 1));
  });
});

describe('Änderungen an bestehenden Aufgaben', () => {
  const t = (id: string, title: string): Task => ({
    id, listId: 'default', title, note: null, dueDate: null, dueTime: null, rrule: null,
    flagged: false, eventId: null, completedAt: null, notificationId: null, tags: [], subtasks: [],
    createdAt: '2026-07-01T08:00:00.000Z', sort: 1,
  });

  it('das Handle nimmt den ZUFALLS-Teil der ID, nicht den Zeitstempel', () => {
    // newId() = Zeitstempel + Zufall. Zwei am selben Tag angelegte Aufgaben
    // teilen den ANFANG — nur hinten unterscheiden sie sich verlässlich.
    expect(taskHandle('m9x1a2b3cdef12')).toBe('def12'.slice(-5) === 'def12' ? 'cdef12' : '');
    expect(taskHandle('m9x1a2b3cdef12')).toHaveLength(6);
  });

  it('löst ein Handle auf — aber nie mehrdeutig oder erfunden', () => {
    const a = t('aaaaaaaa111111', 'Müll');
    const b = t('bbbbbbbb222222', 'Steuer');
    expect(resolveTaskHandle(taskHandle(a.id), [a, b])?.title).toBe('Müll');
    expect(resolveTaskHandle('ZZZZZZ', [a, b])).toBeNull();
    // Gleiches Handle zweimal → lieber nichts anfassen als das Falsche.
    const doppelt = t('cccccccc111111', 'Zwilling');
    expect(resolveTaskHandle(taskHandle(a.id), [a, doppelt])).toBeNull();
  });

  it('liest Änderungen und wirft leere Einträge weg', () => {
    const { actions } = extractActions(
      '```stoa-aktionen\n{"aenderungen":[{"handle":"abc123","datum":"2026-08-03"},{"handle":"leer"}]}\n```',
    );
    expect(actions!.aenderungen).toEqual([{ handle: 'abc123', datum: '2026-08-03', erledigt: undefined, zeit: undefined, titel: undefined, liste: undefined, papierkorb: undefined }]);
  });

  it('unterscheidet „Datum entfernen" (null) von „nicht angefasst" (fehlt)', () => {
    const weg = extractActions('```stoa-aktionen\n{"aenderungen":[{"handle":"a1","datum":null}]}\n```');
    expect(weg.actions!.aenderungen[0].datum).toBeNull();
    const unberuehrt = extractActions('```stoa-aktionen\n{"aenderungen":[{"handle":"a1","erledigt":true}]}\n```');
    expect(unberuehrt.actions!.aenderungen[0].datum).toBeUndefined();
  });

  it('beschreibt die Änderung im Klartext', () => {
    const f = (d: string) => `am ${d}`;
    expect(describeAenderung({ handle: 'x', erledigt: true }, f)).toBe('abhaken');
    expect(describeAenderung({ handle: 'x', datum: '2026-08-03', zeit: '09:00' }, f)).toBe('auf am 2026-08-03 · 09:00 Uhr');
    expect(describeAenderung({ handle: 'x', datum: null }, f)).toBe('Datum entfernen');
    expect(describeAenderung({ handle: 'x', papierkorb: true }, f)).toBe('in den Papierkorb');
  });

  it('der Prompt verbietet endgültiges Löschen und erfundene Handles', () => {
    expect(SYSTEM_PROMPT).toContain('ENDGÜLTIG LÖSCHEN KANNST DU NICHT');
    expect(SYSTEM_PROMPT).toContain('nie erfundene');
  });

  it('der App-Überblick trägt die Handles', () => {
    const ctx = buildAppContext({
      events: [], tasks: [t('aaaaaaaa111111', 'Müll')], lists: [], notes: [], today: '2026-07-27',
    });
    expect(ctx).toContain(`[${taskHandle('aaaaaaaa111111')}] Müll`);
  });
});

describe('Werkzeuge (Function Calling)', () => {
  const t = (o: Partial<Task> & { id: string; title: string }): Task => ({
    listId: 'default', note: null, dueDate: null, dueTime: null, rrule: null, flagged: false,
    eventId: null, completedAt: null, notificationId: null, tags: [], subtasks: [],
    createdAt: '2026-07-01T08:00:00.000Z', sort: 1, ...o,
  });
  const data: ToolData = {
    today: '2026-07-27',
    lists: [
      { id: 'default', name: 'Erinnerungen', icon: 'inbox', color: '#2B5FA6', goal: null, deadline: null, sort: 0, createdAt: '2026-07-01T08:00:00.000Z' },
      { id: 'p1', name: 'Umzug', icon: 'inbox', color: '#2B5FA6', goal: null, deadline: null, sort: 1, createdAt: '2026-07-01T08:00:00.000Z' },
    ],
    tasks: [
      t({ id: 'aaaa111111', title: 'Kaution zurückfordern', listId: 'p1', tags: ['umzug'] }),
      t({ id: 'bbbb222222', title: 'Kartons kaufen', listId: 'p1', completedAt: '2026-07-20T10:00:00.000Z' }),
      t({ id: 'cccc333333', title: 'Zahnarzt anrufen' }),
    ],
    notes: [
      { id: 'n1', body: 'Umzugsplan\nSchlüssel am 30. abgeben', taskId: null, eventId: null, pinned: false, deletedAt: null, createdAt: '', updatedAt: '' },
    ],
  };

  it('die Werkzeuge sind ausschließlich LESEND — nichts darf still schreiben', () => {
    const namen = ASSISTANT_TOOLS.map((x) => x.name);
    expect(namen).toEqual(['aufgaben_suchen', 'liste_inhalt', 'notiz_lesen']);
    expect(namen.some((n) => /anleg|erstell|lösch|ändern|schreib/i.test(n))).toBe(false);
  });

  it('die Abendbetrachtung ist strukturell unerreichbar', () => {
    // Kein Werkzeug dafür, und ToolData hat gar kein Journal-Feld.
    expect(JSON.stringify(ASSISTANT_TOOLS).toLowerCase()).not.toContain('journal');
    expect(JSON.stringify(ASSISTANT_TOOLS).toLowerCase()).not.toContain('betrachtung');
    expect(Object.keys(data)).not.toContain('journal');
  });

  it('findet auch Erledigtes — das steht im Überblick gar nicht', () => {
    const alle = runAssistantTool({ name: 'aufgaben_suchen', args: { text: 'karton' } }, data);
    expect(alle).toContain('Kartons kaufen');
    expect(alle).toContain('erledigt');
    const nurOffen = runAssistantTool({ name: 'aufgaben_suchen', args: { erledigt: false } }, data);
    expect(nurOffen).not.toContain('Kartons kaufen');
  });

  it('filtert nach Liste und Tag', () => {
    expect(runAssistantTool({ name: 'aufgaben_suchen', args: { tag: '#Umzug' } }, data)).toContain('Kaution');
    expect(runAssistantTool({ name: 'liste_inhalt', args: { name: 'umzug' } }, data)).not.toContain('Zahnarzt');
  });

  it('liest den Notiz-INHALT, den der Überblick nie zeigt', () => {
    expect(runAssistantTool({ name: 'notiz_lesen', args: { titel: 'Umzugsplan' } }, data)).toContain('Schlüssel am 30.');
  });

  it('antwortet ehrlich statt zu raten', () => {
    expect(runAssistantTool({ name: 'liste_inhalt', args: { name: 'Gibtsnicht' } }, data)).toContain('gibt es nicht');
    expect(runAssistantTool({ name: 'notiz_lesen', args: { titel: 'Fehlt' } }, data)).toContain('Keine Notiz');
    expect(runAssistantTool({ name: 'zaubern', args: {} }, data)).toContain('Unbekanntes Werkzeug');
  });

  it('erkennt Werkzeug-Aufrufe in der Antwort', () => {
    const calls = extractCalls({ candidates: [{ content: { parts: [{ functionCall: { name: 'notiz_lesen', args: { titel: 'X' } } }] } }] });
    expect(calls).toEqual([{ name: 'notiz_lesen', args: { titel: 'X' } }]);
    expect(extractCalls({ candidates: [{ content: { parts: [{ text: 'nur Text' }] } }] })).toEqual([]);
    expect(extractCalls(null)).toEqual([]);
  });

  it('deklariert Werkzeuge NUR, wenn sie erlaubt sind', () => {
    const ohne = buildRequestBody([msg('user', 'Hi', '1')], null, new Date(), null, false) as Record<string, unknown>;
    expect(ohne.tools).toBeUndefined();
    const mit = buildRequestBody([msg('user', 'Hi', '1')], null, new Date(), null, true) as Record<string, unknown>;
    expect(mit.tools).toBeDefined();
  });

  it('die Runden sind gedeckelt', () => {
    expect(MAX_TOOL_ROUNDS).toBeGreaterThan(0);
    expect(MAX_TOOL_ROUNDS).toBeLessThanOrEqual(4);
  });
});

describe('Fehlersuche v1.38.0 — stille Lücken der Aktions-Sprache', () => {
  it('eine Wiederholung ohne Datum wird auf heute verankert, sonst kehrt sie nie zurück', () => {
    // resolveCompletion braucht rrule UND dueDate; ohne Datum würde die Aufgabe
    // trotz sichtbarem „Wöchentlich" einmalig abgehakt und wäre weg.
    expect(actionDueDate({ wiederholung: 'weekly' }, '2026-07-27')).toBe('2026-07-27');
    expect(actionDueDate({ datum: '2026-08-03', wiederholung: 'weekly' }, '2026-07-27')).toBe('2026-08-03');
    // Ohne Wiederholung bleibt „kein Datum" auch kein Datum.
    expect(actionDueDate({}, '2026-07-27')).toBeNull();
  });

  it('ein Block aus NUR Änderungen ist für Braindump/Sprach-Sheet leer', () => {
    const nurAenderung = extractActions('```stoa-aktionen\n{"aenderungen":[{"handle":"a1","erledigt":true}]}\n```').actions!;
    expect(nurAenderung).not.toBeNull();
    expect(hasCapturableActions(nurAenderung)).toBe(false);
    const mitAufgabe = extractActions('```stoa-aktionen\n{"aufgaben":[{"titel":"X"}]}\n```').actions!;
    expect(hasCapturableActions(mitAufgabe)).toBe(true);
  });

  it('die Checkliste ist gedeckelt — kein entgleistes Modell mit 300 Schritten', () => {
    const viele = Array.from({ length: 300 }, (_, i) => `Ding ${i}`);
    const { actions } = extractActions(
      '```stoa-aktionen\n' + JSON.stringify({ aufgaben: [{ titel: 'X', schritte: viele }] }) + '\n```',
    );
    expect(actions!.aufgaben[0].schritte).toHaveLength(SCHRITTE_LIMIT);
  });
});

describe('Bildkanal', () => {
  const bild = (n: string): AssistantImage => ({ mimeType: 'image/jpeg', data: `DATEN-${n}` });
  const parts = (images: AssistantImage[], msgs = [msg('user', 'Was steht drauf?', '1')]) =>
    (buildRequestBody(msgs, null, new Date('2026-07-27T09:00:00'), null, false, images) as {
      contents: { role: string; parts: unknown[] }[];
    }).contents;

  it('hängt Bilder als inlineData an die Nachricht', () => {
    const c = parts([bild('a')]);
    expect(c[0].parts).toEqual([
      { text: 'Was steht drauf?' },
      { inlineData: { mimeType: 'image/jpeg', data: 'DATEN-a' } },
    ]);
  });

  it('ohne Bilder bleibt der Aufbau exakt wie vorher', () => {
    expect(parts([])[0].parts).toEqual([{ text: 'Was steht drauf?' }]);
  });

  it('hängt sie an die LETZTE Nutzer-Nachricht, nicht an die erste', () => {
    const c = parts([bild('a')], [msg('user', 'alt', '1'), msg('assistant', 'ok', '2'), msg('user', 'neu', '3')]);
    expect(c[0].parts).toHaveLength(1);
    expect(c[2].parts).toHaveLength(2);
  });

  it('deckelt die Anzahl — Bilder kosten ein Vielfaches von Text', () => {
    const viele = Array.from({ length: 10 }, (_, i) => bild(String(i)));
    expect(parts(viele)[0].parts).toHaveLength(1 + IMAGE_LIMIT);
  });

  it('der Prompt sagt, dass nichts dazugeraten werden darf', () => {
    expect(SYSTEM_PROMPT).toContain('BILDER');
    expect(SYSTEM_PROMPT).toContain('rate nichts dazu');
  });
});

describe('Erfassen-Modus (kurzer Prompt, JSON-Zwang)', () => {
  const voll = systemPrompt('voll');
  const erfassen = systemPrompt('erfassen');

  it('lässt weg, was beim reinen Erfassen niemand anwenden kann', () => {
    // Ohne App-Überblick gibt es keine Handles — Änderungs- und Werkzeug-Regeln
    // wären dort nur Ballast, den jede Anfrage mitbezahlt.
    expect(erfassen).not.toContain('aenderungen');
    expect(erfassen).not.toContain('aufgaben_suchen');
    expect(voll).toContain('aenderungen');
    expect(voll).toContain('aufgaben_suchen');
  });

  it('behält, was zum Erfassen nötig ist — Rolle, Aktions-Block, Bilder', () => {
    expect(erfassen).toContain('AKTIONEN');
    expect(erfassen).toContain('BILDER');
    expect(erfassen.length).toBeLessThan(voll.length);
  });

  it('SYSTEM_PROMPT bleibt der volle Prompt (Bestandsschutz)', () => {
    expect(SYSTEM_PROMPT).toBe(voll);
  });

  it('json:true erzwingt das Antwort-Schema, sonst bleibt der Aufbau unverändert', () => {
    const cfg = (json: boolean) =>
      (buildRequestBody([msg('user', 'Milch kaufen', '1')], null, new Date('2026-07-27T09:00:00'), null, false, [], 'erfassen', json) as {
        generationConfig: Record<string, unknown>;
      }).generationConfig;
    expect(cfg(false).responseMimeType).toBeUndefined();
    expect(cfg(false).responseSchema).toBeUndefined();
    expect(cfg(true).responseMimeType).toBe('application/json');
    expect(cfg(true).responseSchema).toBeTruthy();
  });

  it('extractActions liest auch rohes JSON ohne umschließenden Block', () => {
    // Im JSON-Zwang kommt keine Prosa und keine ```-Klammer zurück.
    const roh = JSON.stringify({ aufgaben: [{ titel: 'Milch kaufen', datum: '2026-07-28' }], notizen: ['Idee'] });
    const { clean, actions } = extractActions(roh);
    expect(clean).toBe('');
    expect(actions!.aufgaben).toEqual([expect.objectContaining({ titel: 'Milch kaufen', datum: '2026-07-28' })]);
    expect(actions!.notizen).toEqual(['Idee']);
  });

  it('normale Prosa bleibt Prosa — kein Fehlalarm durch den JSON-Weg', () => {
    const { clean, actions } = extractActions('Klingt gut, das trage ich so ein.');
    expect(clean).toBe('Klingt gut, das trage ich so ein.');
    expect(actions).toBeNull();
  });
});

describe('Zwei API-Dialekte (temperature ↔ thinkingLevel)', () => {
  const cfgVon = (model: string, mode: 'voll' | 'erfassen', konservativ = false) => {
    const body = buildRequestBody([msg('user', 'Milch kaufen', '1')], null, new Date('2026-07-28T09:00:00'), null, false, [], mode, mode === 'erfassen');
    return (tuneForModel(body, model, konservativ) as { generationConfig: Record<string, unknown> }).generationConfig;
  };

  it('erkennt die Generation an der Versionsnummer', () => {
    expect(usesNewConfigDialect('gemini-3.6-flash')).toBe(true);
    expect(usesNewConfigDialect('gemini-3.5-flash-lite')).toBe(true);
    expect(usesNewConfigDialect('gemini-3.1-flash-lite')).toBe(false);
    expect(usesNewConfigDialect('gemini-2.5-flash')).toBe(false);
    // Aliasse ohne Versionsnummer zeigen immer auf das aktuelle Modell.
    expect(usesNewConfigDialect('gemini-flash-latest')).toBe(true);
  });

  it('schickt nie beide Fassungen gleichzeitig', () => {
    const neu = cfgVon('gemini-3.6-flash', 'erfassen');
    expect(neu.temperature).toBeUndefined();
    expect(neu.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });

    const alt = cfgVon('gemini-2.5-flash', 'erfassen');
    expect(alt.temperature).toBe(0.4);
    expect(alt.thinkingConfig).toBeUndefined();
  });

  it('„minimal" nur beim Erfassen — Chat und Verwalter dürfen denken', () => {
    expect(cfgVon('gemini-3.6-flash', 'voll').thinkingConfig).toBeUndefined();
  });

  it('lässt den Rest der Konfiguration unangetastet', () => {
    const neu = cfgVon('gemini-3.6-flash', 'erfassen');
    expect(neu.maxOutputTokens).toBe(1200);
    expect(neu.responseMimeType).toBe('application/json');
  });

  it('konservativ lässt beide Fassungen weg — die Notlösung nach einem 400er', () => {
    const nackt = cfgVon('gemini-3.6-flash', 'erfassen', true);
    expect(nackt.temperature).toBeUndefined();
    expect(nackt.thinkingConfig).toBeUndefined();
    // Was die Antwort FORMT, bleibt: sonst käme Prosa statt des Aktions-Blocks.
    expect(nackt.responseMimeType).toBe('application/json');
    expect(nackt.maxOutputTokens).toBe(1200);
  });

  it('die neueste ID steht vorn, die alten bleiben als Netz darunter', () => {
    expect(MODEL_CHAIN[0]).toBe('gemini-3.6-flash');
    expect(LITE_CHAIN[0]).toBe('gemini-3.5-flash-lite');
    // Das Netz muss bleiben: Google zieht IDs zurück, dann trägt die Kette.
    expect(MODEL_CHAIN).toContain('gemini-flash-latest');
    expect(LITE_CHAIN).toContain('gemini-flash-lite-latest');
    expect(MODEL_CHAIN.length).toBeGreaterThan(2);
  });
});

// ——— Fehlersuche v1.48.0 ———
describe('Unlesbare Antworten führen nie in eine stumme Sackgasse', () => {
  it('rohes JSON, das sich nicht lesen lässt, bleibt als Text erhalten', () => {
    // Vorher: clean war '' und die Antwort verschwand — der Braindump kündigte
    // „Seine Antwort:" an und schwieg dann.
    const kaputt = '{"unbrauchbar": true';
    const { clean, actions } = extractActions(kaputt);
    expect(actions).toBeNull();
    expect(clean).toBe(kaputt);
  });

  it('lesbares rohes JSON bleibt der Aktions-Block (kein Rückschritt)', () => {
    const { clean, actions } = extractActions('{"aufgaben":[{"titel":"Milch"}]}');
    expect(clean).toBe('');
    expect(actions!.aufgaben[0].titel).toBe('Milch');
  });
});

describe('Wochentags-Wiederholungen im Aktions-Block', () => {
  it('nimmt "wd:1,4" an und verwirft Unsinn', () => {
    const block = (w: string) =>
      extractActions('Gut.\n```stoa-aktionen\n' + JSON.stringify({ aufgaben: [{ titel: 'Sport', wiederholung: w }] }) + '\n```').actions!
        .aufgaben[0].wiederholung;
    expect(block('wd:1,4')).toBe('wd:1,4');
    expect(block('weekdays')).toBe('weekdays');
    // Ungültiges fällt weg — lieber einmalig als kaputt (UEBERGABE §8.17).
    expect(block('wd:9')).toBeUndefined();
    expect(block('jeden montag')).toBeUndefined();
  });

  it('der Prompt nennt die Form, sonst benutzt sie niemand', () => {
    expect(SYSTEM_PROMPT).toContain('wd:1,4');
    expect(systemPrompt('erfassen')).toContain('wd:1,4');
  });
});

describe('actionDueDate mit festen Wochentagen', () => {
  it('verankert das abgeleitete Datum, respektiert aber ein genanntes', () => {
    // Dienstag, 28.07.2026.
    expect(actionDueDate({ wiederholung: 'wd:1,4' }, '2026-07-28')).toBe('2026-07-30');
    // Der Assistent hat ein Datum genannt — das ist eine Aussage, keine Ableitung.
    expect(actionDueDate({ datum: '2026-07-28', wiederholung: 'wd:1,4' }, '2026-07-28')).toBe('2026-07-28');
    // Ohne Wiederholung bleibt es wie bisher.
    expect(actionDueDate({}, '2026-07-28')).toBeNull();
    expect(actionDueDate({ wiederholung: 'weekly' }, '2026-07-28')).toBe('2026-07-28');
  });
});
