// assistant.ts — Anbindung des KI-Assistenten (Google Gemini, eigener Schlüssel).
// Bewusst OHNE eigenen Server: das Gerät spricht die API direkt an — keine
// laufenden Kosten, kein Mittelsmann. Reine Logik testbar (Prompt-Bau,
// Antwort-Extraktion); der fetch selbst wird im Test nicht ausgeführt.
import type { ChatMessage, List, Note, Task } from '@/data/types';
import { noteTitle } from '@/lib/noteLogic';
import type { DeviceEvent } from '@/lib/deviceCalendar';

// Google zieht Modell-IDs regelmäßig zurück (dann kommt HTTP 404) — darum keine
// einzelne feste ID, sondern Kandidaten-Ketten: die „-latest"-Aliasse zeigen immer
// auf das aktuelle Modell, die versionierten IDs sind das Netz darunter. Greift
// keine, fragt discoverModels() beim Dienst nach, was der Schlüssel wirklich kann.
const MODEL_CHAIN = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
/** Kleinere Lite-Kette, wenn das Tageskontingent des Hauptmodells erschöpft ist (429). */
const LITE_CHAIN = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite'];
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const endpoint = (model: string) => `${API_BASE}/models/${model}:generateContent`;

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

// ——— App-Schnappschuss: kompakter Live-Überblick für JEDEN Chat. ———
// Bewusst NICHT enthalten: die Abendbetrachtung (Journal) — der intimste
// Datenbestand verlässt das Gerät nur, wenn er ausdrücklich verknüpft wird.
const CTX_EVENT_LIMIT = 40;
const CTX_TASK_LIMIT = 40;
const CTX_NOTE_LIMIT = 30;

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Baut den Überblick aus Terminen (~5 Wochen), offenen Aufgaben, Listen und
 *  Notiz-TITELN. Rein und testbar — die Daten reicht der Aufrufer herein. */
export function buildAppContext(input: {
  events: Pick<DeviceEvent, 'title' | 'start' | 'allDay'>[];
  tasks: Task[];
  lists: List[];
  notes: Note[];
  today: string; // 'YYYY-MM-DD'
  /** Kein Kalenderzugriff → das Modell soll „unbekannt" sagen, nicht „keine". */
  calendarDenied?: boolean;
}): string {
  const { events, tasks, lists, notes, today, calendarDenied } = input;
  const listName = new Map(lists.map((l) => [l.id, l.name]));

  const evLine = (e: Pick<DeviceEvent, 'title' | 'start' | 'allDay'>) => {
    const d = e.start;
    const day = `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
    const time = e.allDay ? 'ganztägig' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `- ${day} ${time}: ${e.title}`;
  };
  const eventLines = events.slice(0, CTX_EVENT_LIMIT).map(evLine);

  const open = tasks.filter((t) => t.completedAt === null);
  const sortKey = (t: Task) => `${t.dueDate ?? '9999-12-31'} ${t.dueTime ?? '99:99'}`;
  const taskLine = (t: Task) => {
    const parts = [t.title];
    if (t.dueDate) parts.push(`fällig ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ''}${t.dueDate < today ? ' (überfällig)' : ''}`);
    const ln = listName.get(t.listId);
    if (ln && t.listId !== 'default') parts.push(`Liste „${ln}"`);
    return `- ${parts.join(' · ')}`;
  };
  const taskLines = [...open]
    .sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1))
    .slice(0, CTX_TASK_LIMIT)
    .map(taskLine);

  const projectLines = lists
    .filter((l) => l.id !== 'default')
    .map((l) => {
      const extras = [l.goal ? `Ziel: ${l.goal}` : '', l.deadline ? `Deadline: ${l.deadline}` : ''].filter(Boolean);
      return `- ${l.name}${extras.length ? ` (${extras.join(' · ')})` : ''}`;
    });

  const noteTitles = notes
    .filter((n) => n.deletedAt === null)
    .slice(0, CTX_NOTE_LIMIT)
    .map((n) => `„${noteTitle(n.body)}"`);

  return [
    'ÜBERBLICK über die aktuellen Daten in der App (live):',
    '',
    'Termine der nächsten ~5 Wochen:',
    calendarDenied
      ? '- unbekannt: Die App hat keinen Kalenderzugriff. Sage das ehrlich, statt „keine Termine" zu behaupten.'
      : eventLines.length
        ? eventLines.join('\n')
        : '- keine',
    '',
    'Offene Aufgaben:',
    taskLines.length ? taskLines.join('\n') : '- keine',
    '',
    'Listen/Projekte:',
    projectLines.length ? projectLines.join('\n') : '- keine',
    '',
    `Notizen (nur Titel): ${noteTitles.length ? noteTitles.join(', ') : 'keine'}`,
    '',
    'Beantworte Fragen zu Terminen, Aufgaben und Planung direkt aus diesem Überblick. ' +
      'Erfinde keine Einträge dazu; was hier nicht steht, existiert in der App nicht.',
  ].join('\n');
}

