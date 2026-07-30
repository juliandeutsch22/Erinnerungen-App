// assistant.ts — Anbindung des KI-Assistenten (Google Gemini, eigener Schlüssel).
// Bewusst OHNE eigenen Server: das Gerät spricht die API direkt an — keine
// laufenden Kosten, kein Mittelsmann. Reine Logik testbar (Prompt-Bau,
// Antwort-Extraktion); der fetch selbst wird im Test nicht ausgeführt.
import { type ChatMessage, type List, type Note, newId, normalizeTag, type Rrule, type Subtask, type Task } from '@/data/types';
import { anchorWeekdayRrule, isRrule, rruleLabel } from '@/lib/dates';
import { noteTitle } from '@/lib/noteLogic';
import type { DeviceEvent } from '@/lib/deviceCalendar';

// Google zieht Modell-IDs regelmäßig zurück (dann kommt HTTP 404) — darum keine
// einzelne feste ID, sondern Kandidaten-Ketten: die „-latest"-Aliasse zeigen immer
// auf das aktuelle Modell, die versionierten IDs sind das Netz darunter. Greift
// keine, fragt discoverModels() beim Dienst nach, was der Schlüssel wirklich kann.
export const MODEL_CHAIN = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
/** Kleinere Lite-Kette — AUSSCHLIESSLICH als Rückfall, wenn das Tageskontingent
 *  des Hauptmodells erschöpft ist (429) oder alles überlastet ist (5xx). Sie
 *  wird bewusst NIE vorgezogen; siehe UEBERGABE §8.31. */
export const LITE_CHAIN = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite'];
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Streaming läuft über denselben Dienst, nur als Server-Sent-Events —
// der Status kommt VOR dem Body, darum funktioniert die ganze Ketten-Logik
// (404/429/5xx) für beide Endpunkte identisch.
const endpoint = (model: string, stream: boolean) =>
  `${API_BASE}/models/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}`;

/** Wie viele Verlaufs-Nachrichten mitgeschickt werden (Kosten-/Limit-Schutz). */
const HISTORY_LIMIT = 24;
/** Obergrenze für den Merkzettel — er geht bei JEDEM Aufruf mit. */
export const MEMORY_LIMIT = 800;
/** Obergrenze für die Checkliste einer Aktions-Aufgabe. */
export const SCHRITTE_LIMIT = 50;
/** Wie viele Bilder höchstens mit einer Anfrage gehen — Bilder kosten auf dem
 *  eigenen Schlüssel ein Vielfaches von Text. */
export const IMAGE_LIMIT = 3;

/** Ein Bild für den Assistenten: Base64 + MIME-Typ, wie Gemini es erwartet.
 *  Wird NICHT gespeichert — es lebt genau eine Anfrage lang. */
export type AssistantImage = { mimeType: string; data: string };

// ——— System-Prompt in Abschnitten. ———
// Er geht bei JEDER Anfrage mit und ist über die Releases stark gewachsen —
// Bilder, Nachsehen, Ändern, Schritte, Wiederholungen, Projekte. Das kostet
// Zeit bis zum ersten Wort, und zwar auch dort, wo die Regeln gar nicht gelten:
// Der Braindump kann nichts ändern und hat keine Werkzeuge, bekam die Regeln
// dafür aber trotzdem. Deshalb wird der Prompt seit v1.46.0 je nach
// Einstiegspunkt zusammengesetzt.

const P_ROLLE =
  'Du bist der Assistent der App „Stoa" — einer ruhigen deutschen Erinnerungs-, ' +
  'Kalender- und Notizen-App. Antworte auf Deutsch, knapp und konkret. ';

const P_REISE =
  'Wenn Reisedaten und ein Ort bekannt sind und der Nutzer nach Unterkünften, ' +
  'Restaurants o. Ä. fragt: gib konkrete Kriterien/Empfehlungen UND fertige ' +
  'Such-Links (z. B. https://www.airbnb.de/s/ORT/homes?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD ' +
  'oder https://www.booking.com/searchresults.de.html?ss=ORT&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD). ' +
  'Du hast KEINEN Live-Internetzugriff — sage das ehrlich, wenn aktuelle Preise/' +
  'Verfügbarkeiten gefragt sind, und liefere stattdessen die besten Links und Kriterien. ' +
  'Nutze schlichtes Markdown (Listen, **fett**), keine Tabellen. ';

const P_AKTIONEN_KOPF =
  'AKTIONEN: Wenn der Nutzer dich bittet, Aufgaben/Erinnerungen, Termine oder eine Checkliste ' +
  'ANZULEGEN (z. B. „mach mir daraus Aufgaben", „trag das als Termin ein", „erstelle eine Packliste"), ' +
  'hänge ans ENDE deiner Antwort GENAU EINEN Block in diesem Format an:\n```stoa-aktionen\n';

// Die Vorlage nennt nur, was am jeweiligen Einstiegspunkt auch anwendbar ist.
// Beim reinen Erfassen fehlen „aenderungen" (keine Handles) und „checkliste"
// (kein Chat zu einer Notiz) — ein Feld zu zeigen, das hinterher verworfen
// wird, lädt das Modell nur ein, es zu füllen.
const AKTIONEN_JSON_VOLL =
  '{"aufgaben":[{"titel":"…","datum":"YYYY-MM-DD","zeit":"HH:MM","schritte":["…"],"wiederholung":"weekly","tags":["…"],"notiz":"…"}],"termine":[{"titel":"…","datum":"YYYY-MM-DD","start":"HH:MM","ende":"HH:MM","notiz":"…"}],"listen":[{"name":"…","ziel":"…","deadline":"YYYY-MM-DD"}],"aenderungen":[{"handle":"abc123","erledigt":true,"datum":"YYYY-MM-DD","zeit":"HH:MM","titel":"…","liste":"…","papierkorb":true}],"checkliste":["…"],"notizen":["…"]}';

const AKTIONEN_JSON_ERFASSEN =
  '{"aufgaben":[{"titel":"…","datum":"YYYY-MM-DD","zeit":"HH:MM","schritte":["…"],"wiederholung":"weekly","tags":["…"],"notiz":"…"}],"termine":[{"titel":"…","datum":"YYYY-MM-DD","start":"HH:MM","ende":"HH:MM","notiz":"…"}],"listen":[{"name":"…","ziel":"…","deadline":"YYYY-MM-DD"}],"notizen":["…"]}';

const P_AKTIONEN_RUMPF =
  '\n```\n' +
  '„aufgaben" sind zu ERLEDIGENDE Handlungen (anrufen, kaufen, vorbereiten), datum/zeit optional. ' +
  '„wiederholung" nur bei ausdrücklich wiederkehrenden Dingen: "daily", "weekly", "monthly", "yearly", ' +
  'oder mit Abstand "every:2w" (alle 2 Wochen; d=Tage, w=Wochen, m=Monate, y=Jahre), ' +
  'oder ab Erledigung gerechnet "after:3d" („3 Tage nachdem ich es erledigt habe"), ' +
  'oder an festen Wochentagen "wd:1,4" (0=So, 1=Mo … 6=Sa; „jeden Montag und Donnerstag"); ' +
  'für Montag bis Freitag gibt es "weekdays". ' +
  '„tags" sind kurze Schlagworte ohne #; „notiz" ist Zusatzkontext an der Aufgabe (Nummern, Adressen, Details). ' +
  '„listen" legt ein neues Projekt an — NUR wenn der Nutzer ein größeres Vorhaben beschreibt und ' +
  'keine passende Liste existiert. Aufgaben dazu bekommen dann "liste" mit genau diesem Namen. ' +
  'WICHTIG — „schritte": Wenn viele Einzelteile zu EINEM Gang oder EINER Handlung gehören, ' +
  'ist das EINE Aufgabe mit „schritte", NICHT viele Aufgaben. Eine Einkaufsliste ' +
  '(„Milch, Brot, Butter, Äpfel") ist EINE Aufgabe „Einkaufen" mit den Dingen als schritte — ' +
  'man geht einmal los, nicht viermal. Ebenso Packlisten, Zutaten, Besorgungen an einem Ort, ' +
  'Teilschritte eines Vorhabens. Getrennte Aufgaben nur, wenn die Dinge wirklich unabhängig ' +
  'voneinander erledigt werden (verschiedene Orte, verschiedene Tage, verschiedene Anlässe). ' +
  '„termine" sind feste Verabredungen zu einem Zeitpunkt (Arzttermin, Meeting, Kino, Zug, Geburtstag) — ' +
  'sie landen im Gerätekalender; datum ist Pflicht, start/ende optional (ohne start = ganztägig). ' +
  'Im Zweifel: fester Zeitpunkt/Verabredung → Termin, etwas zu TUN → Aufgabe. ';

