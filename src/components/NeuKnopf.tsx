// NeuKnopf.tsx — „hier entsteht etwas Neues", in einer einzigen Sprache.
//
// Bis v1.65 gab es SIEBEN Formen für dieselbe Handlung, und keine von ihnen
// war eine Entscheidung — sie waren nacheinander entstanden:
//
//   Heute · Notizen      nacktes Plus (22, teal) auf Titelhöhe
//   Assistent            dasselbe Plus, aber eine Zeile HÖHER, in der Kopfleiste
//   Kalender             CalendarPlus statt Plus
//   Listen               Geister-Karte am Rasterende (Plus 22, text3)
//   Listen · Filter      teal Textlink „Neuer Filter" mit Regler-Glyphe
//   Listen-Detail        satter blauer Primär-Knopf über die volle Breite
//   Notiz-Detail         Plus 18 inline in der Checkliste
//
// Das Problem war nie die Zahl der Formen — ein Raster braucht eine andere
// Geste als eine Kopfzeile. Das Problem war, dass es keine REGEL gab, die man
// aussprechen kann. Jetzt gibt es sie, und sie hat vier Sätze:
//
//   `NeuKnopf`     = Nebenweg des BILDSCHIRMS      → Kopfzeile, ganz rechts
//   `NeuLink`      = Nebenweg eines ABSCHNITTS     → rechts neben der Eyebrow
//   Geister-Karte  = Nebenweg in einem RASTER      → am Ende des Rasters
//   Primär-Knopf   = HAUPTHANDLUNG eines Detail-Bildschirms
//
// Der letzte Fall ist selten. Solange die EINE Zeile unten steht und dasselbe
// tut, ist Anlegen fast nie die Haupthandlung — deshalb ist der Knopf auf dem
// Listen-Detail seit v1.66 sekundär: er sagt „auch das geht", statt zu
// schreien, während der eigentliche Hauptweg darunter flüstert.
//
// Die Glyphe ist IMMER `Plus`. Der Kalender hatte ein `CalendarPlus` — das
// erklärt nichts, was der Bildschirm nicht schon sagt, und macht aus einem
// wiedererkennbaren Symbol vier.
import { Plus, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Type } from '@/components/Type';
import { hapticSelect } from '@/lib/haptics';
import { useColors } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/theme.tokens';

/**
 * Das Plus der Kopfzeile. Gehört auf TITELHÖHE und als LETZTES Element nach
 * rechts — sonst springt es beim Tab-Wechsel, und genau das tat es vorher
 * zwischen „Notizen" und „Assistent".
 */
export function NeuKnopf({
  label,
  onPress,
  style,
}: {
  /** „Neue Aufgabe", „Neue Notiz", „Neuer Termin", „Neuer Chat". */
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      // Das negative Margin gehört HIERHIN, nicht an die Aufrufstellen: die
      // Trefferfläche ist rundum 8 px größer als die Glyphe, und ohne den
      // Ausgleich stünde das Plus optisch 8 px vor dem Inhaltsrand — auf
      // manchen Bildschirmen so, auf anderen anders. Genau das war der Fall.
      style={[{ padding: Spacing.sm, marginRight: -Spacing.sm }, style]}
    >
      <Plus size={22} color={colors.teal} strokeWidth={2.2} />
    </PressableScale>
  );
}

/**
 * Die Aktion eines ABSCHNITTS — dort, wo ein Kopf-Plus falsch wäre, weil es
 * für den ganzen Bildschirm spräche. Steht rechts neben der Eyebrow, trägt
 * das Wort mit, weil eine Glyphe allein nicht sagt, WAS entsteht.
 */
export function NeuLink({
  label,
  icon: Icon = Plus,
  onPress,
}: {
  label: string;
  /** Nur, wo die Sache eine eigene Glyphe hat (Filter = Regler). */
  icon?: LucideIcon;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs }}
    >
      <Icon size={16} color={colors.teal} strokeWidth={2.2} />
      <Type variant="label" tone="teal">{label}</Type>
    </PressableScale>
  );
}

/**
 * Die Kopfzeile eines Übersichts-Bildschirms: Titel links, Zähl-Zeile
 * darunter, Aktionen rechts auf Titelhöhe. Bündelt genau das Muster, das
 * „Heute", „Notizen", „Listen", „Kalender" und der „Assistent" alle einzeln
 * nachgebaut hatten — mit jedes Mal leicht anderer Ausrichtung.
 */
export function ScreenKopf({
  titel,
  unter,
  links,
  aktionen,
}: {
  titel: React.ReactNode;
  /** Die ruhige Zähl-Zeile („3 Notizen"). */
  unter?: React.ReactNode;
  /** Etwas VOR dem Titel (Glyphe des Bildschirms). */
  links?: React.ReactNode;
  /** Rechts, auf Titelhöhe. Das `NeuKnopf` gehört ans ENDE. */
  aktionen?: React.ReactNode;
}) {
  // Die Aktionen liegen in der TITELZEILE, nicht neben der ganzen Spalte.
  // Mit `flex-end` über beide Zeilen rutschte das Plus auf die Höhe der
  // Zähl-Zeile — auf „Notizen" saß es dadurch 21 px unter dem Titel, auf
  // „Assistent" (ohne Zähl-Zeile in der Zeile) genau richtig. Dasselbe
  // Bauteil, zwei Höhen.
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 }}>
          {links}
          {titel}
        </View>
        {aktionen && <View style={{ flexDirection: 'row', alignItems: 'center' }}>{aktionen}</View>}
      </View>
      {unter}
    </View>
  );
}
