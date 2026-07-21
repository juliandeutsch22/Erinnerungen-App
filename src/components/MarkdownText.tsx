// MarkdownText.tsx — setzt Assistenten-Antworten als ruhigen Text statt als
// Rohtext mit Sternchen: Absätze, Aufzählungen mit hängendem Einzug,
// nummerierte Listen, Zwischenüberschriften in der Antiqua, tappbare Links.
// Das Parsen übernimmt lib/markdown.ts (rein, getestet).
import React, { useMemo } from 'react';
import { Linking, Text, View } from 'react-native';

import { Type } from '@/components/Type';
import { type InlinePart, parseMarkdownLight } from '@/lib/markdown';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing, T } from '@/theme/theme.tokens';

function InlineRun({ parts, linkColor }: { parts: InlinePart[]; linkColor: string }) {
  return (
    <>
      {parts.map((p, i) =>
        p.link ? (
          <Text
            key={i}
            style={{ color: linkColor, textDecorationLine: 'underline' }}
            onPress={() => void Linking.openURL(p.link!)}
          >
            {p.text}
          </Text>
        ) : (
          <Text
            key={i}
            style={{
              fontWeight: p.bold ? '700' : undefined,
              fontStyle: p.italic ? 'italic' : undefined,
            }}
          >
            {p.text}
          </Text>
        ),
      )}
    </>
  );
}

/** Markdown-Licht gerendert; `markdown` ist der bereits um Aktions-Blöcke bereinigte Text. */
export function MarkdownText({ markdown }: { markdown: string }) {
  const colors = useColors();
  const blocks = useMemo(() => parseMarkdownLight(markdown), [markdown]);

  return (
    <View style={{ gap: Spacing.sm }}>
      {blocks.map((b, i) => {
        if (b.kind === 'heading') {
          return (
            <Type
              key={i}
              variant="heading"
              style={{ fontSize: T.lg + 1, lineHeight: (T.lg + 1) * 1.25, marginTop: i > 0 ? Spacing.xs : 0 }}
            >
              <InlineRun parts={b.parts} linkColor={colors.teal} />
            </Type>
          );
        }
        if (b.kind === 'bullet' || b.kind === 'numbered') {
          return (
            <View key={i} style={{ flexDirection: 'row', paddingLeft: Spacing.xs }}>
              {b.kind === 'bullet' ? (
                // Marker als eigene Spalte → hängender Einzug bei Umbrüchen.
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: colors.text3,
                    marginTop: T.md * 1.5 * 0.5 - 2,
                    marginRight: Spacing.sm + 2,
                  }}
                />
              ) : (
                <Type variant="body" tone="text3" tabular style={{ lineHeight: T.md * 1.5, minWidth: 18, marginRight: Spacing.xs }}>
                  {b.ordinal}.
                </Type>
              )}
              <Type variant="body" style={{ flex: 1, lineHeight: T.md * 1.5 }}>
                <InlineRun parts={b.parts} linkColor={colors.teal} />
              </Type>
            </View>
          );
        }
        return (
          <Type key={i} variant="body" style={{ lineHeight: T.md * 1.5 }}>
            <InlineRun parts={b.parts} linkColor={colors.teal} />
          </Type>
        );
      })}
    </View>
  );
}
