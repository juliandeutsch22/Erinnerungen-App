// listMeta.ts — kuratierte Icon- und Farbauswahl für Listen. Farben bleiben in
// der Marken-Familie (mediterrane Erdtöne) — kein freies Farbrad.
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

/** Mediterrane Erdtöne (Iron Rule: keine fremden Akzente, kein Alarm-Rot):
 *  Terrakotta · Ton · Ocker · Salbei · Olive · Meerblau. */
export const LIST_COLORS = ['#C96A47', '#A9532F', '#C99A3F', '#74936B', '#5A7A50', '#4E7E9B'] as const;
