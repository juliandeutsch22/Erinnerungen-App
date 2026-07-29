// journalLogic.ts — reine Ableitungen der Abendbetrachtung.
import type { JournalEntry } from '@/data/JournalRepository';
import { addDays } from '@/lib/dates';

const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export type JournalMonat = {
  /** 'YYYY-MM' — stabil und sortierbar. */
  key: string;
  /** „Juli" — das Jahr steht schon eine Ebene höher. */
  label: string;
  eintraege: JournalEntry[];
};

export type JournalJahr = {
  /** 'YYYY'. */
  key: string;
  anzahl: number;
  monate: JournalMonat[];
};

/**
 * Der Verlauf als Jahre → Monate → Einträge, überall neueste zuerst.
 *
 * Warum MONATE und nicht Wochen: ein Tagebuch hat höchstens einen Eintrag pro
 * Tag. Wochen ergäben Grüppchen von vier bis fünf Zeilen und mehr Überschriften
 * als Inhalt — die Gliederung würde lauter als das Geschriebene. Der Monat ist
 * die Einheit, in der man sich an ein Jahr erinnert („im Juli war das"), und das
 * Jahr die Einheit darüber. Zwei Ebenen genügen deshalb.
 *
 * Leere Einträge fallen raus: ein angefangener und wieder geleerter Abend ist
 * kein Eintrag, und er soll auch keine Überschrift erzeugen.
 */
export function groupJournal(entries: JournalEntry[]): JournalJahr[] {
  const mitText = entries.filter((e) => e.text.trim().length > 0);
  const proJahr = new Map<string, Map<string, JournalEntry[]>>();

  for (const e of mitText) {
    const jahr = e.date.slice(0, 4);
    const monat = e.date.slice(0, 7);
    const monate = proJahr.get(jahr) ?? new Map<string, JournalEntry[]>();
    const liste = monate.get(monat) ?? [];
    liste.push(e);
    monate.set(monat, liste);
    proJahr.set(jahr, monate);
  }

  return [...proJahr.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([jahr, monate]) => {
      const sortiert = [...monate.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([key, liste]) => ({
          key,
          label: MONATE[Number(key.slice(5, 7)) - 1] ?? key,
          eintraege: liste.slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
        }));
      return { key: jahr, anzahl: sortiert.reduce((n, m) => n + m.eintraege.length, 0), monate: sortiert };
    });
}

/** Stille Kette: aufeinanderfolgende Abende mit Eintrag, bis heute oder
 *  gestern (der heutige Abend darf ja noch kommen). Kein Schuld-Zähler —
 *  nur eine Zahl, wenn sie Freude macht. */
export function journalStreak(entries: JournalEntry[], today: string): number {
  const days = new Set(entries.filter((e) => e.text.trim().length > 0).map((e) => e.date));
  let start = today;
  if (!days.has(start)) start = addDays(today, -1);
  if (!days.has(start)) return 0;
  let streak = 0;
  let d = start;
  while (days.has(d)) {
    streak += 1;
    d = addDays(d, -1);
  }
  return streak;
}
