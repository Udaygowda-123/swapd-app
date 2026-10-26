import { BookOpen, Footprints, Gamepad2, Gem, Headphones, Lamp, Palette, Shapes, Shirt, type LucideIcon } from 'lucide-react-native';
import type { Category } from '@/lib/shared';

// Same icon per category as the web Discover chips.
export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  FASHION: Shirt, SNEAKERS: Footprints, ELECTRONICS: Headphones, GAMING: Gamepad2, COLLECTIBLES: Gem, BOOKS: BookOpen, HOBBIES: Palette, HOME: Lamp, OTHER: Shapes,
};
