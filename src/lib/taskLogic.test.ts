// taskLogic.test.ts — Überfällig-Ableitung, Abhak-Semantik, Gruppierungen.
import type { List, Task } from '@/data/types';
import { adoptOverdueToToday, groupPlanned, listProgress, groupToday, groupUpcomingDays, isDueToday, isOverdue, recentlyCompleted, resolveCompletion, projectState, projectDeadlineLabel, projectShowsDeadline, kuerzeErledigte, isCurrent, isDormant, isExpired, isWaiting, expiredTasks, lifespanLabel, listenGruppe, waitingLabel, waitingTasks } from './taskLogic';

const TODAY = '2026-07-03';

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    listId: 'default',
    title: 'Test',
    note: null,
    dueDate: null,
    dueTime: null,
    rrule: null,
    flagged: false,
    eventId: null,
    completedAt: null,
    notificationId: null,
    tags: [],
    subtasks: [],
    createdAt: '2026-07-01T08:00:00.000Z',
    sort: 0,
    ...overrides,
  };
}

describe('isOverdue / isDueToday', () => {
  it('vor heute = überfällig, heute = heute, ohne Datum = keins von beiden', () => {
    expect(isOverdue(task({ dueDate: '2026-07-01' }), TODAY)).toBe(true);
    expect(isOverdue(task({ dueDate: TODAY }), TODAY)).toBe(false);
    expect(isDueToday(task({ dueDate: TODAY }), TODAY)).toBe(true);
    expect(isOverdue(task({}), TODAY)).toBe(false);
    expect(isDueToday(task({}), TODAY)).toBe(false);
  });

  it('erledigte Aufgaben sind nie überfällig', () => {
    expect(isOverdue(task({ dueDate: '2026-07-01', completedAt: '2026-07-02T10:00:00.000Z' }), TODAY)).toBe(false);
  });
});

describe('resolveCompletion', () => {
  it('ohne Wiederholung: completedAt wird gesetzt', () => {
    const now = new Date('2026-07-03T09:30:00.000Z');
    expect(resolveCompletion(task({ dueDate: TODAY }), TODAY, now)).toEqual({
      completedAt: '2026-07-03T09:30:00.000Z',
    });
  });

  it('mit Wiederholung: dueDate wandert, Aufgabe bleibt offen', () => {
    const patch = resolveCompletion(task({ dueDate: TODAY, rrule: 'daily' }), TODAY);
    expect(patch).toEqual({ dueDate: '2026-07-04' });
    expect(patch.completedAt).toBeUndefined();
  });

  it('überfällige Wiederholung springt hinter heute', () => {
    const patch = resolveCompletion(task({ dueDate: '2026-06-20', rrule: 'weekly' }), TODAY);
    expect(patch).toEqual({ dueDate: '2026-07-04' });
  });
});

describe('groupToday', () => {
  it('überfällig → heute mit Uhrzeit (chronologisch) → heute ohne Uhrzeit', () => {
    const overdueOld = task({ id: 'a', dueDate: '2026-06-30' });
    const overdueNew = task({ id: 'b', dueDate: '2026-07-02' });
    const nine = task({ id: 'c', dueDate: TODAY, dueTime: '09:00' });
    const seven = task({ id: 'd', dueDate: TODAY, dueTime: '07:30' });
    const loose = task({ id: 'e', dueDate: TODAY });
    const done = task({ id: 'f', dueDate: TODAY, completedAt: '2026-07-03T08:00:00.000Z' });
    const groups = groupToday([overdueOld, overdueNew, nine, seven, loose, done], TODAY);
    expect(groups.overdue.map((t) => t.id)).toEqual(['a', 'b']);
    expect(groups.timed.map((t) => t.id)).toEqual(['d', 'c']);
    expect(groups.untimed.map((t) => t.id)).toEqual(['e']);
  });
});