const P_CHECKLISTE = '„checkliste" nur, wenn der Chat zu einer Notiz gehört; ';

const P_NOTIZEN = '„notizen" für Gedanken/Ideen ohne Handlung (erste Zeile wird der Titel). ';

function pAktionen(mode: PromptMode): string {
  return (
    P_AKTIONEN_KOPF +
    (mode === 'erfassen' ? AKTIONEN_JSON_ERFASSEN : AKTIONEN_JSON_VOLL) +
    P_AKTIONEN_RUMPF +
    (mode === 'erfassen' ? '' : P_CHECKLISTE) +
    P_NOTIZEN
  );
}

const P_BILDER =
  'BILDER: Ist ein Bild dabei, LIES es — abfotografierte Zettel, Einkaufslisten, Aushänge, ' +
  'Briefe, Whiteboards. Übernimm nur, was wirklich draufsteht, und rate nichts dazu; ' +
  'was du nicht entziffern kannst, lässt du weg oder sagst es. Aus dem Gelesenen werden ' +
  'wie sonst auch Aufgaben, Termine und Notizen — eine abfotografierte Einkaufsliste ist ' +
  'EINE Aufgabe mit „schritte". ';

const P_NACHSEHEN =
  'NACHSEHEN: Reicht der App-Überblick nicht, benutze die Werkzeuge statt zu raten — ' +
  'aufgaben_suchen (auch erledigte, auch außerhalb des Überblicks), liste_inhalt (eine Liste ' +
  'vollständig), notiz_lesen (der Überblick zeigt nur Notiz-TITEL, nie den Inhalt). ' +
  'Erfinde nie Einträge, die du nicht gesehen hast — lieber nachschlagen oder ehrlich sagen, ' +
  'dass du es nicht weißt. ';

const P_AENDERN =
  'ÄNDERN: „aenderungen" bearbeitet BESTEHENDE Aufgaben („verschieb das auf Montag", ' +
  '„hak die drei ab", „schieb das in die Liste Umzug"). „handle" ist das Kürzel in eckigen ' +
  'Klammern aus dem App-Überblick — NUR dort gesehene Handles verwenden, nie erfundene, ' +
  'und nur Felder angeben, die sich wirklich ändern. „erledigt":true hakt ab, ' +
  '"papierkorb":true legt in den Papierkorb (wiederherstellbar). ' +
  'ENDGÜLTIG LÖSCHEN KANNST DU NICHT — biete es auch nicht an. ' +
  'Ohne App-Überblick (keine Handles sichtbar) gibt es keine „aenderungen". ' +
  'Nutze den Block NUR bei einer ausdrücklichen Anlege- oder Änderungs-Bitte, nie ungefragt.';

/** Antwort-Schema für den JSON-Zwang. Bewusst nur die Felder, die beim reinen
 *  ERFASSEN gebraucht werden — Änderungen und Checklisten gibt es dort nicht. */
const ACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    aufgaben: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          titel: { type: 'STRING' },
          datum: { type: 'STRING' },
          zeit: { type: 'STRING' },
          liste: { type: 'STRING' },
          notiz: { type: 'STRING' },
          wiederholung: { type: 'STRING' },
          tags: { type: 'ARRAY', items: { type: 'STRING' } },
          schritte: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['titel'],
      },
    },
    termine: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          titel: { type: 'STRING' },
          datum: { type: 'STRING' },
          start: { type: 'STRING' },
          ende: { type: 'STRING' },
          notiz: { type: 'STRING' },
        },
        required: ['titel', 'datum'],
      },
    },
    listen: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, ziel: { type: 'STRING' }, deadline: { type: 'STRING' } },
        required: ['name'],
      },
    },
    notizen: { type: 'ARRAY', items: { type: 'STRING' } },
  },
} as const;

/** Was der Assistent an dieser Stelle überhaupt darf — daraus folgt der Prompt. */
export type PromptMode =
  /** Chat/Verwalter: alles, inklusive Nachsehen und Ändern. */
  | 'voll'
  /** Braindump/Sprach-Sheet: nur erfassen. Kein Ändern (keine Handles), keine
   *  Werkzeuge (kein App-Überblick), keine Reise-Links (kein Gespräch). */
  | 'erfassen';

export function systemPrompt(mode: PromptMode = 'voll'): string {
  if (mode === 'erfassen') return P_ROLLE + pAktionen(mode) + P_BILDER;
  return P_ROLLE + P_REISE + pAktionen(mode) + P_BILDER + P_NACHSEHEN + P_AENDERN;
}

/** Der vollständige Prompt — Bestandsschutz für Tests und Aufrufer. */
export const SYSTEM_PROMPT = systemPrompt('voll');

/** Braindump: ein Wurf unsortierter Gedanken → NUR der Aktions-Block. */
export function buildBraindumpContext(todayLabel: string, strict = false, listen: string[] = []): string {
  return (
    `Heute ist ${todayLabel}. Der Nutzer kippt einen unsortierten Braindump ab. ` +
    'Zerlege ALLES vollständig in den stoa-aktionen-Block: zu erledigende Handlungen → "aufgaben" ' +
    '(mit datum/zeit, wenn erkennbar — relative Angaben wie „morgen" auflösen); ' +
    'feste Verabredungen zu einer Uhrzeit (Arzttermin, Meeting, Zug, Kino) → "termine" ' +
    '(datum Pflicht, start/ende optional); ' +
    'Gedanken/Ideen/Fakten → "notizen" (sinnvoll gruppiert, erste Zeile = Titel). ' +
    // Ohne diese Regel zerlegt das Modell eine eingefügte Einkaufsliste in
    // sieben Einzelaufgaben — man geht aber einmal einkaufen, nicht siebenmal.
    'BÜNDELN statt zerstückeln: Gehören mehrere Einzelteile zu EINEM Gang oder EINER Handlung, ' +
    'ist das EINE Aufgabe mit "schritte" (Array von Strings), nicht mehrere Aufgaben. ' +
    'Eine eingefügte Einkaufsliste („Milch, Brot, Butter") wird EINE Aufgabe „Einkaufen" mit den ' +
    'Dingen als schritte. Dasselbe gilt für Packlisten, Zutaten und Besorgungen an einem Ort. ' +
    'Getrennte Aufgaben nur bei wirklich unabhängigen Dingen (anderer Ort, anderer Tag, anderer Anlass). ' +
    'Erkennbar Wiederkehrendes („jeden Dienstag", „alle zwei Wochen") bekommt "wiederholung" ' +
    '("daily"/"weekly"/"monthly"/"yearly", "every:2w", "after:3d") statt vieler Einzeltermine. ' +
    'Zusatzkontext (Nummern, Adressen, Details) gehört als "notiz" an die Aufgabe, nicht in den Titel. ' +
    'Beschreibt der Wurf ein größeres Vorhaben, für das keine Liste existiert, lege über "listen" ' +
    'ein Projekt an und setze bei den zugehörigen Aufgaben "liste" auf genau diesen Namen. ' +
    'Keine "checkliste". Antworte mit maximal einem kurzen Satz plus dem Block — nichts darf verloren gehen. ' +
    // Der Nutzer hat Listen/Projekte — Aufgaben sollen dort landen, wo sie
    // hingehören, statt pauschal im Eingang. Unsicher → Feld weglassen.
    (listen.length > 0
      ? `Der Nutzer hat diese Listen: ${listen.map((l) => `„${l}"`).join(', ')}. ` +
        'Gib bei jeder Aufgabe zusätzlich "liste" mit dem passenden Listennamen an — ' +
        'aber NUR, wenn die Zuordnung klar ist; im Zweifel das Feld weglassen. '
      : '') +
    'Gib den stoa-aktionen-Block IMMER aus — auch bei kurzen, stichpunktartigen oder ' +
    'listenartigen Eingaben (z. B. „Titel:" gefolgt von Zeilen). Überschriften/Doppelpunkt-' +
    'Zeilen sind Kontext, die Zeilen darunter werden Aufgaben oder Notizen. Wenn etwas eine ' +
    'Handlung sein könnte, mach eine Aufgabe daraus; sonst eine Notiz. Antworte NIE mit leeren Händen.' +
    (strict
      ? ' WICHTIG: Deine letzte Antwort enthielt keinen gültigen Block. Gib jetzt ZWINGEND ' +
        'den ```stoa-aktionen```-Block mit mindestens einem Eintrag zurück — jede Zeile der ' +
        'Eingabe wird zu einer Aufgabe (Handlung), einem Schritt einer Aufgabe oder einer Notiz.'
      : '')
  );
}

