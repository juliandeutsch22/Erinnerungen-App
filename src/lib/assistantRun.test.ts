// assistantRun.test.ts — der Lauf-Store. Wichtig ist hier nicht die Buchhaltung,
// sondern dass ein Lauf das Verlassen des Bildschirms überlebt und dass ein
// abgeräumter Lauf nicht wieder auflebt.
import { anyRunning, labelsOfRunning, RUN_BRAINDUMP, runKeyForChat, useAssistantRuns } from './assistantRun';

const store = () => useAssistantRuns.getState();

beforeEach(() => useAssistantRuns.setState({ runs: {} }));

describe('assistantRun', () => {
  it('hält einen laufenden Vorgang, unabhängig von jedem Bildschirm', () => {
    store().begin(RUN_BRAINDUMP, 'Braindump');
    store().delta(RUN_BRAINDUMP, 'Ich sor');
    store().delta(RUN_BRAINDUMP, 'tiere…');
    const run = store().runs[RUN_BRAINDUMP];
    expect(run.status).toBe('running');
    expect(run.stream).toBe('Ich sortiere…');
    expect(anyRunning(store().runs)).toBe(true);
    expect(labelsOfRunning(store().runs)).toEqual(['Braindump']);
  });

  it('legt das Ergebnis ab und beendet den Lauf', () => {
    store().begin(RUN_BRAINDUMP, 'Braindump');
    store().finish(RUN_BRAINDUMP, { clean: 'Sortiert.', actions: null });
    const run = store().runs[RUN_BRAINDUMP];
    expect(run.status).toBe('done');
    expect(run.clean).toBe('Sortiert.');
    // Der Zwischenstand wird beim Abschluss weggeräumt — er hat seinen Zweck erfüllt.
    expect(run.stream).toBe('');
    expect(anyRunning(store().runs)).toBe(false);
  });

  it('ein abgeräumter Lauf lebt durch ein spätes Delta NICHT wieder auf', () => {
    store().begin(RUN_BRAINDUMP, 'Braindump');
    store().clear(RUN_BRAINDUMP);
    store().delta(RUN_BRAINDUMP, 'zu spät');
    expect(store().runs[RUN_BRAINDUMP]).toBeUndefined();
  });

  it('ein fertiger Lauf nimmt keine Deltas mehr an', () => {
    store().begin(RUN_BRAINDUMP, 'Braindump');
    store().finish(RUN_BRAINDUMP, { clean: 'fertig', actions: null });
    store().delta(RUN_BRAINDUMP, 'noch was');
    expect(store().runs[RUN_BRAINDUMP].stream).toBe('');
    expect(store().runs[RUN_BRAINDUMP].clean).toBe('fertig');
  });

  it('mehrere Läufe stören sich nicht — jeder Chat hat seinen eigenen', () => {
    store().begin(RUN_BRAINDUMP, 'Braindump');
    store().begin(runKeyForChat('c1'), 'Rom-Reise');
    store().begin(runKeyForChat('c2'), 'Umzug');
    store().fail(runKeyForChat('c1'), 'Keine Verbindung');
    expect(labelsOfRunning(store().runs).sort()).toEqual(['Braindump', 'Umzug']);
    expect(store().runs[runKeyForChat('c1')].error).toBe('Keine Verbindung');
  });
});