describe('recentlyCompleted', () => {
  it('blendet Erledigte nach 30 Tagen aus, neueste zuerst', () => {
    const fresh = task({ id: 'a', completedAt: '2026-07-02T10:00:00.000Z' });
    const older = task({ id: 'b', completedAt: '2026-06-10T10:00:00.000Z' });
    const ancient = task({ id: 'c', completedAt: '2026-05-01T10:00:00.000Z' });
    expect(recentlyCompleted([older, ancient, fresh], TODAY).map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('kuerzeErledigte', () => {
  const viele = Array.from({ length: 40 }, (_, i) => task({ id: `t${i}` }));

  it('lässt kurze Listen ganz', () => {
    const [gezeigt, rest] = kuerzeErledigte(viele.slice(0, 5));
    expect(gezeigt).toHaveLength(5);
    expect(rest).toBe(0);
  });

  it('kürzt auf die Grenze und beziffert den Rest', () => {
    // In „Alle" werden aus 30 Tagen schnell dreistellige Zahlen; wer das Panel
    // darunter erreichen will, scrollte vorher daran vorbei.
    const [gezeigt, rest] = kuerzeErledigte(viele, 15);
    expect(gezeigt).toHaveLength(15);
    expect(rest).toBe(25);
  });

  it('behält die Reihenfolge — das Letzte zuerst', () => {
    const [gezeigt] = kuerzeErledigte(viele, 3);
    expect(gezeigt.map((t) => t.id)).toEqual(['t0', 't1', 't2']);
  });

  it('kommt mit genau der Grenze klar', () => {
    const [gezeigt, rest] = kuerzeErledigte(viele.slice(0, 15), 15);
    expect(gezeigt).toHaveLength(15);
    expect(rest).toBe(0);
  });
});

describe('groupUpcomingDays', () => {
  it('nur kommende Tage im Fenster, gruppiert + chronologisch, Uhrzeit zuerst', () => {
    const heute = task({ id: 'a', dueDate: TODAY });
    const morgenSpaet = task({ id: 'b', dueDate: '2026-07-04', dueTime: '18:00' });
    const morgenFrueh = task({ id: 'c', dueDate: '2026-07-04', dueTime: '09:00' });
    const inDreiTagen = task({ id: 'd', dueDate: '2026-07-06' });
    const zuWeit = task({ id: 'e', dueDate: '2026-07-15' });
    const erledigt = task({ id: 'f', dueDate: '2026-07-04', completedAt: '2026-07-01T10:00:00.000Z' });
    const groups = groupUpcomingDays([heute, morgenSpaet, morgenFrueh, inDreiTagen, zuWeit, erledigt], TODAY);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-04', '2026-07-06']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['c', 'b']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['d']);
  });

  it('leer ohne kommende Aufgaben', () => {
    expect(groupUpcomingDays([task({ dueDate: TODAY }), task({})], TODAY)).toEqual([]);
  });
});

describe('groupPlanned', () => {
  it('Heute (inkl. überfällig) / Morgen / Diese Woche / Später — leere Gruppen entfallen', () => {
    const overdue = task({ id: 'a', dueDate: '2026-07-01' });
    const today = task({ id: 'b', dueDate: TODAY });
    const tomorrow = task({ id: 'c', dueDate: '2026-07-04' });
    const nextWeek = task({ id: 'd', dueDate: '2026-07-09' });
    const later = task({ id: 'e', dueDate: '2026-08-01' });
    const groups = groupPlanned([later, nextWeek, tomorrow, today, overdue], TODAY);
    expect(groups.map((g) => g.key)).toEqual(['heute', 'morgen', 'woche', 'spaeter']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['a', 'b']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['c']);
    expect(groups[2].tasks.map((t) => t.id)).toEqual(['d']);
    expect(groups[3].tasks.map((t) => t.id)).toEqual(['e']);
  });

  it('Aufgaben ohne Datum tauchen nicht auf', () => {
    expect(groupPlanned([task({})], TODAY)).toEqual([]);
  });
});

describe('adoptOverdueToToday', () => {
  it('holt nur offene überfällige Aufgaben auf heute (Uhrzeit bleibt außen vor)', () => {
    const tasks = [
      task({ id: 'a', dueDate: '2026-07-01', dueTime: '09:00' }), // überfällig
      task({ id: 'b', dueDate: '2026-07-03' }), // heute → nicht betroffen
      task({ id: 'c', dueDate: '2026-06-30', completedAt: '2026-07-01T10:00:00.000Z' }), // erledigt
      task({ id: 'd', dueDate: null }), // undatiert
    ];
    expect(adoptOverdueToToday(tasks, TODAY)).toEqual([{ id: 'a', dueDate: TODAY }]);
  });

  it('leere Liste, wenn nichts überfällig ist', () => {
    expect(adoptOverdueToToday([task({ dueDate: '2026-07-03' })], TODAY)).toEqual([]);
  });
});

describe('listProgress', () => {
  it('zählt erledigte gegen alle Aufgaben', () => {
    const tasks = [
      task({ id: 'a', completedAt: '2026-07-02T10:00:00.000Z' }),
      task({ id: 'b' }),
      task({ id: 'c', dueDate: '2026-07-04' }),
      task({ id: 'd', completedAt: '2026-07-01T09:00:00.000Z' }),
    ];
    expect(listProgress(tasks)).toEqual({ done: 2, total: 4, ratio: 0.5 });
  });

  it('leere Liste → ratio 0', () => {
    expect(listProgress([])).toEqual({ done: 0, total: 0, ratio: 0 });
  });
});

describe('resolveCompletion — flexible Wiederholungen', () => {
  const at = new Date('2026-07-27T20:00:00.000Z');

  it('„3 Tage nach Erledigen" zählt ab HEUTE, nicht ab dem alten Datum', () => {
    // Die Aufgabe war 10 Tage überfällig — trotzdem: heute + 3.
    const r = resolveCompletion(
      { dueDate: '2026-07-17', rrule: 'after:3d', rruleUntil: null },
      '2026-07-27',
      at,
    );
    expect(r.dueDate).toBe('2026-07-30');
    expect(r.completedAt).toBeUndefined();
  });

  it('fester Rhythmus bleibt am Kalender verankert', () => {
    const r = resolveCompletion(
      { dueDate: '2026-07-20', rrule: 'every:2w', rruleUntil: null },
      '2026-07-27',
      at,
    );
    expect(r.dueDate).toBe('2026-08-03');
  });

  it('endet die Serie, wird die Aufgabe endgültig erledigt', () => {
    const r = resolveCompletion(
      { dueDate: '2026-07-27', rrule: 'weekly', rruleUntil: '2026-07-30' },
      '2026-07-27',
      at,
    );
    // Nächster Termin wäre der 3.8. → nach dem Ende → fertig statt weiterlaufen.
    expect(r.dueDate).toBeUndefined();
    expect(r.completedAt).toBe(at.toISOString());
  });

  it('innerhalb der Serie läuft sie normal weiter', () => {
    const r = resolveCompletion(
      { dueDate: '2026-07-27', rrule: 'weekly', rruleUntil: '2026-12-31' },
      '2026-07-27',
      at,
    );
    expect(r.dueDate).toBe('2026-08-03');
  });

  it('ohne Wiederholung bleibt alles wie bisher', () => {
    const r = resolveCompletion({ dueDate: '2026-07-27', rrule: null, rruleUntil: null }, '2026-07-27', at);
    expect(r.completedAt).toBe(at.toISOString());
  });
});

describe('Projekt-Zustand — das gemeldete „überfällig" trotz erledigt', () => {
  const proj = (over: Partial<List> = {}): List => ({
    id: 'p1', name: 'Umzug', icon: 'inbox', color: '#2B5FA6', goal: null,
    deadline: '2026-07-20', sort: 1, createdAt: '2026-07-01T08:00:00.000Z', ...over,
  });
  const heute = '2026-07-27';

  it('läuft, solange noch etwas offen ist', () => {
    expect(projectState(proj(), { done: 1, total: 3 })).toBe('laeuft');
    expect(projectDeadlineLabel(proj(), { done: 1, total: 3 }, heute)).toBe('7 Tage überfällig');
  });

  it('sagt NICHT „überfällig", wenn alles erledigt ist — genau der gemeldete Fehler', () => {
    expect(projectState(proj(), { done: 3, total: 3 })).toBe('alles-erledigt');
    expect(projectDeadlineLabel(proj(), { done: 3, total: 3 }, heute)).toBe('Alles erledigt');
  });

  it('ein abgeschlossenes Projekt ruht — auch mit offenen Aufgaben', () => {
    const zu = proj({ completedAt: '2026-07-25T10:00:00.000Z' });
    expect(projectState(zu, { done: 1, total: 5 })).toBe('abgeschlossen');
    expect(projectDeadlineLabel(zu, { done: 1, total: 5 }, heute)).toBe('Abgeschlossen');
  });

  it('taucht im Kalender nur auf, solange es läuft', () => {
    expect(projectShowsDeadline(proj(), { done: 1, total: 3 })).toBe(true);
    expect(projectShowsDeadline(proj(), { done: 3, total: 3 })).toBe(false);
    expect(projectShowsDeadline(proj({ completedAt: '2026-07-25T10:00:00.000Z' }), { done: 0, total: 0 })).toBe(false);
    expect(projectShowsDeadline(proj({ deletedAt: '2026-07-25T10:00:00.000Z' }), { done: 0, total: 0 })).toBe(false);
    expect(projectShowsDeadline(proj({ deadline: null }), { done: 0, total: 0 })).toBe(false);
  });

  it('ein leeres Projekt mit Deadline mahnt weiterhin — da ist ja nichts erledigt', () => {
    expect(projectState(proj(), { done: 0, total: 0 })).toBe('laeuft');
  });
});

describe('Lebensspanne — ab wann, bis wann', () => {
  const heute = '2026-07-27';

  it('schlummert, solange das Startdatum in der Zukunft liegt', () => {
    expect(isDormant({ startDate: '2026-10-01' }, heute)).toBe(true);
    expect(isDormant({ startDate: heute }, heute)).toBe(false); // ab heute = jetzt
    expect(isDormant({ startDate: null }, heute)).toBe(false);
  });

  it('ist gegenstandslos, wenn der Anlass vorbei ist — NICHT überfällig', () => {
    expect(isExpired({ expiresOn: '2026-07-26', completedAt: null }, heute)).toBe(true);
    expect(isExpired({ expiresOn: heute, completedAt: null }, heute)).toBe(false); // heute noch gültig
    // Erledigtes verfällt nicht mehr — es ist ja getan.
    expect(isExpired({ expiresOn: '2026-07-26', completedAt: '2026-07-25T10:00:00.000Z' }, heute)).toBe(false);
  });

  it('isCurrent blendet beides aus, ohne etwas zu löschen', () => {
    expect(isCurrent({ startDate: null, expiresOn: null, completedAt: null }, heute)).toBe(true);
    expect(isCurrent({ startDate: '2026-10-01', expiresOn: null, completedAt: null }, heute)).toBe(false);
    expect(isCurrent({ startDate: null, expiresOn: '2026-07-01', completedAt: null }, heute)).toBe(false);
  });

  it('sammelt Verfallenes für den Aufräum-Hinweis', () => {
    const t = (over: Partial<Task>): Task => ({
      id: 'x', listId: 'default', title: 'T', note: null, dueDate: null, dueTime: null, rrule: null,
      flagged: false, eventId: null, completedAt: null, notificationId: null, tags: [], subtasks: [],
      createdAt: '2026-07-01T08:00:00.000Z', sort: 1, ...over,
    });
    const alle = [t({ id: 'a', expiresOn: '2026-07-01' }), t({ id: 'b' }), t({ id: 'c', expiresOn: '2026-07-01', deletedAt: '2026-07-02T00:00:00.000Z' })];
    expect(expiredTasks(alle, heute).map((x) => x.id)).toEqual(['a']);
  });

  it('beschriftet die Spanne verständlich', () => {
    expect(lifespanLabel({ startDate: '2026-10-01', expiresOn: null, completedAt: null }, heute)).toBe('ab 2026-10-01');
    expect(lifespanLabel({ startDate: null, expiresOn: '2026-08-10', completedAt: null }, heute)).toBe('bis 2026-08-10');
    expect(lifespanLabel({ startDate: null, expiresOn: '2026-07-01', completedAt: null }, heute)).toBe('Anlass vorbei');
    expect(lifespanLabel({ startDate: null, expiresOn: null, completedAt: null }, heute)).toBeNull();
  });
});

describe('Warten auf — die Aufgabe liegt bei jemand anderem', () => {
  it('wartend, solange sie offen ist; erledigt beendet das Warten', () => {
    expect(isWaiting({ waiting: true, completedAt: null })).toBe(true);
    expect(isWaiting({ waiting: false, completedAt: null })).toBe(false);
    expect(isWaiting({ waiting: undefined, completedAt: null })).toBe(false);
    // Abgehakt ist fertig — sonst fiele sie aus der Erledigt-Sektion heraus.
    expect(isWaiting({ waiting: true, completedAt: '2026-07-02T10:00:00.000Z' })).toBe(false);
  });

  it('fällt aus isCurrent — das eine Tor vor Heute, Geplant und den Filtern', () => {
    expect(isCurrent({ startDate: null, expiresOn: null, completedAt: null, waiting: true }, TODAY)).toBe(false);
    expect(isCurrent({ startDate: null, expiresOn: null, completedAt: null, waiting: false }, TODAY)).toBe(true);
  });

  it('taucht deshalb weder heute noch als überfällig auf', () => {
    const wartend = task({ dueDate: '2026-07-01', waiting: true });
    const offen = task({ id: 't2', dueDate: '2026-07-01' });
    expect(isOverdue(wartend, TODAY)).toBe(false);
    expect(isDueToday(task({ dueDate: TODAY, waiting: true }), TODAY)).toBe(false);
    const g = groupToday([wartend, offen], TODAY);
    expect(g.overdue.map((t) => t.id)).toEqual(['t2']);
  });

  it('wird auch nicht „auf heute geholt" — man kann nicht nachholen, was bei anderen liegt', () => {
    const wartend = task({ dueDate: '2026-07-01', waiting: true });
    expect(adoptOverdueToToday([wartend], TODAY)).toEqual([]);
  });

  it('sammelt die Wartenden für die eigene Ansicht, ohne den Papierkorb', () => {
    const alle = [
      task({ id: 'a', waiting: true }),
      task({ id: 'b' }),
      task({ id: 'c', waiting: true, deletedAt: '2026-07-02T00:00:00.000Z' }),
      task({ id: 'd', waiting: true, completedAt: '2026-07-02T10:00:00.000Z' }),
    ];
    expect(waitingTasks(alle).map((t) => t.id)).toEqual(['a']);
  });

  it('beschriftet ruhig — mit Person, mit Text, mit beidem, mit nichts', () => {
    const w = { waiting: true, completedAt: null };
    expect(waitingLabel({ ...w, waitingFor: null }, 'Anna')).toBe('Wartet auf Anna');
    expect(waitingLabel({ ...w, waitingFor: 'Angebot' }, null)).toBe('Wartet auf Angebot');
    expect(waitingLabel({ ...w, waitingFor: 'Angebot' }, 'Anna')).toBe('Wartet auf Anna · Angebot');
    expect(waitingLabel({ ...w, waitingFor: null }, null)).toBe('Wartet');
    expect(waitingLabel({ ...w, waitingFor: '   ' }, null)).toBe('Wartet');
    // Nicht wartend → gar keine Zeile.
    expect(waitingLabel({ waiting: false, waitingFor: 'x', completedAt: null }, 'Anna')).toBeNull();
  });
});

describe('Eine Aufgabe gehört in GENAU EINEN Abschnitt der Liste', () => {
  it('sortiert den Normalfall nach „offen"', () => {
    expect(listenGruppe(task({}), TODAY)).toBe('offen');
  });

  it('Anlass vorbei schlägt alles — daran ändert kein Warten etwas', () => {
    expect(listenGruppe(task({ expiresOn: '2026-07-01' }), TODAY)).toBe('verfallen');
    expect(listenGruppe(task({ expiresOn: '2026-07-01', waiting: true }), TODAY)).toBe('verfallen');
    expect(listenGruppe(task({ expiresOn: '2026-07-01', startDate: '2026-09-01' }), TODAY)).toBe('verfallen');
  });

  it('Warten schlägt „später" — man wartet ja bereits', () => {
    // Genau dieser Fall stand bis v1.74 in ZWEI Abschnitten.
    expect(listenGruppe(task({ waiting: true, startDate: '2026-09-01' }), TODAY)).toBe('warten');
    expect(listenGruppe(task({ waiting: true }), TODAY)).toBe('warten');
  });

  it('„später" bleibt für das, was schlicht noch nicht dran ist', () => {
    expect(listenGruppe(task({ startDate: '2026-09-01' }), TODAY)).toBe('spaeter');
  });

  it('Erledigtes fällt in keine dieser Gruppen — es hat seine eigene', () => {
    const fertig = { completedAt: '2026-07-02T10:00:00.000Z' };
    expect(listenGruppe(task({ ...fertig, expiresOn: '2026-07-01' }), TODAY)).toBe('offen');
    expect(listenGruppe(task({ ...fertig, waiting: true }), TODAY)).toBe('offen');
  });

  it('keine Aufgabe landet in zwei Gruppen — die Probe über alle Kombinationen', () => {
    const kombis: Partial<Task>[] = [];
    for (const w of [false, true]) {
      for (const s of [null, '2026-09-01']) {
        for (const e of [null, '2026-07-01']) kombis.push({ waiting: w, startDate: s, expiresOn: e });
      }
    }
    const gezaehlt = new Map<string, number>();
    for (const k of kombis) {
      const g = listenGruppe(task(k), TODAY);
      gezaehlt.set(g, (gezaehlt.get(g) ?? 0) + 1);
    }
    // Acht Kombinationen, acht Zuordnungen — jede genau einmal vergeben.
    expect([...gezaehlt.values()].reduce((a, b) => a + b, 0)).toBe(8);
  });
});

describe('Der Abend als zweite Hälfte des Tages', () => {
  const heute = '2026-07-27';
  const t = (over: Partial<Task>): Task => ({
    id: 'x', listId: 'default', title: 'T', note: null, dueDate: heute, dueTime: null, rrule: null,
    flagged: false, eventId: null, completedAt: null, notificationId: null, tags: [], subtasks: [],
    createdAt: '2026-07-01T08:00:00.000Z', sort: 1, ...over,
  });

  it('trennt Tagsüber und Abends', () => {
    const g = groupToday([t({ id: 'a', title: 'Steuer' }), t({ id: 'b', title: 'Anna anrufen', evening: true })], heute);
    expect(g.untimed.map((x) => x.title)).toEqual(['Steuer']);
    expect(g.evening.map((x) => x.title)).toEqual(['Anna anrufen']);
  });

  it('mit Uhrzeit bleibt die Aufgabe auf der Zeitachse — die Markierung wirkt dort nicht', () => {
    const g = groupToday([t({ id: 'c', title: 'Zahnarzt', dueTime: '19:00', evening: true })], heute);
    expect(g.timed.map((x) => x.title)).toEqual(['Zahnarzt']);
    expect(g.evening).toEqual([]);
  });

  it('ohne Abend-Aufgaben bleibt die Gruppe leer', () => {
    expect(groupToday([t({ id: 'd' })], heute).evening).toEqual([]);
  });
});

// ——— Fehlersuche v1.48.0: Lebensspanne gegen „Heute" ———
// Verfallen heißt „gegenstandslos", nicht „zu spät". Auf dem Bildschirm, wo
// „überfällig" am lautesten steht, muss das gelten — sonst tut das Feld genau
// dort nichts, wo es gebraucht wird.
describe('Verfallene und schlummernde Aufgaben auf „Heute"', () => {
  const verfallen = task({ id: 'tv1234', dueDate: '2026-06-20', expiresOn: '2026-06-30' });
  const schlummert = task({ id: 'ts1234', dueDate: TODAY, startDate: '2026-08-01' });
  const normal = task({ id: 'tn1234', dueDate: '2026-06-20' });

  it('eine verfallene Aufgabe steht nicht mehr unter Überfällig', () => {
    const g = groupToday([verfallen, normal], TODAY);
    expect(g.overdue.map((t) => t.id)).toEqual(['tn1234']);
  });

  it('eine schlummernde Aufgabe taucht heute noch nicht auf', () => {
    const g = groupToday([schlummert], TODAY);
    expect(g.timed).toHaveLength(0);
    expect(g.untimed).toHaveLength(0);
    expect(g.evening).toHaveLength(0);
  });

  it('„Überfällige auf heute holen" weckt nichts Verfallenes wieder auf', () => {
    // Sonst macht EIN Tipp aus gegenstandslos wieder „heute fällig" — und das
    // stillschweigend für alle auf einmal.
    expect(adoptOverdueToToday([verfallen, normal], TODAY).map((p) => p.id)).toEqual(['tn1234']);
  });
});
