import { eq, and, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { tables } from '@/db/schema';
import {
  CreateTableInput,
  UpdateTableInput,
  TableDto,
  TableFamilyDto,
  tableDtoSchema,
  tableFamilyDtoSchema,
} from '@/schemas/seating';
import { TableNotFoundError, OptimisticLockError } from './errors';

import { TxDb } from './types';

export function mapToTableDto(row: typeof tables.$inferSelect): TableDto {
  return tableDtoSchema.parse({
    id: row.id,
    eventId: row.eventId,
    tableNumber: row.tableNumber ?? null,
    name: row.name,
    shape: row.shape,
    capacity: row.capacity,
    notes: row.notes ?? null,
    version: row.version,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export function mapToTableFamilyDto(row: typeof tables.$inferSelect): TableFamilyDto {
  return tableFamilyDtoSchema.parse({
    id: row.id,
    eventId: row.eventId,
    tableNumber: row.tableNumber ?? null,
    name: row.name,
    shape: row.shape,
    capacity: row.capacity,
    notes: null,
    version: row.version,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export async function createTable(txDb: TxDb, input: CreateTableInput): Promise<TableDto> {
  const [created] = await txDb
    .insert(tables)
    .values({
      eventId: input.eventId,
      tableNumber: input.tableNumber ?? null,
      name: input.name,
      shape: input.shape ?? 'round',
      capacity: input.capacity,
      notes: input.notes ?? null,
      version: 1,
    })
    .returning();

  return mapToTableDto(created);
}

export async function getTableById(
  txDb: TxDb,
  id: string,
  forUpdate = false
): Promise<TableDto | null> {
  const query = txDb.select().from(tables).where(eq(tables.id, id));
  if (forUpdate) {
    query.for('update');
  }
  const [row] = await query;
  if (!row) return null;
  return mapToTableDto(row);
}

export async function listTablesByEvent(
  txDb: TxDb,
  eventId: string,
  role: 'owner' | 'family_view' = 'owner'
): Promise<(TableDto | TableFamilyDto)[]> {
  const rows = await txDb
    .select()
    .from(tables)
    .where(eq(tables.eventId, eventId))
    .orderBy(tables.name);

  if (role === 'family_view') {
    return rows.map(mapToTableFamilyDto);
  }
  return rows.map(mapToTableDto);
}

export async function updateTable(
  txDb: TxDb,
  id: string,
  input: UpdateTableInput
): Promise<TableDto> {
  const [existing] = await txDb
    .select()
    .from(tables)
    .where(eq(tables.id, id))
    .for('update');

  if (!existing) {
    throw new TableNotFoundError();
  }

  if (input.version !== undefined && existing.version !== input.version) {
    throw new OptimisticLockError(
      'Dữ liệu bàn đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang.',
      existing.version
    );
  }

  const updateData: Partial<typeof tables.$inferInsert> = {
    version: existing.version + 1,
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.tableNumber !== undefined) updateData.tableNumber = input.tableNumber;
  if (input.shape !== undefined) updateData.shape = input.shape;
  if (input.capacity !== undefined) updateData.capacity = input.capacity;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const [updated] = await txDb
    .update(tables)
    .set(updateData)
    .where(eq(tables.id, id))
    .returning();

  return mapToTableDto(updated);
}

export async function deleteTable(txDb: TxDb, id: string): Promise<boolean> {
  const [deleted] = await txDb
    .delete(tables)
    .where(eq(tables.id, id))
    .returning();

  return !!deleted;
}