// ——— Aktions-Block: strukturierte Vorschläge aus der Antwort ziehen. ———
export type AssistantAction = {
  aufgaben: {
    titel: string;
    datum?: string;
    zeit?: string;
    /** Zielliste (Name, wie vom Modell vorgeschlagen) — wird beim Anlegen aufgelöst. */
    liste?: string;
    /** Checkliste INNERHALB der Aufgabe (Einkaufsliste, Packliste, Teilschritte).
     *  Wird zu `Task.subtasks` — nicht zu eigenen Aufgaben. */
    schritte?: string[];
    /** Wiederholung als Rrule ('weekly', 'every:2w', 'after:3d', 'wd:1,4') — geprüft über isRrule. */
    wiederholung?: Rrule;
    tags?: string[];
    /** Zusatzkontext an der Aufgabe (Nummern, Adressen) statt im Titel. */
    notiz?: string;
  }[];
  /** Feste Verabredungen → Gerätekalender. datum Pflicht; ohne start = ganztägig. */
  termine: { titel: string; datum: string; start?: string; ende?: string; notiz?: string }[];
  /** Neue Projekte/Listen. Werden VOR den Aufgaben angelegt, damit deren
   *  „liste" auf die frische Liste zeigen kann. */
  listen: { name: string; ziel?: string; deadline?: string }[];
  /** Änderungen an BESTEHENDEN Aufgaben, adressiert über `taskHandle`.
   *  Bewusst OHNE endgültiges Löschen — `papierkorb` ist wiederherstellbar. */
  aenderungen: {
    handle: string;
    erledigt?: boolean;
    datum?: string | null;
    zeit?: string | null;
    titel?: string;
    liste?: string;
    papierkorb?: boolean;
  }[];
  checkliste: string[];
  notizen: string[];
};

/**
 * Löst einen vom Modell vorgeschlagenen Listennamen auf die echte Listen-ID auf.
 * Tolerant (Groß-/Kleinschreibung, Leerzeichen); ohne klaren Treffer bleibt es
 * beim Eingang (`fallback`) — lieber im Eingang als in der falschen Liste.
 */
export function resolveListId(
  name: string | undefined,
  lists: { id: string; name: string }[],
  fallback = 'default',
): string {
  if (!name) return fallback;
  const needle = name.trim().toLowerCase();
  if (needle.length === 0) return fallback;
  const exact = lists.find((l) => l.name.trim().toLowerCase() === needle);
  return exact ? exact.id : fallback;
}

/**
 * Fälligkeit einer Aktions-Aufgabe. Eine Wiederholung OHNE Datum läuft NIE an:
 * `resolveCompletion` verlangt rrule UND dueDate, sonst hakt es die Aufgabe
 * einmalig ab. Der Editor verankert deshalb auf heute
 * (`dueDate ?? (validTime || rrule ? today : null)`) — der Assistent muss
 * dasselbe tun, sonst trägt die Aufgabe sichtbar „Wöchentlich" und kehrt nie
 * zurück.
 */
export function actionDueDate(a: { datum?: string; wiederholung?: Rrule }, today: string): string | null {
  // Ein genanntes Datum gilt; nur das ABGELEITETE „heute" wird bei festen
  // Wochentagen auf den nächsten passenden Tag gesetzt (anchorWeekdayRrule).
  if (a.datum) return a.datum;
  return a.wiederholung ? anchorWeekdayRrule(today, a.wiederholung) : null;
}

/**
 * Enthält der Block etwas, das ERFASST werden kann? Braindump und Sprach-Sheet
 * haben keinen App-Überblick, also keine Handles, also können sie
 * „aenderungen" nicht anwenden. Ein Block, der NUR daraus besteht, wäre dort
 * eine Vorschlagskarte ohne Zeilen mit totem Knopf.
 */
export function hasCapturableActions(a: AssistantAction): boolean {
  return a.aufgaben.length + a.termine.length + a.listen.length + a.notizen.length > 0;
}

/** Schritte einer Aktions-Aufgabe → echte Unteraufgaben. An EINER Stelle, damit
 *  Chat, Braindump und Sprach-Sheet dieselbe Checkliste anlegen. */
export function subtasksFromSchritte(schritte: string[] | undefined): Subtask[] {
  return (schritte ?? []).map((title) => ({ id: newId(), title, done: false }));
}

/** Tags robust lesen: Array oder ein String mit Kommas; normalisiert wie in der
 *  App (klein, ohne #, keine Leerzeichen) und auf 6 gedeckelt. */
function parseTags(raw: unknown): string[] | undefined {
  const items = Array.isArray(raw)
    ? raw.filter((t): t is string => typeof t === 'string')
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  const out = [...new Set(items.map(normalizeTag).filter((t) => t.length > 0))].slice(0, 6);
  return out.length > 0 ? out : undefined;
}

/** Zusatz-Merkmale einer Aktions-Aufgabe für die Bestätigungskarte
 *  (Wiederholung, Tags) — sichtbar, BEVOR etwas angelegt wird. */
export function describeExtras(a: { wiederholung?: Rrule; tags?: string[] }): string | null {
  const parts = [a.wiederholung ? rruleLabel(a.wiederholung) : '', (a.tags ?? []).map((t) => `#${t}`).join(' ')];
  const text = parts.filter(Boolean).join(' · ');
  return text.length > 0 ? text : null;
}

/** Eine Änderung im Klartext — sie muss VOR dem Übernehmen lesbar sein, weil
 *  sie im Gegensatz zum Anlegen etwas Bestehendes anfasst. */
export function describeAenderung(
  c: AssistantAction['aenderungen'][number],
  formatDatum: (d: string) => string,
): string {
  const parts: string[] = [];
  if (c.erledigt) parts.push('abhaken');
  if (c.papierkorb) parts.push('in den Papierkorb');
  if (c.titel) parts.push(`umbenennen in „${c.titel}"`);
  if (c.liste) parts.push(`in die Liste „${c.liste}"`);
  if (c.datum === null) parts.push('Datum entfernen');
  else if (c.datum) parts.push(`auf ${formatDatum(c.datum)}${c.zeit ? ` · ${c.zeit} Uhr` : ''}`);
  else if (c.zeit === null) parts.push('Uhrzeit entfernen');
  else if (c.zeit) parts.push(`auf ${c.zeit} Uhr`);
  return parts.join(' · ');
}

/** Kurzfassung der Schritte für die Bestätigungskarte — du sollst VOR dem
 *  Übernehmen sehen, dass eine Aufgabe mit Checkliste entsteht und keine sieben. */
