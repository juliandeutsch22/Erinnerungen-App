// assistant.test.ts — Prompt-Bau, Antwort-Extraktion, Fehlertexte.
import type { ChatMessage } from '@/data/types';

import { buildRequestBody, describeError, extractText } from './assistant';

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

describe('describeError', () => {
  it('übersetzt die wichtigsten Statuscodes', () => {
    expect(describeError(403)).toContain('Schlüssel');
    expect(describeError(429)).toContain('Kontingent');
    expect(describeError(503)).toContain('nicht erreichbar');
  });
});
