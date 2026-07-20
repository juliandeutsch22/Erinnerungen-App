// assistant.ts — Anbindung des KI-Assistenten (Google Gemini, eigener Schlüssel).
// Bewusst OHNE eigenen Server: das Gerät spricht die API direkt an — keine
// laufenden Kosten, kein Mittelsmann. Reine Logik testbar (Prompt-Bau,
// Antwort-Extraktion); der fetch selbst wird im Test nicht ausgeführt.
import type { ChatMessage, Note, Task } from '@/data/types';
import { noteTitle } from '@/lib/noteLogic';
import type { DeviceEvent } from '@/lib/deviceCalendar';

const MODEL = 'gemini-2.5-flash';
/** Fallback, wenn das Tageskontingent des Hauptmodells erschöpft ist (429). */
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const endpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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
  'Nutze schlichtes Markdown (Listen, **fett**), keine Tabellen. ' +
  'AKTIONEN: Wenn der Nutzer dich bittet, Aufgaben/Erinnerungen oder eine Checkliste ' +
  'ANZULEGEN (z. B. „mach mir daraus Aufgaben", „erstelle eine Packliste"), hänge ans ' +
  'ENDE deiner Antwort GENAU EINEN Block in diesem Format an:\n' +
  '```stoa-aktionen\n{"aufgaben":[{"titel":"…","datum":"YYYY-MM-DD","zeit":"HH:MM"}],"checkliste":["…"],"notizen":["…"]}\n```\n' +
  'datum/zeit sind optional; „checkliste" nur, wenn der Chat zu einer Notiz gehört; ' +
  '„notizen" für Gedanken/Ideen ohne Handlung (erste Zeile wird der Titel). ' +
  'Nutze den Block NUR bei einer ausdrücklichen Anlege-Bitte, nie ungefragt.';

/** Braindump: ein Wurf unsortierter Gedanken → NUR der Aktions-Block. */
export function buildBraindumpContext(todayLabel: string): string {
  return (
    `Heute ist ${todayLabel}. Der Nutzer kippt einen unsortierten Braindump ab. ` +
    'Zerlege ALLES vollständig in den stoa-aktionen-Block: Handlungen → "aufgaben" ' +
    '(mit datum/zeit, wenn erkennbar — relative Angaben wie „morgen" auflösen), ' +
    'Gedanken/Ideen/Fakten → "notizen" (sinnvoll gruppiert, erste Zeile = Titel). ' +
    'Keine "checkliste". Antworte mit maximal einem kurzen Satz plus dem Block — nichts darf verloren gehen.'
  );
}

// ——— Aktions-Block: strukturierte Vorschläge aus der Antwort ziehen. ———
export type AssistantAction = {
  aufgaben: { titel: string; datum?: string; zeit?: string }[];
  checkliste: string[];
  notizen: string[];
};

const ACTION_RE = /```stoa-aktionen\s*\n([\s\S]*?)```/;

/** Trennt den Aktions-Block vom Anzeigetext (tolerant gegen kaputtes JSON). */
export function extractActions(text: string): { clean: string; actions: AssistantAction | null } {
  const m = ACTION_RE.exec(text);
  if (!m) return { clean: text, actions: null };
  const clean = text.replace(ACTION_RE, '').trim();
  // Modelle setzen gelegentlich ECHTE Zeilenumbrüche in JSON-Strings —
  // erster Versuch roh, zweiter mit escapten Newlines.
  const jsonText = m[1].trim();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    try {
      raw = JSON.parse(jsonText.replace(/\r?\n/g, '\\n')) as Record<string, unknown>;
    } catch {
      return { clean, actions: null };
    }
  }
  try {
    const aufgaben = Array.isArray(raw.aufgaben)
      ? raw.aufgaben
          .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
          .filter((a) => typeof a.titel === 'string' && (a.titel as string).trim().length > 0)
          .map((a) => ({
            titel: (a.titel as string).trim(),
            datum: typeof a.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.datum) ? a.datum : undefined,
            zeit: typeof a.zeit === 'string' && /^\d{2}:\d{2}$/.test(a.zeit) ? a.zeit : undefined,
          }))
      : [];
    const checkliste = Array.isArray(raw.checkliste)
      ? raw.checkliste.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim())
      : [];
    const notizen = Array.isArray(raw.notizen)
      ? raw.notizen.filter((n): n is string => typeof n === 'string' && n.trim().length > 0).map((n) => n.trim())
      : [];
    if (aufgaben.length === 0 && checkliste.length === 0 && notizen.length === 0) return { clean, actions: null };
    return { clean, actions: { aufgaben, checkliste, notizen } };
  } catch {
    return { clean, actions: null };
  }
}

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

/** Notiz-Kontext — wird bei JEDEM Senden frisch gebaut (Live-Zugriff). */
const NOTE_CONTEXT_LIMIT = 8000;
export function buildNoteContext(note: Note): string {
  const body = note.body.length > NOTE_CONTEXT_LIMIT ? `${note.body.slice(0, NOTE_CONTEXT_LIMIT)}\n[gekürzt]` : note.body;
  return `Der Chat gehört zu dieser Notiz („${noteTitle(note.body)}"). Aktueller Inhalt:\n---\n${body}\n---`;
}

/** Aufgaben-Kontext — ebenfalls live beim Senden. */
export function buildTaskContext(task: Task): string {
  const lines = [`Der Chat gehört zu dieser Erinnerung: „${task.title}"`];
  if (task.dueDate) lines.push(`Fällig: ${task.dueDate}${task.dueTime ? ` um ${task.dueTime}` : ''}`);
  if (task.note) lines.push(`Notiz zur Aufgabe: ${task.note}`);
  if (task.subtasks.length > 0)
    lines.push(`Unteraufgaben: ${task.subtasks.map((s) => `${s.done ? '[x]' : '[ ]'} ${s.title}`).join('; ')}`);
  if (task.tags.length > 0) lines.push(`Tags: ${task.tags.map((t) => `#${t}`).join(' ')}`);
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

/** Harte Obergrenze — ein hängender Request darf den Chat nicht blockieren. */
const TIMEOUT_MS = 30000;

async function callModel(model: string, apiKey: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${endpoint(model)}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) throw new Error('Zeitüberschreitung — der Dienst antwortet nicht. Erneut versuchen.');
    throw new Error('Keine Verbindung — bist du online?');
  } finally {
    clearTimeout(timer);
  }
}

/** Eine Antwort holen. Bei erschöpftem Kontingent (429) wird einmal aufs
 *  kleinere Flash-Lite-Modell ausgewichen. Wirft Error mit deutscher Meldung. */
export async function askAssistant(apiKey: string, messages: ChatMessage[], context: string | null): Promise<string> {
  const body = buildRequestBody(messages, context);
  let res = await callModel(MODEL, apiKey, body);
  if (res.status === 429) res = await callModel(FALLBACK_MODEL, apiKey, body);
  if (!res.ok) throw new Error(describeError(res.status));
  const text = extractText(await res.json());
  if (!text) throw new Error('Leere Antwort erhalten — versuch es nochmal.');
  return text;
}
