// assistant.ts — Anbindung des KI-Assistenten (Google Gemini, eigener Schlüssel).
// Bewusst OHNE eigenen Server: das Gerät spricht die API direkt an — keine
// laufenden Kosten, kein Mittelsmann. Reine Logik testbar (Prompt-Bau,
// Antwort-Extraktion); der fetch selbst wird im Test nicht ausgeführt.
import type { ChatMessage } from '@/data/types';
import type { DeviceEvent } from '@/lib/deviceCalendar';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** Wie viele Verlaufs-Nachrichten mitgeschickt werden (Kosten-/Limit-Schutz). */
const HISTORY_LIMIT = 24;

export const SYSTEM_PROMPT =
  'Du bist der Assistent der App „Stoa" — einer ruhigen deutschen Erinnerungs-, ' +
  'Kalender- und Notizen-App. Antworte auf Deutsch, knapp und konkret. ' +
  'Wenn Reisedaten und ein Ort bekannt sind und der Nutzer nach Unterkünften, ' +
  'Restaurants o. Ä. fragt: gib konkrete Kriterien/Empfehlungen UND fertige ' +
  'Such-Links (z. B. https://www.airbnb.de/s/ORT/homes?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD ' +
  'oder https://www.booking.com/searchresults.de.html?ss=ORT&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD). ' +
  'Du hast KEINEN Live-Internetzugriff — sage das ehrlich, wenn aktuelle Preise/' +
  'Verfügbarkeiten gefragt sind, und liefere stattdessen die besten Links und Kriterien. ' +
  'Nutze schlichtes Markdown (Listen, **fett**), keine Tabellen.';

/** Termin-Kontext beim Anlegen des Chats einfrieren (lesbar ohne Kalenderzugriff). */
export function buildEventContext(ev: DeviceEvent): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) +
    (ev.allDay ? '' : ` ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`);
  const lines = [
    `Termin: ${ev.title}`,
    `Beginn: ${fmt(ev.start)}`,
    `Ende: ${fmt(ev.end)}`,
    `Check-in-Datum (ISO): ${ev.start.toISOString().slice(0, 10)}`,
    `Check-out-Datum (ISO): ${ev.end.toISOString().slice(0, 10)}`,
  ];
  if (ev.notes) lines.push(`Notizen zum Termin: ${ev.notes}`);
  return lines.join('\n');
}

/** Verlauf → Gemini-Format; Kontext wandert in die System-Instruction. */
export function buildRequestBody(messages: ChatMessage[], context: string | null): unknown {
  const system = context ? `${SYSTEM_PROMPT}\n\nKontext des verknüpften Termins:\n${context}` : SYSTEM_PROMPT;
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.slice(-HISTORY_LIMIT).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
  };
}

/** Antworttext aus der Gemini-Response ziehen (defensiv). */
export function extractText(response: unknown): string | null {
  if (typeof response !== 'object' || response === null) return null;
  const candidates = (response as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const parts = (candidates[0] as { content?: { parts?: { text?: string }[] } }).content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((p) => p.text ?? '').join('').trim();
  return text.length > 0 ? text : null;
}

/** Fehler in eine ruhige deutsche Meldung übersetzen. */
export function describeError(status: number): string {
  if (status === 400 || status === 401 || status === 403)
    return 'Der API-Schlüssel wurde abgelehnt. Prüfe ihn in den Einstellungen.';
  if (status === 429)
    return 'Das Tages-Kontingent des Gratis-Schlüssels ist erschöpft — später erneut versuchen.';
  if (status >= 500) return 'Der Dienst ist gerade nicht erreichbar. Versuch es gleich nochmal.';
  return `Anfrage fehlgeschlagen (HTTP ${status}).`;
}

/** Eine Antwort holen. Wirft Error mit lesbarer deutscher Meldung. */
export async function askAssistant(apiKey: string, messages: ChatMessage[], context: string | null): Promise<string> {
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(messages, context)),
  });
  if (!res.ok) throw new Error(describeError(res.status));
  const text = extractText(await res.json());
  if (!text) throw new Error('Leere Antwort erhalten — versuch es nochmal.');
  return text;
}