export function describeSchritte(schritte: string[] | undefined): string | null {
  if (!schritte || schritte.length === 0) return null;
  const wort = schritte.length === 1 ? 'Schritt' : 'Schritte';
  return `${schritte.length} ${wort}: ${schritte.slice(0, 3).join(', ')}${schritte.length > 3 ? ' …' : ''}`;
}

const ACTION_OPEN = '```stoa-aktionen';
const ACTION_RE = /```stoa-aktionen\s*\n([\s\S]*?)```/;

/**
 * Schritte einer Aufgabe robust lesen. Modelle liefern hier mal ein Array, mal
 * einen einzelnen String mit Zeilenumbrüchen/Kommas — beides ist gemeint, und
 * eine verworfene Einkaufsliste wäre der teuerste Fehler an dieser Stelle.
 * Leer → undefined, damit die Aufgabe wie bisher ohne Checkliste entsteht.
 */
function parseSchritte(raw: unknown): string[] | undefined {
  const items = Array.isArray(raw)
    ? raw.filter((s): s is string => typeof s === 'string')
    : typeof raw === 'string'
      ? raw.split(/\r?\n|[;,]/)
      : [];
  // Gedeckelt: ein entgleistes Modell soll keine 300 Unteraufgaben anlegen.
  const out = items
    .map((s) => s.replace(/^[-*•\s]*(\[[ xX]\])?\s*/, '').trim())
    .filter((s) => s.length > 0)
    .slice(0, SCHRITTE_LIMIT);
  return out.length > 0 ? out : undefined;
}

/** Trennt den Aktions-Block vom Anzeigetext (tolerant gegen kaputtes JSON). */
export function extractActions(text: string): { clean: string; actions: AssistantAction | null } {
  const m = ACTION_RE.exec(text);
  // Im JSON-Zwang (responseSchema) gibt es keinen umschließenden Block, sondern
  // NUR das JSON — dann ist die ganze Antwort der Aktions-Block und es bleibt
  // kein Anzeigetext übrig.
  if (!m) {
    const roh = text.trim();
    if (roh.startsWith('{')) {
      const actions = parseActionJson(roh);
      // Lässt es sich NICHT lesen, ist es kein Aktions-Block, sondern eben Text.
      // Ihn hier wegzuwerfen ließ den Braindump „Seine Antwort:" ankündigen und
      // dann schweigen — eine Sackgasse ohne jeden Anhaltspunkt.
      return actions ? { clean: '', actions } : { clean: text, actions: null };
    }
    // ANGEFANGENER, aber nie geschlossener Block: Die Antwort wurde mitten im
    // JSON abgeschnitten (Token-Limit). Ohne diesen Zweig stand das halbe JSON
    // als Fließtext auf dem Bildschirm — `ACTION_RE` braucht die schließende
    // Klammer und greift dann gar nicht. Der Prosa-Teil bleibt, der Rumpf geht.
    const offen = text.indexOf(ACTION_OPEN);
    if (offen >= 0) return { clean: text.slice(0, offen).trim(), actions: null };
    return { clean: text, actions: null };
  }
  const clean = text.replace(ACTION_RE, '').trim();
  // Modelle setzen gelegentlich ECHTE Zeilenumbrüche in JSON-Strings —
  // erster Versuch roh, zweiter mit escapten Newlines.
  return { clean, actions: parseActionJson(m[1].trim()) };
}

/** Der eigentliche Parser — tolerant gegen echte Zeilenumbrüche in JSON-Strings
 *  (die liefern Modelle regelmäßig) und gegen jedes fehlende Feld. */
function parseActionJson(jsonText: string): AssistantAction | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    try {
      raw = JSON.parse(jsonText.replace(/\r?\n/g, '\\n')) as Record<string, unknown>;
    } catch {
      return null;
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
            liste: typeof a.liste === 'string' && (a.liste as string).trim().length > 0 ? (a.liste as string).trim() : undefined,
            // Manche Modelle liefern die Schritte als einzelnen String statt als
            // Array — beides annehmen, sonst geht die Einkaufsliste verloren.
            schritte: parseSchritte(a.schritte),
            // Nur echte Rrules übernehmen; erfundene Formen ('jeden 2. Montag')
            // fallen still weg, die Aufgabe bleibt einmalig statt kaputt.
            wiederholung: isRrule(a.wiederholung) ? a.wiederholung : undefined,
            tags: parseTags(a.tags),
            notiz: typeof a.notiz === 'string' && a.notiz.trim().length > 0 ? a.notiz.trim() : undefined,
          }))
      : [];
    const termine = Array.isArray(raw.termine)
      ? raw.termine
          .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
          .filter(
            (t) =>
              typeof t.titel === 'string' &&
              (t.titel as string).trim().length > 0 &&
              typeof t.datum === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(t.datum as string),
          )
          .map((t) => ({
            titel: (t.titel as string).trim(),
            datum: t.datum as string,
            start: typeof t.start === 'string' && /^\d{2}:\d{2}$/.test(t.start) ? (t.start as string) : undefined,
            ende: typeof t.ende === 'string' && /^\d{2}:\d{2}$/.test(t.ende) ? (t.ende as string) : undefined,
            notiz: typeof t.notiz === 'string' && (t.notiz as string).trim().length > 0 ? (t.notiz as string).trim() : undefined,
          }))
      : [];
    const listen = Array.isArray(raw.listen)
      ? raw.listen
          .filter((l): l is Record<string, unknown> => typeof l === 'object' && l !== null)
          .filter((l) => typeof l.name === 'string' && (l.name as string).trim().length > 0)
          .map((l) => ({
            name: (l.name as string).trim(),
            ziel: typeof l.ziel === 'string' && (l.ziel as string).trim().length > 0 ? (l.ziel as string).trim() : undefined,
            deadline: typeof l.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(l.deadline as string) ? (l.deadline as string) : undefined,
          }))
      : [];
    const aenderungen = Array.isArray(raw.aenderungen)
      ? raw.aenderungen
          .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
          .filter((c) => typeof c.handle === 'string' && (c.handle as string).trim().length > 0)
          .map((c) => ({
            handle: (c.handle as string).trim(),
            erledigt: c.erledigt === true ? true : undefined,
            // null ist hier bedeutungsvoll: „nimm das Datum weg".
            datum:
              c.datum === null ? null : typeof c.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.datum) ? c.datum : undefined,
            zeit: c.zeit === null ? null : typeof c.zeit === 'string' && /^\d{2}:\d{2}$/.test(c.zeit) ? c.zeit : undefined,
            titel: typeof c.titel === 'string' && (c.titel as string).trim().length > 0 ? (c.titel as string).trim() : undefined,
            liste: typeof c.liste === 'string' && (c.liste as string).trim().length > 0 ? (c.liste as string).trim() : undefined,
            papierkorb: c.papierkorb === true ? true : undefined,
          }))
          // Eine Änderung ohne Feld ist ein Rauschen-Eintrag — weg damit.
          .filter((c) => c.erledigt || c.papierkorb || c.titel || c.liste || c.datum !== undefined || c.zeit !== undefined)
      : [];
    const checkliste = Array.isArray(raw.checkliste)
      ? raw.checkliste.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim())
      : [];
    const notizen = Array.isArray(raw.notizen)
      ? raw.notizen.filter((n): n is string => typeof n === 'string' && n.trim().length > 0).map((n) => n.trim())
      : [];
    if (
      aufgaben.length === 0 &&
      termine.length === 0 &&
      listen.length === 0 &&
      aenderungen.length === 0 &&
      checkliste.length === 0 &&
      notizen.length === 0
    )
      return null;
    return { aufgaben, termine, listen, aenderungen, checkliste, notizen };
  } catch {
    return null;
  }
}

// ——— Prompt-Chips: kontextabhängige Ein-Tipp-Vorschläge im leeren Chat. ———
export type ChatLink = 'note' | 'task' | 'event' | 'none';

