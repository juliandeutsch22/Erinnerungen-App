// https://docs.expo.dev/guides/using-eslint/
//
// Die hier abgeschalteten Regeln kommen aus der WEB-Welt oder aus dem
// React-Compiler und verlangen in dieser App das Gegenteil von richtig.
// Wer eine davon wieder einschaltet, muss zuerst ihre Begründung entkräften.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // AUS, weil sie in React Native FALSCHES verlangt.
      //
      // Die Regel will `"` in JSX-Text durch `&quot;` ersetzt sehen — das ist
      // eine HTML-Sorge. React Native dekodiert keine HTML-Entities: aus
      // `<Type>&quot;</Type>` wird auf dem Gerät sichtbar der Text `&quot;`.
      // Die App ist voller deutscher Anführungszeichen („…"); die Regel würde
      // also dazu verleiten, sie reihenweise kaputtzumachen.
      'react/no-unescaped-entities': 'off',

      // AUS, weil sie Reanimated falsch liest. Der React-Compiler hält
      // `SharedValue.value` für unveränderlich und meldet jedes
      // `scale.value = withTiming(…)` — auch in einem `onPressIn`-Handler, wo
      // es der vorgesehene Weg der Bibliothek ist. Dasselbe trifft
      // Ref-Callbacks (`ref={(node) => { … .current = node }}`). „Reparieren"
      // hieße hier, die Animationen abzuschalten.
      'react-hooks/immutability': 'off',

      // WARNUNG statt Fehler — bewusst NICHT aus. Das sind Hinweise des
      // React-Compilers, keine Laufzeitfehler:
      //  · `refs` meldet das verbreitete „Ref beim ersten Rendern einmalig
      //    füllen" (chat/[id]: welche Nachrichten aus dem Verlauf stammen).
      //    Die Umschreibung auf `useEffect` hätte einen Rahmen, in dem der
      //    Wert noch null ist — dann träten alle Nachrichten kurz als „neu"
      //    auf. Das wäre schlechter als der Hinweis.
      //  · `purity` meldet `Date.now()` im Rendern. Diese App liest überall
      //    die Uhr beim Rendern (`todayStr()`), das ist ihr Grundprinzip.
      //  · `set-state-in-effect` und `preserve-manual-memoization` betreffen
      //    Stellen, an denen asynchron eintreffende Daten in lokalen Zustand
      //    gespiegelt werden. Sie sauber aufzulösen ist echte Arbeit am
      //    Datenfluss — ein eigenes Vorhaben, keine Aufräumrunde.
      // Sichtbar bleiben sie, damit NEUE Fälle auffallen.
      // AUS: `require()` ist hier die ABSICHT, nicht die Ausnahme. Native
      // Module (Kalender, Fotos, Keychain, Diktat, Dateien …) werden bewusst
      // TRÄGE geladen — ein statischer Import zöge sie in den Web-Build, wo es
      // sie nicht gibt, und ließe die Vorschau abstürzen. Jede dieser Stellen
      // ist im Kopf ihrer Datei begründet. Als Warnung übertönten sie (28 an
      // der Zahl) alles, was wirklich einen Blick verdient.
      '@typescript-eslint/no-require-imports': 'off',

      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
]);
