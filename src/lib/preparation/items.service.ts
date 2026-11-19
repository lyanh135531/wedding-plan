import { eq, and, sql } from 'drizzle-orm';
import { preparationItems } from '@/db/schema';
import {
  CreatePreparationItemInput,
  UpdatePreparationItemInput,
  PreparationItemDto,
  PreparationItemFamilyDto,
} from '@/schemas/preparation';
import { TxDb, ItemMetadata } from './types';
import {
  createPreparationItemRecord,
  getPreparationItemById,
  updatePreparationItemRecord,
  deletePreparationItemRecord,
  listPreparationItemsByEvent,
  mapToPreparationItemDto,
} from './preparation.repository';
import {
  PreparationItemNotFoundError,
  InvalidStatusTransitionError,
  RentalDueDateRequiredError,
} from './errors';

const VALID_ITEM_STATUSES = new Set(['not_prepared', 'packed', 'brought', 'returned']);

export interface RentalReminderItem {
  id: string;
  title: string;
  quantity: number;
  keeper: string | null;
  status: string;
  returnDueDate: string;
  isOverdue: boolean;
  daysRemaining: number;
}

export async function createPreparationItem(
  db: TxDb,
  input: CreatePreparationItemInput
): Promise<PreparationItemDto> {
  if (input.isRental && (!input.returnDueDate || input.returnDueDate.trim() === '')) {
    throw new RentalDueDateRequiredError();
  }

  const metadata: ItemMetadata = {
    quantity: input.quantity ?? 1,
    keeper: input.keeper ?? null,
    location: input.location ?? null,
    bringTime: input.bringTime ?? null,
    notes: input.notes ?? null,
  };

  const returnDate = input.returnDueDate ? new Date(input.returnDueDate) : null;

  return createPreparationItemRecord(db, {
    eventId: input.eventId,
    type: 'item',
    title: input.title,
    category: input.category ?? null,
    status: input.status || 'not_prepared',
    priority: input.priority,
    metadata: metadata as Record<string, unknown>,
    isRental: input.isRental ?? false,
    returnDueDate: returnDate,
    isBlacklisted: false,
    isShared: input.isShared,
  });
}

export async function updatePreparationItem(
  db: TxDb,
  id: string,
  input: UpdatePreparationItemInput
): Promise<PreparationItemDto> {
  const existing = await getPreparationItemById(db, id);
  if (!existing || existing.type !== 'item') {
    throw new PreparationItemNotFoundError(id);
  }

  if (input.status && !VALID_ITEM_STATUSES.has(input.status)) {
    throw new InvalidStatusTransitionError(`Trạng thái đồ dùng không hợp lệ: ${input.status}`);
  }

  const willBeRental = input.isRental !== undefined ? input.isRental : existing.isRental;
  let returnDate: Date | null | undefined = undefined;

  if (input.returnDueDate !== undefined) {
    returnDate = input.returnDueDate ? new Date(input.returnDueDate) : null;
  }

  if (willBeRental) {
    const finalDueDate = returnDate !== undefined ? returnDate : existing.returnDueDate;
    if (!finalDueDate) {
      throw new RentalDueDateRequiredError();
    }
  }

  const currentMetadata = (existing.metadata as ItemMetadata) || {};
  const updatedMetadata: ItemMetadata = { ...currentMetadata };

  if (input.quantity !== undefined) {
    if (input.quantity <= 0) {
      throw new Error('Số lượng đồ dùng phải lớn hơn 0');
    }
    updatedMetadata.quantity = input.quantity;
  }
  if (input.keeper !== undefined) updatedMetadata.keeper = input.keeper;
  if (input.location !== undefined) updatedMetadata.location = input.location;
  if (input.bringTime !== undefined) updatedMetadata.bringTime = input.bringTime;
  if (input.notes !== undefined) updatedMetadata.notes = input.notes;

  return updatePreparationItemRecord(
    db,
    id,
    {
      title: input.title,
      category: input.category,
      status: input.status ?? existing.status,
      priority: input.priority,
      metadata: updatedMetadata as Record<string, unknown>,
      isRental: input.isRental,
      returnDueDate: returnDate !== undefined ? returnDate : undefined,
      isShared: input.isShared,
    },
    input.version
  );
}

export async function listPreparationItems(
  db: TxDb,
  eventId: string,
  role?: string
): Promise<Array<PreparationItemDto | PreparationItemFamilyDto>> {
  return listPreparationItemsByEvent(db, eventId, 'item', role);
}

export async function getPreparationItemDetails(
  db: TxDb,
  id: string,
  role?: string
): Promise<PreparationItemDto | PreparationItemFamilyDto> {
  const item = await getPreparationItemById(db, id);
  if (!item || item.type !== 'item') {
    throw new PreparationItemNotFoundError(id);
  }
  return mapToPreparationItemDto(item, role);
}

export async function deletePreparationItem(
  db: TxDb,
  id: string,
  version?: number
): Promise<{ success: true; id: string }> {
  const item = await getPreparationItemById(db, id);
  if (!item || item.type !== 'item') {
    throw new PreparationItemNotFoundError(id);
  }
  return deletePreparationItemRecord(db, id, version);
}

/**
 * Get rental return reminders for agenda and post-wedding checklist (PLAN §15).
 */
export async function getRentalReturnReminders(
  db: TxDb,
  eventId: string
): Promise<RentalReminderItem[]> {
  const rentals = await db
    .select()
    .from(preparationItems)
    .where(
      and(
        eq(preparationItems.eventId, eventId),
        eq(preparationItems.type, 'item'),
        eq(preparationItems.isRental, true)
      )
    )
    .orderBy(preparationItems.returnDueDate);

  const now = new Date();

  return rentals.map((r) => {
    const meta = (r.metadata as ItemMetadata) || {};
    const dueDate = r.returnDueDate ? new Date(r.returnDueDate) : now;
    const diffMs = dueDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isOverdue = r.status !== 'returned' && diffMs < 0;

    return {
      id: r.id,
      title: r.title,
      quantity: meta.quantity || 1,
      keeper: meta.keeper || null,
      status: r.status,
      returnDueDate: dueDate.toISOString(),
      isOverdue,
      daysRemaining,
    };
  });
}