/** Zwei, drei Vorschläge je nach Verknüpfung — Tippen sendet sie als Nachricht. */
export function promptChips(link: ChatLink): string[] {
  switch (link) {
    case 'note':
      return ['Fasse die Notiz zusammen', 'Was sind die nächsten Schritte?', 'Bring das in eine klare Struktur'];
    case 'task':
      return ['Zerlege das in Teilschritte', 'Wie fange ich am besten an?', 'Formuliere das klarer'];
    case 'event':
      return ['Erstelle eine Packliste', 'Schlage Restaurants in der Nähe vor', 'Woran sollte ich denken?'];
    default:
      return ['Plane meinen Tag', 'Erstelle eine Packliste', 'Fasse einen Text zusammen'];
  }
}

// ——— Auto-Titel: kurzer, sprechender Chat-Titel aus dem ersten Austausch. ———
/** Räumt einen modell-generierten Titel auf: Anführungszeichen/Label/Satzzeichen
 *  weg, eine Zeile, auf ~6 Wörter bzw. 48 Zeichen gedeckelt. Rein & testbar. */
export function sanitizeChatTitle(raw: string): string {
  let t = raw.split('\n')[0].trim();
  // Häufige Vorreiter der Modelle entfernen („Titel:", „Chat:").
  t = t.replace(/^(titel|title|chat|betreff)\s*[:\-–]\s*/i, '');
  // Umschließende Anführungszeichen (auch typografische) abstreifen.
  t = t.replace(/^["'„“»«‚']+/, '').replace(/["'„“»«‚']+$/, '');
  // Markdown-Sternchen und abschließende Satzzeichen weg.
  t = t.replace(/\*+/g, '').replace(/[.!?,;:]+$/, '').trim();
  // Auf 6 Wörter kürzen, dann hart auf 48 Zeichen.
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 6) t = words.slice(0, 6).join(' ');
  if (t.length > 48) t = `${t.slice(0, 47).trimEnd()}…`;
  return t;
}

/** Titel beim Dienst anfragen (Lite-Kette, ein knapper Prompt). Liefert null,
 *  wenn nichts Brauchbares zurückkam — der Aufrufer behält dann den alten Titel. */
export async function generateChatTitle(
  apiKey: string,
  userMessage: string,
  assistantAnswer: string,
): Promise<string | null> {
  if (!apiKey) return null;
  const prompt =
    'Gib einen sehr kurzen, sachlichen Titel (2–5 Wörter, Deutsch, ohne Anführungszeichen, ' +
    'ohne abschließenden Punkt) für dieses Gespräch:\n\n' +
    `Frage: ${userMessage.slice(0, 400)}\n` +
    `Antwort: ${assistantAnswer.slice(0, 400)}\n\nTitel:`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 20 },
  };
  try {
    // Lite-Kette zuerst (billiger); der gemerkte Lite-Treffer sitzt vorn.
    const { res } = await callChain(LITE_CHAIN, workingLite, apiKey, body);
    if (!res.ok) return null;
    const text = extractText(await res.json());
    if (!text) return null;
    const title = sanitizeChatTitle(text);
    return title.length >= 2 ? title : null;
  } catch {
    return null;
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
  // Der Ort steht VOR den Notizen: „wo bin ich da?" ist die häufigere Frage
  // an einen Termin-Chat als „was steht in der Notiz?".
  if (ev.location) lines.push(`Ort: ${ev.location}`);
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
/**
 * Kurz-Handle einer Aufgabe für den Assistenten: die letzten 6 Zeichen der ID.
 * Die ersten Zeichen sind ein Zeitstempel (siehe newId) und bei am selben Tag
 * angelegten Aufgaben fast gleich — der ZUFALLS-Teil hinten unterscheidet.
 * Aufgelöst wird trotzdem defensiv: mehrdeutig oder unbekannt → Änderung fällt
 * weg, statt die falsche Aufgabe anzufassen.
 */
export function taskHandle(id: string): string {
  return id.slice(-6);
}

/** Handle → Aufgabe. null bei unbekannt ODER mehrdeutig (nie raten). */
export function resolveTaskHandle(handle: string, tasks: Task[]): Task | null {
  const needle = handle.trim().toLowerCase();
  if (needle.length === 0) return null;
  const hits = tasks.filter((t) => taskHandle(t.id).toLowerCase() === needle);
  return hits.length === 1 ? hits[0] : null;
}

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
    const parts = [`[${taskHandle(t.id)}] ${t.title}`];
    if (t.dueDate) parts.push(`fällig ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ''}${t.dueDate < today ? ' (überfällig)' : ''}`);
    const ln = listName.get(t.listId);
    if (ln && t.listId !== 'default') parts.push(`Liste „${ln}"`);
    return `- ${parts.join(' · ')}`;
  };
  const taskLines = [...open]
    .sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1))
    .slice(0, CTX_TASK_LIMIT)
    .map(taskLine);

  // Abgeschlossene Projekte gehören nicht in den Überblick — sonst schlägt der
  // Verwalter Verschiebungen für etwas vor, das der Nutzer beendet hat.
  const projectLines = lists
    .filter((l) => l.id !== 'default' && !l.completedAt)
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
      'Erfinde keine Einträge dazu; was hier nicht steht, existiert in der App nicht. ' +
      'Die Kürzel in eckigen Klammern sind die Handles der Aufgaben — nur DIESE dürfen in ' +
      '"aenderungen" stehen, nie erfundene.',
  ].join('\n');
}

// ——— Werkzeuge (Function Calling): der Assistent darf NACHSEHEN. ———
// Streng LESEND. Alles, was schreibt, läuft weiterhin über den Aktions-Block
// mit Bestätigungskarte — ein Werkzeug, das still etwas verändert, gibt es
// nicht und soll es nicht geben.
// Die Abendbetrachtung ist hier strukturell unerreichbar: sie steckt in keinem
// Werkzeug und in keinem ToolData. Das ist Absicht und darf nicht aufweichen.

/** Daten, auf denen die Werkzeuge arbeiten — der Aufrufer reicht sie herein,
 *  damit dieses Modul rein und testbar bleibt. */
export type ToolData = { tasks: Task[]; lists: List[]; notes: Note[]; today: string };

export type ToolCall = { name: string; args: Record<string, unknown> };

/** Wie viele Werkzeug-Runden höchstens, bevor eine Antwort kommen MUSS.
 *  Deckelt Kosten und Wartezeit — und verhindert eine Endlosschleife, wenn das
 *  Modell immer wieder dasselbe nachschlägt. */
export const MAX_TOOL_ROUNDS = 3;
/** Obergrenze der Treffer je Werkzeug-Antwort (Token-Schutz). */
const TOOL_RESULT_LIMIT = 25;

export const ASSISTANT_TOOLS = [
  {
    name: 'aufgaben_suchen',
    description:
      'Sucht in ALLEN Aufgaben — auch in erledigten und in solchen, die nicht im Überblick stehen. ' +
      'Nutze das, wenn der Überblick nicht reicht („habe ich das schon erledigt?", „was liegt zum Thema X?").',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: { type: 'STRING', description: 'Suchbegriff in Titel, Notiz, Tags oder Unteraufgaben.' },
        liste: { type: 'STRING', description: 'Nur Aufgaben dieser Liste.' },
        tag: { type: 'STRING', description: 'Nur Aufgaben mit diesem Tag (ohne #).' },
        erledigt: { type: 'BOOLEAN', description: 'true = nur erledigte, false = nur offene, weglassen = beides.' },
      },
    },
  },
  {
    name: 'liste_inhalt',
    description: 'Gibt alle offenen Aufgaben einer Liste/eines Projekts zurück — vollständig, nicht nur den Auszug aus dem Überblick.',
    parameters: { type: 'OBJECT', properties: { name: { type: 'STRING', description: 'Name der Liste.' } }, required: ['name'] },
  },
  {
    name: 'notiz_lesen',
    description:
      'Liest den INHALT einer Notiz. Im Überblick stehen nur die Titel — wenn du den Text brauchst, hol ihn hiermit.',
    parameters: { type: 'OBJECT', properties: { titel: { type: 'STRING', description: 'Titel der Notiz (erste Zeile).' } }, required: ['titel'] },
  },
] as const;

