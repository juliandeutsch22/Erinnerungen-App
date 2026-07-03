// listMeta.ts — kuratierte Icon- und Farbauswahl für Listen. Farben bleiben in
// der Marken-Familie (Teal/Indigo + Abstufungen) — kein freies Farbrad.
import {
  Book,
  Briefcase,
  Dumbbell,
  Gift,
  Heart,
  House,
  Inbox,
  type LucideIcon,
  PawPrint,
  Plane,
  ShoppingCart,
  Star,
  Utensils,
} from 'lucide-react-native';

export const LIST_ICONS: Record<string, LucideIcon> = {
  inbox: Inbox,
  'shopping-cart': ShoppingCart,
  briefcase: Briefcase,
  house: House,
  heart: Heart,
  star: Star,
  book: Book,
  gift: Gift,
  plane: Plane,
  dumbbell: Dumbbell,
  utensils: Utensils,
  'paw-print': PawPrint,
};

export function listIcon(name: string): LucideIcon {
  return LIST_ICONS[name] ?? Inbox;
}

/** Teal/Indigo-Familie (Iron Rule: keine fremden Akzente, kein Rot). */
export const LIST_COLORS = ['#1FB6A6', '#149286', '#0E7C71', '#5B6CFF', '#7C8AFF', '#3D4ACC'] as const;
