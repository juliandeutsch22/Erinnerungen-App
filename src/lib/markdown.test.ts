// markdown.test.ts — der Markdown-Licht-Parser für Assistenten-Antworten.
import { parseInline, parseMarkdownLight, shortenUrl } from './markdown';

describe('parseInline', () => {
  it('lässt schlichten Text unangetastet', () => {
    expect(parseInline('Hallo Welt')).toEqual([{ text: 'Hallo Welt' }]);
  });

  it('erkennt **fett**', () => {
    expect(parseInline('ein **wichtiges** Wort')).toEqual([
      { text: 'ein ' },
      { text: 'wichtiges', bold: true },
      { text: ' Wort' },
    ]);
  });

  it('erkennt *kursiv*', () => {
    expect(parseInline('ganz *leise* gesagt')).toEqual([
      { text: 'ganz ' },
      { text: 'leise', italic: true },
      { text: ' gesagt' },
    ]);
  });

  it('lässt Rechen-Sternchen mit Leerzeichen in Ruhe', () => {
    expect(parseInline('2 * 3 * 4')).toEqual([{ text: '2 * 3 * 4' }]);
  });

  it('macht URLs zu Links mit gekürztem Anzeigetext', () => {
    const parts = parseInline('siehe https://www.example.com/pfad dazu');
    expect(parts).toEqual([
      { text: 'siehe ' },
      { text: 'example.com/pfad', link: 'https://www.example.com/pfad' },
      { text: ' dazu' },
    ]);
  });

  it('kombiniert fett und Link in einer Zeile', () => {
    const parts = parseInline('**Buchen:** https://booking.com/x');
    expect(parts[0]).toEqual({ text: 'Buchen:', bold: true });
    expect(parts[2].link).toBe('https://booking.com/x');
  });
});

describe('shortenUrl', () => {
  it('entfernt Protokoll und www und deckelt die Länge', () => {
    expect(shortenUrl('https://www.airbnb.de/s/Rom/homes')).toBe('airbnb.de/s/Rom/homes');
    expect(shortenUrl(`https://x.de/${'a'.repeat(100)}`).length).toBe(48);
  });
});

describe('parseMarkdownLight', () => {
  it('verschmilzt aufeinanderfolgende Zeilen zu einem Absatz, Leerzeile trennt', () => {
    const blocks = parseMarkdownLight('Zeile eins\nZeile zwei\n\nNeuer Absatz');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ kind: 'paragraph', parts: [{ text: 'Zeile eins\nZeile zwei' }] });
    expect(blocks[1]).toEqual({ kind: 'paragraph', parts: [{ text: 'Neuer Absatz' }] });
  });

  it('erkennt Aufzählungen mit -, * und •', () => {
    const blocks = parseMarkdownLight('- erstens\n* zweitens\n• drittens');
    expect(blocks.map((b) => b.kind)).toEqual(['bullet', 'bullet', 'bullet']);
    expect(blocks[1].parts).toEqual([{ text: 'zweitens' }]);
  });

  it('erkennt nummerierte Listen mit Punkt und Klammer', () => {
    const blocks = parseMarkdownLight('1. Koffer packen\n2) Tickets prüfen');
    expect(blocks).toEqual([
      { kind: 'numbered', ordinal: '1', parts: [{ text: 'Koffer packen' }] },
      { kind: 'numbered', ordinal: '2', parts: [{ text: 'Tickets prüfen' }] },
    ]);
  });

  it('erkennt Überschriften jeder Tiefe', () => {
    const blocks = parseMarkdownLight('## Tag 1\nMorgens Akropolis.');
    expect(blocks[0]).toEqual({ kind: 'heading', parts: [{ text: 'Tag 1' }] });
    expect(blocks[1].kind).toBe('paragraph');
  });

  it('behandelt Blockquotes als ruhige Absätze', () => {
    const blocks = parseMarkdownLight('> Der Weg ist das Ziel.');
    expect(blocks).toEqual([{ kind: 'paragraph', parts: [{ text: 'Der Weg ist das Ziel.' }] }]);
  });

  it('parst eine typische Gemini-Antwort komplett', () => {
    const text =
      'Hier ein Vorschlag für **Rom**:\n\n' +
      '## Unterkunft\n' +
      '- Trastevere: lebendig, *authentisch*\n' +
      '- https://www.booking.com/searchresults.de.html?ss=Rom\n\n' +
      '1. Früh buchen\n' +
      '2. Bewertungen lesen';
    const kinds = parseMarkdownLight(text).map((b) => b.kind);
    expect(kinds).toEqual(['paragraph', 'heading', 'bullet', 'bullet', 'numbered', 'numbered']);
  });

  it('leerer Text ergibt keine Blöcke', () => {
    expect(parseMarkdownLight('')).toEqual([]);
    expect(parseMarkdownLight('\n\n')).toEqual([]);
  });
});