const argStr = (args: Record<string, unknown>, key: string): string =>
  typeof args[key] === 'string' ? (args[key] as string).trim().toLowerCase() : '';

/** Führt ein Werkzeug aus. Rein: keine Repos, keine Netzwerkzugriffe.
 *  Unbekanntes Werkzeug → ehrliche Fehlmeldung statt Absturz. */
export function runAssistantTool(call: ToolCall, data: ToolData): string {
  const listName = new Map(data.lists.map((l) => [l.id, l.name]));
  const line = (t: Task) =>
    [
      `[${taskHandle(t.id)}] ${t.title}`,
      t.completedAt ? 'erledigt' : t.dueDate ? `fällig ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ''}` : 'ohne Datum',
      listName.get(t.listId) && t.listId !== 'default' ? `Liste „${listName.get(t.listId)}"` : '',
      t.tags.length ? t.tags.map((x) => `#${x}`).join(' ') : '',
      t.note ? `Notiz: ${t.note}` : '',
      t.subtasks.length ? `Schritte: ${t.subtasks.map((x) => `${x.done ? '[x]' : '[ ]'} ${x.title}`).join('; ')}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  const wrap = (hits: Task[]) =>
    hits.length === 0
      ? 'Keine Treffer.'
      : hits.slice(0, TOOL_RESULT_LIMIT).map(line).join('\n') +
        (hits.length > TOOL_RESULT_LIMIT ? `\n… und ${hits.length - TOOL_RESULT_LIMIT} weitere` : '');

  if (call.name === 'aufgaben_suchen') {
    const text = argStr(call.args, 'text');
    const liste = argStr(call.args, 'liste');
    const tag = normalizeTag(argStr(call.args, 'tag'));
    const erledigt = typeof call.args.erledigt === 'boolean' ? (call.args.erledigt as boolean) : null;
    const listIds = new Set(data.lists.filter((l) => l.name.trim().toLowerCase() === liste).map((l) => l.id));
    return wrap(
      data.tasks.filter((t) => {
        if (t.deletedAt) return false;
        if (erledigt !== null && (t.completedAt !== null) !== erledigt) return false;
        if (liste && !listIds.has(t.listId)) return false;
        if (tag && !t.tags.includes(tag)) return false;
        if (!text) return true;
        const haystack = [t.title, t.note ?? '', t.tags.join(' '), t.subtasks.map((x) => x.title).join(' ')]
          .join(' ')
          .toLowerCase();
        return haystack.includes(text);
      }),
    );
  }

  if (call.name === 'liste_inhalt') {
    const name = argStr(call.args, 'name');
    const list = data.lists.find((l) => l.name.trim().toLowerCase() === name);
    if (!list) return `Liste „${call.args.name ?? ''}" gibt es nicht. Vorhanden: ${data.lists.map((l) => l.name).join(', ') || 'keine'}.`;
    return wrap(data.tasks.filter((t) => t.listId === list.id && !t.deletedAt && t.completedAt === null));
  }

  if (call.name === 'notiz_lesen') {
    const titel = argStr(call.args, 'titel');
    const hit = data.notes.find((n) => n.deletedAt === null && noteTitle(n.body).trim().toLowerCase() === titel)
      ?? data.notes.find((n) => n.deletedAt === null && noteTitle(n.body).toLowerCase().includes(titel) && titel.length > 0);
    if (!hit) return `Keine Notiz mit dem Titel „${call.args.titel ?? ''}" gefunden.`;
    return hit.body.slice(0, 4000);
  }

  return `Unbekanntes Werkzeug „${call.name}".`;
}

/** Werkzeug-Aufrufe aus einer Antwort/einem Stream-Ereignis ziehen. */
export function extractCalls(event: unknown): ToolCall[] {
  if (typeof event !== 'object' || event === null) return [];
  const candidates = (event as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const parts = (candidates[0] as { content?: { parts?: unknown[] } }).content?.parts;
  if (!Array.isArray(parts)) return [];
  const out: ToolCall[] = [];
  for (const p of parts) {
    const fc = (p as { functionCall?: { name?: unknown; args?: unknown } }).functionCall;
    if (fc && typeof fc.name === 'string')
      out.push({ name: fc.name, args: typeof fc.args === 'object' && fc.args !== null ? (fc.args as Record<string, unknown>) : {} });
  }
  return out;
}

/** Verlauf → Gemini-Format; Kontext wandert in die System-Instruction.
 *  Datum + Uhrzeit gehen IMMER mit — sonst rät das Modell bei „heute Abend"
 *  ein Datum aus seinen Trainingsdaten. */
export function buildRequestBody(
  messages: ChatMessage[],
  context: string | null,
  now: Date = new Date(),
  memory: string | null = null,
  /** Werkzeuge deklarieren? Nur wo der Assistent auch nachsehen DARF (Chat). */
  withTools = false,
  /** Bilder zur LETZTEN Nutzer-Nachricht (Zettel abfotografieren). */
  images: AssistantImage[] = [],
  /** Welche Prompt-Abschnitte gelten hier? */
  mode: PromptMode = 'voll',
  /** Antwort als reines JSON erzwingen (Aktions-Block ohne Prosa). */
  json = false,
): unknown {
  const dateLine =
    `Heute ist ${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ` +
    `${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr ` +
    `(ISO: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}). ` +
    'Relative Angaben wie „heute", „morgen" oder „nächste Woche" beziehen sich hierauf.';
  // Der Merkzettel steht NACH den Regeln und VOR dem Datenkontext: er ist eine
  // Vorgabe des Nutzers, kein Datenpunkt. Gedeckelt, damit ein versehentlich
  // eingefügter Roman nicht jeden Aufruf verteuert.
  const note = memory?.trim().slice(0, MEMORY_LIMIT) ?? '';
  const system =
    `${systemPrompt(mode)}\n\n${dateLine}` +
    (note ? `\n\nMERKZETTEL des Nutzers — seine festen Vorgaben, immer beachten:\n${note}` : '') +
    (context ? `\n\nKontext aus der App:\n${context}` : '');
  const contents = messages.slice(-HISTORY_LIMIT).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }] as unknown[],
  }));
  // Bilder gehören an die LETZTE Nutzer-Nachricht — sie sind das, worüber
  // gerade gesprochen wird, nicht Kontext des ganzen Verlaufs.
  const bilder = images.slice(0, IMAGE_LIMIT);
  if (bilder.length > 0) {
    const last = [...contents].reverse().find((c) => c.role === 'user');
    if (last) last.parts.push(...bilder.map((b) => ({ inlineData: { mimeType: b.mimeType, data: b.data } })));
  }

  return {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    ...(withTools ? { tools: [{ functionDeclarations: ASSISTANT_TOOLS }] } : {}),
    generationConfig: {
      // ZWEI Dialekte in EINEM Körper — siehe tuneForModel(): welcher davon
      // wirklich rausgeht, entscheidet erst callModel(), weil erst dort das
      // Modell feststeht. „temperature" ist die alte Steuerung, „thinkingConfig"
      // die neue; zusammen verschickt wäre beides ein Formfehler.
      temperature: 0.4,
      // Erfassen ist Sortieren, kein Nachdenken — wo es die neue Generation
      // versteht, spart „minimal" die teuerste Phase der Antwort.
      ...(mode === 'erfassen' ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
      // 1200 war zu knapp: Prosa PLUS ein Aktions-Block mit Checklisten sprengt
      // das, die Antwort brach mitten im JSON ab (v1.53.3). Der Deckel schützt
      // nur davor, dass eine entgleiste Antwort das Kontingent frisst — dafür
      // ist hier reichlich Luft.
      maxOutputTokens: 3000,
      // JSON-Zwang: Gemini liefert dann garantiert den Aktions-Block als reines
      // JSON — der zweite Anlauf („du hast den Block vergessen") entfällt, und
      // es entstehen weniger Ausgabe-Token. Preis: keine Prosa mehr, also auch
      // kein sinnvoll anzeigbarer Streaming-Text. Nur dort einschalten, wo die
      // Antwort ohnehin eine Vorschlagskarte ist.
      ...(json ? { responseMimeType: 'application/json', responseSchema: ACTION_SCHEMA } : {}),
    },
  };
}

