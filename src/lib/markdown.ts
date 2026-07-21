// markdown.ts — Markdown-Licht-Parser für Assistenten-Antworten (reine Logik).
// Gemini antwortet mit schlichtem Markdown (Listen, **fett**, *kursiv*,
// Zwischenüberschriften, Links). Statt Rohtext mit Sternchen und Bindestrichen
// zerlegt dieser Parser den Text in Blöcke, die die UI sauber setzen kann —
// bewusst OHNE Dependency und ohne Tabellen/Code (der System-Prompt verbietet
// Tabellen; der stoa-aktionen-Block wird VOR dem Parsen entfernt).

export type InlinePart = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Ziel-URL — der sichtbare Text ist die gekürzte Adresse. */
  link?: string;
};

export type MarkdownBlock =
  | { kind: 'paragraph'; parts: InlinePart[] }
  | { kind: 'heading'; parts: InlinePart[] }
  | { kind: 'bullet'; parts: InlinePart[] }
  | { kind: 'numbered'; ordinal: string; parts: InlinePart[] };

const URL_RE = /(https?:\/\/[^\s)\]}"']+)/g;
const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBERED_RE = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const HEADING_RE = /^\s*#{1,6}\s+(.*)$/;

/** URL fürs Auge kürzen: Protokoll/www weg, harte Obergrenze. */
export function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48);
}

/** **fett** und *kursiv* innerhalb eines Textstücks auflösen (rekursiv). */
function parseEmphasis(text: string, bold: boolean, italic: boolean): InlinePart[] {
  const parts: InlinePart[] = [];
  // Erst fett (**…**), dann kursiv (*…*) im Rest — einfache, robuste Reihenfolge.
  const boldSplit = text.split(/\*\*([^*]+)\*\*/g);
  for (let i = 0; i < boldSplit.length; i++) {
    const piece = boldSplit[i];
    if (piece.length === 0) continue;
    const isBold = i % 2 === 1;
    // Kursiv: einzelne Sternchen, kein Leerzeichen direkt innen (schützt vor
    // Rechen-Sternchen wie „2 * 3").
    const italicSplit = piece.split(/\*(\S(?:[^*\n]*\S)?)\*/g);
    for (let j = 0; j < italicSplit.length; j++) {
      const sub = italicSplit[j];
      if (sub.length === 0) continue;
      const isItalic = j % 2 === 1;
      parts.push({
        text: sub,
        ...(bold || isBold ? { bold: true } : null),
        ...(italic || isItalic ? { italic: true } : null),
      });
    }
  }
  return parts;
}

/** Eine Zeile (oder einen Absatz) in Inline-Teile zerlegen: Links + Betonung. */
export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  for (const piece of text.split(URL_RE)) {
    if (piece.length === 0) continue;
    if (/^https?:\/\//.test(piece)) parts.push({ text: shortenUrl(piece), link: piece });
    else parts.push(...parseEmphasis(piece, false, false));
  }
  return parts;
}

/**
 * Text → Blockliste. Zeilenweise: Überschriften (#…), Aufzählungen (-, *, •),
 * nummerierte Listen (1. / 1)) — alles andere sind Absätze; aufeinanderfolgende
 * Textzeilen verschmelzen zu EINEM Absatz (Zeilenumbruch bleibt erhalten),
 * Leerzeilen trennen.
 */
export function parseMarkdownLight(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', parts: parseInline(paragraph.join('\n')) });
    paragraph = [];
  };

  for (const rawLine of text.split('\n')) {
    // Zitat-Prefix still entfernen — Blockquotes rendert die App als Absatz.
    const line = rawLine.replace(/^\s*>\s?/, '');
    if (line.trim().length === 0) {
      flushParagraph();
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: 'heading', parts: parseInline(heading[1].trim()) });
      continue;
    }
    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flushParagraph();
      blocks.push({ kind: 'bullet', parts: parseInline(bullet[1].trim()) });
      continue;
    }
    const numbered = NUMBERED_RE.exec(line);
    if (numbered) {
      flushParagraph();
      blocks.push({ kind: 'numbered', ordinal: numbered[1], parts: parseInline(numbered[2].trim()) });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}