/** Verlauf → Gemini-Format; Kontext wandert in die System-Instruction.
 *  Datum + Uhrzeit gehen IMMER mit — sonst rät das Modell bei „heute Abend"
 *  ein Datum aus seinen Trainingsdaten. */
export function buildRequestBody(messages: ChatMessage[], context: string | null, now: Date = new Date()): unknown {
  const dateLine =
    `Heute ist ${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ` +
    `${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr ` +
    `(ISO: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}). ` +
    'Relative Angaben wie „heute", „morgen" oder „nächste Woche" beziehen sich hierauf.';
  const system =
    `${SYSTEM_PROMPT}\n\n${dateLine}` +
    (context ? `\n\nKontext aus der App:\n${context}` : '');
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
  if (status === 404)
    return (
      'Kein verfügbares Gemini-Modell gefunden — auch die Alternativen nicht. ' +
      'Prüfe, ob der Schlüssel unter aistudio.google.com erstellt wurde.'
    );
  if (status === 429)
    return 'Das Tages-Kontingent des Gratis-Schlüssels ist erschöpft — später erneut versuchen.';
  if (status >= 500)
    return 'Gemini ist gerade überlastet oder nicht erreichbar — die App hat es mehrfach probiert. In ein paar Minuten erneut versuchen.';
  return `Anfrage fehlgeschlagen (HTTP ${status}).`;
}

/** Modell-Liste des Dienstes → bestes Flash- und Lite-Modell (rein, testbar).
 *  Bevorzugt stabile Flash-Modelle, neueste zuerst; Spezialmodelle
 *  (Embedding, Bild, Audio, Preview …) bleiben außen vor. */
export function pickModelsFromList(response: unknown): { model: string | null; lite: string | null } {
  if (typeof response !== 'object' || response === null) return { model: null, lite: null };
  const models = (response as { models?: unknown }).models;
  if (!Array.isArray(models)) return { model: null, lite: null };
  const names = models
    .filter((m): m is { name: string; supportedGenerationMethods?: unknown } =>
      typeof m === 'object' && m !== null && typeof (m as { name?: unknown }).name === 'string')
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => n.startsWith('gemini-'))
    .filter((n) => !/(embedding|image|tts|audio|live|exp|preview)/.test(n));
  // Lexikografisch absteigend ≈ neueste Version zuerst (2.5 vor 2.0).
  names.sort((a, b) => (a < b ? 1 : -1));
  const flash = names.filter((n) => n.includes('flash'));
  const model = flash.find((n) => !n.includes('lite')) ?? names[0] ?? null;
  const lite = flash.find((n) => n.includes('lite')) ?? null;
  return { model, lite };
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

/** Live beim Dienst nachfragen, welche Modelle der Schlüssel kann —
 *  das letzte Netz, wenn alle bekannten IDs 404 liefern. */
