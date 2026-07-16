// listMeta.ts — kuratierte Icon- und Farbauswahl für Listen. Farben bleiben in
// der Marken-Familie (Ägäis & Marmor) — kein freies Farbrad.
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

/** Ägäis-Töne (Iron Rule: keine fremden Akzente, kein Alarm-Rot):
 *  Lapis · Tiefsee · Meer-Türkis · Olive · Tiefe Olive · Ocker. */
export const LIST_COLORS = ['#2B5FA6', '#1F4467', '#4E8296', '#7E8C5C', '#5C6B42', '#B08A3C'] as const;
