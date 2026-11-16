import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { menus } from '@/db/schema';
import {
  CreateMenuInput,
  UpdateMenuInput,
  MenuDto,
  MenuFamilyDto,
  menuDtoSchema,
  menuFamilyDtoSchema,
} from '@/schemas/catering';
import { MenuNotFoundError, OptimisticLockError } from './errors';

import { TxDb } from './types';

export function mapToMenuDto(row: typeof menus.$inferSelect): MenuDto {
  return menuDtoSchema.parse({
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    mealType: row.mealType,
    description: row.description ?? null,
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export function mapToMenuFamilyDto(row: typeof menus.$inferSelect): MenuFamilyDto {
  return menuFamilyDtoSchema.parse({
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    mealType: row.mealType,
    description: row.description ?? null,
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export async function createMenu(txDb: TxDb, input: CreateMenuInput): Promise<MenuDto> {
  const [created] = await txDb
    .insert(menus)
    .values({
      eventId: input.eventId,
      name: input.name,
      mealType: input.mealType ?? 'banquet',
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      version: 1,
    })
    .returning();

  return mapToMenuDto(created);
}

export async function getMenuById(txDb: TxDb, id: string): Promise<MenuDto | null> {
  const [row] = await txDb
    .select()
    .from(menus)
    .where(eq(menus.id, id));

  if (!row) return null;
  return mapToMenuDto(row);
}

export async function listMenusByEvent(
  txDb: TxDb,
  eventId: string,
  role: 'owner' | 'family_view' = 'owner'
): Promise<(MenuDto | MenuFamilyDto)[]> {
  const rows = await txDb
    .select()
    .from(menus)
    .where(eq(menus.eventId, eventId))
    .orderBy(menus.name);

  if (role === 'family_view') {
    return rows.map(mapToMenuFamilyDto);
  }
  return rows.map(mapToMenuDto);
}

export async function updateMenu(
  txDb: TxDb,
  id: string,
  input: UpdateMenuInput
): Promise<MenuDto> {
  const [existing] = await txDb
    .select()
    .from(menus)
    .where(eq(menus.id, id))
    .for('update');

  if (!existing) {
    throw new MenuNotFoundError();
  }

  if (input.version !== undefined && existing.version !== input.version) {
    throw new OptimisticLockError(
      'Thực đơn đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang.',
      existing.version
    );
  }

  const updateData: Partial<typeof menus.$inferInsert> = {
    version: existing.version + 1,
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.mealType !== undefined) updateData.mealType = input.mealType;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await txDb
    .update(menus)
    .set(updateData)
    .where(eq(menus.id, id))
    .returning();

  return mapToMenuDto(updated);
}

export async function deleteMenu(txDb: TxDb, id: string): Promise<boolean> {
  const [deleted] = await txDb
    .delete(menus)
    .where(eq(menus.id, id))
    .returning();

  return !!deleted;
}
