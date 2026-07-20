// assistant.test.ts — Prompt-Bau, Antwort-Extraktion, Fehlertexte.
import type { ChatMessage } from '@/data/types';

import { buildRequestBody, describeError, extractActions, extractText } from './assistant';

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