/** Text eines einzelnen Stream-Ereignisses — OHNE trim: führende Leerzeichen
 *  eines Chunks gehören zum Wortabstand („Hallo" + „ Welt"). */
export function extractChunkText(event: unknown): string {
  if (typeof event !== 'object' || event === null) return '';
  const candidates = (event as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  const parts = (candidates[0] as { content?: { parts?: { text?: string }[] } }).content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => p.text ?? '').join('');
}

/** Inkrementeller SSE-Parser: rohe Text-Chunks rein, Text-Deltas raus.
 *  Gemini sendet pro Ereignis eine Zeile `data: {json}`; Chunk-Grenzen können
 *  mitten in einer Zeile liegen — der Puffer hält den Rest bis zum nächsten Push. */
export function createSseParser(onEvent?: (event: unknown) => void): { push: (chunk: string) => string[]; flush: () => string[] } {
  let buffer = '';
  const parseLine = (line: string): string | null => {
    if (!line.startsWith('data:')) return null;
    const payload = line.slice(5).trim();
    if (payload.length === 0 || payload === '[DONE]') return null;
    try {
      const event: unknown = JSON.parse(payload);
      // Rohes Ereignis durchreichen: im Stream stecken neben Text auch
      // functionCall-Teile, die der Text-Pfad nicht sehen kann.
      onEvent?.(event);
      const text = extractChunkText(event);
      return text.length > 0 ? text : null;
    } catch {
      return null;
    }
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      const out: string[] = [];
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        const t = parseLine(line);
        if (t !== null) out.push(t);
      }
      return out;
    },
    flush() {
      const t = parseLine(buffer.replace(/\r$/, ''));
      buffer = '';
      return t !== null ? [t] : [];
    },
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
      // Ohne Adresse im Text: den Weg trägt seit v1.60 der Knopf darunter
      // (SchluesselWeg) — eine abgetippte URL ist auf dem Telefon keine Hilfe.
      'Prüfe, ob der Schlüssel wirklich bei Google AI Studio erstellt wurde.'
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

/** Harte Obergrenze — ein hängender Request darf den Chat nicht blockieren.
 *  Beim Streaming zählt sie bis zu den Response-Headern; danach wacht
 *  STREAM_STALL_MS über jeden einzelnen Lese-Schritt. */
const TIMEOUT_MS = 30000;
const STREAM_STALL_MS = 30000;

// RN-eigenes fetch kann keine Response-Streams — expo/fetch kann es (nativ und
// Web). Lazy geladen, damit die reine Logik in Tests ohne Expo-Runtime lädt.
let streamFetchImpl: typeof fetch | null = null;
function getStreamFetch(): typeof fetch {
  if (streamFetchImpl === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      streamFetchImpl = (require('expo/fetch') as { fetch: unknown }).fetch as typeof fetch;
    } catch {
      streamFetchImpl = fetch;
    }
  }
  return streamFetchImpl;
}

/** Körper als JSON lesen — mit deutscher Meldung, wenn gar kein JSON kommt.
 *  Ein HTTP 200 ist keine Garantie: WLAN-Anmeldeseiten (Hotel, Bahn, Café)
 *  antworten mit einer HTML-Seite, und `res.json()` warf dann eine rohe
 *  englische Parser-Ausnahme bis auf den Bildschirm. */
async function readJson(res: Response): Promise<unknown> {
  const roh = await res.text();
  try {
    return JSON.parse(roh);
  } catch {
    throw new Error('Unerwartete Antwort — hängst du in einer WLAN-Anmeldeseite fest?');
  }
}

// ——— Zwei API-Dialekte, ein Anfrage-Körper ———
// Ab der 3.5er-Generation sind „temperature"/„topP"/„topK" abgekündigt; gesteuert
// wird stattdessen über „thinkingConfig.thinkingLevel". Beides gleichzeitig zu
// schicken ist ein Formfehler — und der käme als HTTP 400 zurück, was in
// callChain als SCHLÜSSEL-Fehler gilt und die ganze Kette stoppt. Deshalb trägt
// der Körper beide Fassungen, und erst callModel() streicht die falsche: dort
// steht das Modell fest, beim Bauen des Körpers noch nicht.
const NEUER_DIALEKT_AB = 3 * 1000 + 5; // gemini-3.5

/** Versteht dieses Modell den neuen Dialekt? Aliasse ohne Versionsnummer
 *  („gemini-flash-latest") zeigen nach vorn und gelten deshalb als neu. */
export function usesNewConfigDialect(model: string): boolean {
  const m = /gemini-(\d+)(?:\.(\d+))?/.exec(model);
  if (!m) return true;
  return Number(m[1]) * 1000 + Number(m[2] ?? 0) >= NEUER_DIALEKT_AB;
}

/** Hat eine Anfrage wegen der Feinsteuerung 400 kassiert, wird für den Rest des
 *  App-Laufs ganz auf sie verzichtet. Lieber ohne Feinsteuerung antworten als
 *  gar nicht — und lieber einmal lernen als bei jeder Anfrage neu anecken. */
let konservativeConfig = false;

/** Den Körper auf EINEN Dialekt zurechtstutzen. `konservativ` lässt beide
 *  Fassungen weg — das ist die Notlösung, die jedes Modell akzeptiert. */
export function tuneForModel(body: unknown, model: string, konservativ = false): unknown {
  if (typeof body !== 'object' || body === null) return body;
  const b = body as Record<string, unknown>;
  const cfg = b.generationConfig;
  if (typeof cfg !== 'object' || cfg === null) return body;
  const { temperature, topP, topK, thinkingConfig, ...rest } = cfg as Record<string, unknown>;
  const neu = konservativ ? {} : usesNewConfigDialect(model) ? { thinkingConfig } : { temperature, topP, topK };
  // Undefinierte Schlüssel fliegen beim Serialisieren ohnehin raus.
  return { ...b, generationConfig: { ...rest, ...neu } };
}

async function callModel(model: string, apiKey: string, body: unknown, stream = false): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const url = `${endpoint(model, stream)}?${stream ? 'alt=sse&' : ''}key=${encodeURIComponent(apiKey)}`;
  const doFetch = stream ? getStreamFetch() : fetch;
  try {
    return await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tuneForModel(body, model, konservativeConfig)),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) throw new Error('Zeitüberschreitung — der Dienst antwortet nicht. Erneut versuchen.');
    throw new Error('Keine Verbindung — bist du online?');
  } finally {
    clearTimeout(timer);
  }
}

/** SSE-Antwort konsumieren: Deltas an den Aufrufer, Gesamttext zurück.
 *  Reißt der Stream ab, ist der bereits erhaltene Text die ehrlichere Antwort
 *  als ein Fehler — nur ein komplett leerer Abbruch wirft. */
async function readSse(res: Response, onDelta: (delta: string) => void, onCall?: (calls: ToolCall[]) => void): Promise<string> {
  const parser = createSseParser((event) => {
    const calls = extractCalls(event);
    if (calls.length > 0) onCall?.(calls);
  });
  let full = '';
  const emit = (deltas: string[]) => {
    for (const d of deltas) {
      full += d;
      onDelta(d);
    }
  };
  const bodyStream = (res as { body?: ReadableStream<Uint8Array> | null }).body;
  if (bodyStream && typeof bodyStream.getReader === 'function' && typeof TextDecoder === 'function') {
    const reader = bodyStream.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        // Jeder Lese-Schritt bekommt eine eigene Stall-Wache (Timer wird sauber geräumt).
        const step = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('stall')), STREAM_STALL_MS);
          reader.read().then(
            (r) => {
              clearTimeout(t);
              resolve(r);
            },
            (e) => {
              clearTimeout(t);
              reject(e instanceof Error ? e : new Error(String(e)));
            },
          );
        });
        if (step.done) break;
        emit(parser.push(decoder.decode(step.value, { stream: true })));
      }
      emit(parser.flush());
    } catch {
      void reader.cancel().catch(() => {});
      if (full.trim().length === 0)
        throw new Error('Zeitüberschreitung — der Dienst antwortet nicht. Erneut versuchen.');
    }
  } else {
    // Kein Stream-Support in dieser Umgebung: kompletten SSE-Text am Stück parsen.
    const text = await res.text();
    emit(parser.push(text));
    emit(parser.flush());
  }
  return full.trim();
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

