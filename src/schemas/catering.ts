import { z } from 'zod';
import {
  uuidSchema,
  versionSchema,
  dateTimeStringSchema,
  notesSchema,
} from './common';

export const mealTypeEnum = z.enum(['banquet', 'buffet', 'cocktail']);
export type MealType = z.infer<typeof mealTypeEnum>;

export const courseTypeEnum = z.enum(['appetizer', 'main', 'dessert', 'beverage']);
export type CourseType = z.infer<typeof courseTypeEnum>;

export const mealTierEnum = z.enum(['standard', 'vegetarian', 'child', 'special']);
export type MealTier = z.infer<typeof mealTierEnum>;

// Menu Schemas
export const createMenuSchema = z.object({
  eventId: uuidSchema,
  name: z.string().trim().min(1, { message: 'Tên thực đơn không được để trống' }).max(255),
  mealType: mealTypeEnum.default('banquet'),
  description: notesSchema.optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CreateMenuInput = z.infer<typeof createMenuSchema>;

export const updateMenuSchema = z.object({
  name: z.string().trim().min(1, { message: 'Tên thực đơn không được để trống' }).max(255).optional(),
  mealType: mealTypeEnum.optional(),
  description: notesSchema.optional().nullable(),
  isActive: z.boolean().optional(),
  version: versionSchema.optional(),
});
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;

export const menuDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  name: z.string(),
  mealType: mealTypeEnum,
  description: z.string().nullable(),
  isActive: z.boolean(),
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type MenuDto = z.infer<typeof menuDtoSchema>;

export const menuFamilyDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  name: z.string(),
  mealType: mealTypeEnum,
  description: z.string().nullable(),
  isActive: z.boolean(),
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type MenuFamilyDto = z.infer<typeof menuFamilyDtoSchema>;

// Menu Item Schemas
export const addMenuItemSchema = z.object({
  menuId: uuidSchema,
  eventId: uuidSchema,
  courseOrder: z.number().int().default(1),
  courseType: courseTypeEnum.default('main'),
  name: z.string().trim().min(1, { message: 'Tên món ăn không được để trống' }).max(255),
  dietaryFlags: z.array(z.string()).default([]),
  allergens: z.string().max(255).optional().nullable(),
  notes: notesSchema.optional().nullable(),
});
export type AddMenuItemInput = z.infer<typeof addMenuItemSchema>;

export const updateMenuItemSchema = z.object({
  courseOrder: z.number().int().optional(),
  courseType: courseTypeEnum.optional(),
  name: z.string().trim().min(1).max(255).optional(),
  dietaryFlags: z.array(z.string()).optional(),
  allergens: z.string().max(255).optional().nullable(),
  notes: notesSchema.optional().nullable(),
});
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

export const menuItemDtoSchema = z.object({
  id: uuidSchema,
  menuId: uuidSchema,
  eventId: uuidSchema,
  courseOrder: z.number().int(),
  courseType: courseTypeEnum,
  name: z.string(),
  dietaryFlags: z.array(z.string()).nullable(),
  allergens: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type MenuItemDto = z.infer<typeof menuItemDtoSchema>;

// Guest Meal Selection Schemas
export const setGuestMealSelectionSchema = z.object({
  eventId: uuidSchema,
  guestId: uuidSchema,
  mealTier: mealTierEnum.default('standard'),
  dietaryNotes: notesSchema.optional().nullable(),
  allergyNotes: notesSchema.optional().nullable(),
});
export type SetGuestMealSelectionInput = z.infer<typeof setGuestMealSelectionSchema>;

export const guestMealSelectionDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  guestId: uuidSchema,
  mealTier: mealTierEnum,
  dietaryNotes: z.string().nullable(),
  allergyNotes: z.string().nullable(),
  version: z.number().int(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});
export type GuestMealSelectionDto = z.infer<typeof guestMealSelectionDtoSchema>;

// Meal Summary DTO
export const mealSummaryDtoSchema = z.object({
  eventId: uuidSchema,
  adultMeals: z.number().int().nonnegative(),
  childMeals: z.number().int().nonnegative(),
  vegetarianMeals: z.number().int().nonnegative(),
  specialMeals: z.number().int().nonnegative(),
  confirmedMeals: z.number().int().nonnegative(),
  bufferMeals: z.number().int().nonnegative(),
  totalMeals: z.number().int().nonnegative(),
  confirmedGuestsCount: z.number().int().nonnegative(),
  missingMealSelectionCount: z.number().int().nonnegative(),
});
export type MealSummaryDto = z.infer<typeof mealSummaryDtoSchema>;

// Catering Snapshot DTO
export const cateringSnapshotDtoSchema = z.object({
  id: uuidSchema,
  eventId: uuidSchema,
  menuId: uuidSchema.nullable(),
  snapshotVersion: z.number().int(),
  adultMeals: z.number().int(),
  childMeals: z.number().int(),
  vegetarianMeals: z.number().int(),
  specialMeals: z.number().int(),
  bufferMeals: z.number().int(),
  totalMeals: z.number().int(),
  notes: z.string().nullable(),
  isLocked: z.boolean(),
  lockedAt: dateTimeStringSchema.nullable(),
  lockedBy: z.string().nullable(),
  createdAt: dateTimeStringSchema,
});
export type CateringSnapshotDto = z.infer<typeof cateringSnapshotDtoSchema>;
