import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { menuItems } from '@/db/schema';
import {
  AddMenuItemInput,
  UpdateMenuItemInput,
  MenuItemDto,
  menuItemDtoSchema,
} from '@/schemas/catering';
import { MenuItemNotFoundError } from './errors';

import { TxDb } from './types';

export function mapToMenuItemDto(row: typeof menuItems.$inferSelect): MenuItemDto {
  return menuItemDtoSchema.parse({
    id: row.id,
    menuId: row.menuId,
    eventId: row.eventId,
    courseOrder: row.courseOrder,
    courseType: row.courseType,
    name: row.name,
    dietaryFlags: Array.isArray(row.dietaryFlags) ? (row.dietaryFlags as string[]) : [],
    allergens: row.allergens ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export async function addMenuItem(
  txDb: TxDb,
  input: AddMenuItemInput
): Promise<MenuItemDto> {
  const [created] = await txDb
    .insert(menuItems)
    .values({
      menuId: input.menuId,
      eventId: input.eventId,
      courseOrder: input.courseOrder ?? 1,
      courseType: input.courseType ?? 'main',
      name: input.name,
      dietaryFlags: input.dietaryFlags ?? [],
      allergens: input.allergens ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  return mapToMenuItemDto(created);
}

export async function updateMenuItem(
  txDb: TxDb,
  id: string,
  input: UpdateMenuItemInput
): Promise<MenuItemDto> {
  const [existing] = await txDb
    .select()
    .from(menuItems)
    .where(eq(menuItems.id, id));

  if (!existing) {
    throw new MenuItemNotFoundError();
  }

  const updateData: Partial<typeof menuItems.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.courseOrder !== undefined) updateData.courseOrder = input.courseOrder;
  if (input.courseType !== undefined) updateData.courseType = input.courseType;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.dietaryFlags !== undefined) updateData.dietaryFlags = input.dietaryFlags;
  if (input.allergens !== undefined) updateData.allergens = input.allergens;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const [updated] = await txDb
    .update(menuItems)
    .set(updateData)
    .where(eq(menuItems.id, id))
    .returning();

  return mapToMenuItemDto(updated);
}

export async function deleteMenuItem(txDb: TxDb, id: string): Promise<boolean> {
  const [deleted] = await txDb
    .delete(menuItems)
    .where(eq(menuItems.id, id))
    .returning();

  return !!deleted;
}

export async function listMenuItems(
  txDb: TxDb,
  menuId: string
): Promise<MenuItemDto[]> {
  const rows = await txDb
    .select()
    .from(menuItems)
    .where(eq(menuItems.menuId, menuId))
    .orderBy(menuItems.courseOrder);

  return rows.map(mapToMenuItemDto);
}