/** Wird gerufen, sobald ein Modell nachweislich funktioniert — der Aufrufer
 *  kann es persistieren. Ohne das läuft nach JEDEM Kaltstart die erste Anfrage
 *  ggf. die ganze Kandidatenkette ab, und jedes tote Modell ist eine volle
 *  Rundreise. Als Injektion, damit dieses Modul den Store nicht kennen muss. */
let persistModel: ((model: string, lite: boolean) => void) | null = null;

export function setModelPersister(fn: (model: string, lite: boolean) => void): void {
  persistModel = fn;
}

/** Beim Start bekannte Modelle vorgeben (aus den Einstellungen). */
export function primeWorkingModel(model: string | null, lite: string | null = null): void {
  if (model) workingModel = model;
  if (lite) workingLite = lite;
}

function setWorkingModel(model: string): void {
  if (workingModel === model) return;
  workingModel = model;
  persistModel?.(model, false);
}

function setWorkingLite(model: string): void {
  if (workingLite === model) return;
  workingLite = model;
  persistModel?.(model, true);
}

/** Kette abklappern. Weitergezogen wird bei 404 (Modell weg/umbenannt), 5xx
 *  („überlastet" — jedes Modell hat eigene Kapazität) und Timeout/Netzfehler.
 *  Auth-Fehler (400/401/403) und 429 stoppen sofort — die gelten für den
 *  ganzen Schlüssel, nicht das einzelne Modell. */
async function callChain(chain: string[], remembered: string | null, apiKey: string, body: unknown, stream = false): Promise<{ res: Response; model: string }> {
  const order = remembered ? [remembered, ...chain.filter((m) => m !== remembered)] : chain;
  let overloaded: { res: Response; model: string } | null = null;
  let notFound: { res: Response; model: string } | null = null;
  let lastError: Error | null = null;
  for (const model of order) {
    let res: Response;
    try {
      res = await callModel(model, apiKey, body, stream);
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

/** EINE Anfrage samt aller Ausweichwege: Kandidaten-Kette, Modell-Discovery bei
 *  404, Lite-Kette bei 429/5xx und ein später Wiederholungsversuch bei Überlast.
 *  Herausgelöst, damit die Werkzeug-Schleife jede Runde dieselben Netze bekommt. */
async function requestWithFallbacks(apiKey: string, body: unknown, stream: boolean): Promise<Response> {
  let { res, model } = await callChain(MODEL_CHAIN, workingModel, apiKey, body, stream);

  // 400 heißt „so nicht" — meist der Schlüssel, es kann aber auch unsere
  // Feinsteuerung sein (die Dialekte wandern mit jeder Modell-Generation).
  // Weil 400 die Kette stoppt, wäre das sonst ein toter Assistent statt einer
  // etwas langsameren Antwort. Also EIN nackter Versuch ohne Feinsteuerung —
  // klappt er, gilt das für den Rest des App-Laufs.
  if (res.status === 400 && !konservativeConfig) {
    konservativeConfig = true;
    const nackt = await callModel(model, apiKey, body, stream);
    if (nackt.ok) res = nackt;
    else konservativeConfig = false;
  }

  // Alle bekannten IDs sind 404 → beim Dienst nachfragen, was es wirklich gibt.
  if (res.status === 404) {
    const found = await discoverModels(apiKey);
    if (found.lite) setWorkingLite(found.lite);
    if (found.model) {
      model = found.model;
      res = await callModel(model, apiKey, body, stream);
    }
  }
  if (res.ok) setWorkingModel(model);

  // Kontingent erschöpft ODER alles überlastet → die Lite-Kette hat eigenes
  // Kontingent und eigene Kapazität.
  if (res.status === 429 || res.status >= 500) {
    try {
      const lite = await callChain(LITE_CHAIN, workingLite, apiKey, body, stream);
      if (lite.res.ok) {
        res = lite.res;
        setWorkingLite(lite.model);
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
    const again = await callModel(model, apiKey, body, stream);
    if (again.ok) {
      res = again;
      workingModel = model;
    }
  }
  return res;
}

/** Eine Antwort holen. Verschwundene Modelle (404) werden über die Kandidaten-
 *  Kette und notfalls die Modell-Liste des Dienstes überbrückt; Überlast (5xx)
 *  über die Kette + einen kurzen zweiten Versuch; erschöpftes Kontingent (429)
 *  über die Lite-Kette. Wirft Error mit deutscher Meldung.
 *  Mit `onDelta` läuft die Anfrage als Stream: der Text kommt Stück für Stück
 *  beim Aufrufer an, zurückgegeben wird am Ende der Gesamttext. */
/** Alles Optionale einer Anfrage an EINER Stelle — die Signatur war mit sieben
 *  Stellungs-Parametern nicht mehr lesbar, und jeder neue hätte sie verschlimmert. */
export type AskOptions = {
  /** Streaming: jedes Textstück, sobald es eintrifft. */
  onDelta?: (delta: string) => void;
  /** Daten für die (lesenden) Werkzeuge. Fehlt/null = keine Werkzeuge. */
  toolData?: ToolData | null;
  /** Bilder zur aktuellen Nachricht. */
  images?: AssistantImage[];
  /** Welche Prompt-Abschnitte gelten (Default: alles). */
  mode?: PromptMode;
  /** Antwort als reines JSON erzwingen — nur wo eine Vorschlagskarte folgt. */
  json?: boolean;
};

export async function askAssistant(
  apiKey: string,
  messages: ChatMessage[],
  context: string | null,
  /** Merkzettel des Nutzers (Einstellungen). Bewusst PFLICHT-Parameter: so kann
   *  ihn keine Aufrufstelle stillschweigend vergessen — tsc meldet es. */
  memory: string | null,
  opts: AskOptions = {},
): Promise<string> {
  const { onDelta, toolData, images, mode = 'voll', json = false } = opts;
  const stream = onDelta !== undefined;
  const base = buildRequestBody(messages, context, new Date(), memory, !!toolData, images ?? [], mode, json) as Record<
    string,
    unknown
  >;
  const baseContents = base.contents as unknown[];
  // Zusatz-Runden: der Modell-Zug (functionCall) und unsere Antwort darauf.
  const extra: unknown[] = [];

  for (let round = 0; ; round += 1) {
    const body = { ...base, contents: [...baseContents, ...extra] };
    const res = await requestWithFallbacks(apiKey, body, stream);
    if (!res.ok) throw new Error(describeError(res.status));

    const calls: ToolCall[] = [];
    let text: string;
    if (onDelta) {
      text = await readSse(res, onDelta, (c) => calls.push(...c));
    } else {
      const jsonBody: unknown = await readJson(res);
      calls.push(...extractCalls(jsonBody));
      text = extractText(jsonBody) ?? '';
    }

    // Keine Werkzeug-Wünsche (oder Runden aufgebraucht) → das ist die Antwort.
    const weiter = calls.length > 0 && toolData && round < MAX_TOOL_ROUNDS;
    if (!weiter) {
      if (!text) throw new Error('Leere Antwort erhalten — versuch es nochmal.');
      return text;
    }

    extra.push(
      { role: 'model', parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args } })) },
      {
        role: 'user',
        parts: calls.map((c) => ({
          functionResponse: { name: c.name, response: { result: runAssistantTool(c, toolData) } },
        })),
      },
    );
  }
}
