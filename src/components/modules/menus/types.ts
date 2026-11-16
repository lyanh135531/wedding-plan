export type CourseType = 'appetizer' | 'main' | 'dessert' | 'beverage';
export type MealTier = 'standard' | 'vegetarian' | 'child' | 'special';
export type MealType = 'banquet' | 'buffet' | 'cocktail';

export interface MenuItem {
  id: string;
  menuId: string;
  courseOrder: number;
  courseType: CourseType;
  name: string;
  dietaryFlags: string[]; // 'vegetarian', 'gluten_free', 'kids', 'halal', etc.
  allergens?: string | null;
  notes?: string | null;
  price?: number; // dish price for owner
}

export interface Menu {
  id: string;
  name: string;
  mealType: MealType;
  description?: string | null;
  items: MenuItem[];
  isActive: boolean;
  version: number;
  pricePerTable?: number; // total price per table for owner
}

export interface MealSummary {
  adultMeals: number;
  childMeals: number;
  vegetarianMeals: number;
  specialMeals: number;
  bufferMeals: number;
  totalMeals: number;
  confirmedGuests: number;
}

export interface CateringSnapshot {
  id: string;
  snapshotVersion: number;
  adultMeals: number;
  childMeals: number;
  vegetarianMeals: number;
  specialMeals: number;
  bufferMeals: number;
  totalMeals: number;
  notes?: string | null;
  isLocked: boolean;
  lockedAt?: string | null;
  lockedBy?: string | null;
}