async function discoverModels(apiKey: string): Promise<{ model: string | null; lite: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/models?pageSize=1000&key=${encodeURIComponent(apiKey)}`, {
      signal: controller.signal,
    });
    if (!res.ok) return { model: null, lite: null };
    return pickModelsFromList(await res.json());
  } catch {
    return { model: null, lite: null };
  } finally {
    clearTimeout(timer);
  }
}

// Einmal pro App-Lauf ermitteltes, funktionierendes Modell — spätere
// Nachrichten gehen direkt dorthin statt die Kette neu abzulaufen.
let workingModel: string | null = null;
let workingLite: string | null = null;

/** Kette abklappern. Weitergezogen wird bei 404 (Modell weg/umbenannt), 5xx
 *  („überlastet" — jedes Modell hat eigene Kapazität) und Timeout/Netzfehler.
 *  Auth-Fehler (400/401/403) und 429 stoppen sofort — die gelten für den
 *  ganzen Schlüssel, nicht das einzelne Modell. */
async function callChain(chain: string[], remembered: string | null, apiKey: string, body: unknown): Promise<{ res: Response; model: string }> {
  const order = remembered ? [remembered, ...chain.filter((m) => m !== remembered)] : chain;
  let overloaded: { res: Response; model: string } | null = null;
  let notFound: { res: Response; model: string } | null = null;
  let lastError: Error | null = null;
  for (const model of order) {
    let res: Response;
    try {
      res = await callModel(model, apiKey, body);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      continue;
    }
    if (res.status === 404) {
      notFound = { res, model };
      continue;
    }
    if (res.status >= 500) {
      overloaded = { res, model };
      continue;
    }
    return { res, model };
  }
  // 5xx ist die ehrlichere Diagnose als 404 (Discovery greift bei 404 trotzdem).
  const fallback = overloaded ?? notFound;
  if (fallback) return fallback;
  throw lastError ?? new Error('Keine Verbindung — bist du online?');
}

/** Kurze Pause, dann derselbe Aufruf nochmal — Überlast (5xx) ist meist flüchtig. */
const RETRY_DELAY_MS = 1500;

/** Eine Antwort holen. Verschwundene Modelle (404) werden über die Kandidaten-
 *  Kette und notfalls die Modell-Liste des Dienstes überbrückt; Überlast (5xx)
 *  über die Kette + einen kurzen zweiten Versuch; erschöpftes Kontingent (429)
 *  über die Lite-Kette. Wirft Error mit deutscher Meldung. */
export async function askAssistant(apiKey: string, messages: ChatMessage[], context: string | null): Promise<string> {
  const body = buildRequestBody(messages, context);
  let { res, model } = await callChain(MODEL_CHAIN, workingModel, apiKey, body);

  // Alle bekannten IDs sind 404 → beim Dienst nachfragen, was es wirklich gibt.
  if (res.status === 404) {
    const found = await discoverModels(apiKey);
    if (found.lite) workingLite = found.lite;
    if (found.model) {
      model = found.model;
      res = await callModel(model, apiKey, body);
    }
  }
  if (res.ok) workingModel = model;

  // Kontingent erschöpft ODER alles überlastet → die Lite-Kette hat eigenes
  // Kontingent und eigene Kapazität.
  if (res.status === 429 || res.status >= 500) {
    try {
      const lite = await callChain(LITE_CHAIN, workingLite, apiKey, body);
      if (lite.res.ok) {
        res = lite.res;
        workingLite = lite.model;
      } else if (res.status === 429 && lite.res.status !== 404) {
        res = lite.res;
      }
    } catch {
      /* Hauptfehler ist aussagekräftiger als ein Netzfehler der Lite-Kette */
    }
  }

  // Letzte Chance bei Überlast: kurz durchatmen, einmal wiederholen.
  if (!res.ok && res.status >= 500) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    const again = await callModel(model, apiKey, body);
    if (again.ok) {
      res = again;
      workingModel = model;
    }
  }

  if (!res.ok) throw new Error(describeError(res.status));
  const text = extractText(await res.json());
  if (!text) throw new Error('Leere Antwort erhalten — versuch es nochmal.');
  return text;
}
