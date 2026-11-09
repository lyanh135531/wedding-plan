import { eq, and, sql, desc, asc, ilike } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  costItems,
  paymentSchedules,
  payments,
  paymentAllocations,
  budgetCategories,
} from '@/db/schema/finance';
import { auditLogs } from '@/db/schema/system';
import {
  CreateCostItemInput,
  UpdateCostItemInput,
  CostStatus,
} from '@/schemas/finance';
import { calculateCostItemMetrics, calculateInstallmentStatus } from './calculator';
import { CostItemFinancialMetrics } from './types';

export type TxOrDb = typeof db | any;

export class VersionConflictError extends Error {
  readonly statusCode = 409;
  constructor(message = 'Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại') {
    super(message);
    this.name = 'VersionConflictError';
  }
}

export class CostItemNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy khoản chi') {
    super(message);
    this.name = 'CostItemNotFoundError';
  }
}

export class CostItemHasPaymentsError extends Error {
  readonly statusCode = 400;
  constructor(message = 'Không thể xóa khoản chi đã phát sinh giao dịch thanh toán') {
    super(message);
    this.name = 'CostItemHasPaymentsError';
  }
}

function parseBigIntOrNull(val: string | null | undefined): bigint | null {
  if (val === null || val === undefined || val === '') return null;
  return BigInt(val);
}

export interface ListCostItemsParams {
  categoryId?: string;
  eventId?: string;
  status?: CostStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listCostItems(txDb: TxOrDb, params: ListCostItemsParams = {}) {
  const { categoryId, eventId, status, search, limit = 100, offset = 0 } = params;

  let query = txDb
    .select({
      id: costItems.id,
      name: costItems.name,
      categoryId: costItems.categoryId,
      categoryName: budgetCategories.name,
      eventId: costItems.eventId,
      vendorName: costItems.vendorName,
      vendorPhone: costItems.vendorPhone,
      vendorContact: costItems.vendorContact,
      estimatedAmount: costItems.estimatedAmount,
      contractedAmount: costItems.contractedAmount,
      finalSettlementAmount: costItems.finalSettlementAmount,
      status: costItems.status,
      inChargeUserId: costItems.inChargeUserId,
      cancellationFee: costItems.cancellationFee,
      cancellationNotes: costItems.cancellationNotes,
      notes: costItems.notes,
      version: costItems.version,
      createdAt: costItems.createdAt,
      updatedAt: costItems.updatedAt,
    })
    .from(costItems)
    .innerJoin(budgetCategories, eq(costItems.categoryId, budgetCategories.id))
    .$dynamic();

  const conditions = [];

  if (categoryId) {
    conditions.push(eq(costItems.categoryId, categoryId));
  }
  if (eventId) {
    conditions.push(eq(costItems.eventId, eventId));
  }
  if (status) {
    conditions.push(eq(costItems.status, status as any));
  }
  if (search && search.trim() !== '') {
    const clean = search.trim();
    conditions.push(
      sql`public.immutable_unaccent(${costItems.name}) ILIKE public.immutable_unaccent(${'%' + clean + '%'}) OR public.immutable_unaccent(COALESCE(${costItems.vendorName}, '')) ILIKE public.immutable_unaccent(${'%' + clean + '%'})`
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const items = await query
    .orderBy(asc(budgetCategories.defaultOrder), desc(costItems.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch payments for each item to compute metrics
  const itemIds = items.map((i: any) => i.id);
  const paymentRecords = itemIds.length > 0
    ? await txDb
        .select({
          costItemId: payments.costItemId,
          paymentType: payments.paymentType,
          amount: payments.amount,
          isVoided: payments.isVoided,
        })
        .from(payments)
        .where(sql`${payments.costItemId} IN ${itemIds}`)
    : [];

  const paymentsByItem = new Map<string, Array<{ paymentType: 'outflow' | 'refund'; amount: bigint; isVoided: boolean }>>();
  for (const p of paymentRecords) {
    if (!paymentsByItem.has(p.costItemId)) {
      paymentsByItem.set(p.costItemId, []);
    }
    paymentsByItem.get(p.costItemId)!.push({
      paymentType: p.paymentType as 'outflow' | 'refund',
      amount: p.amount,
      isVoided: p.isVoided,
    });
  }

  return items.map((item: any) => {
    const itemPayments = paymentsByItem.get(item.id) || [];
    const metrics = calculateCostItemMetrics(item, itemPayments);
    return {
      ...item,
      metrics,
    };
  });
}

export async function getCostItemById(txDb: TxOrDb, id: string) {
  const [item] = await txDb
    .select({
      id: costItems.id,
      name: costItems.name,
      categoryId: costItems.categoryId,
      categoryName: budgetCategories.name,
      eventId: costItems.eventId,
      vendorName: costItems.vendorName,
      vendorPhone: costItems.vendorPhone,
      vendorContact: costItems.vendorContact,
      estimatedAmount: costItems.estimatedAmount,
      contractedAmount: costItems.contractedAmount,
      finalSettlementAmount: costItems.finalSettlementAmount,
      status: costItems.status,
      inChargeUserId: costItems.inChargeUserId,
      cancellationFee: costItems.cancellationFee,
      cancellationNotes: costItems.cancellationNotes,
      notes: costItems.notes,
      version: costItems.version,
      createdAt: costItems.createdAt,
      updatedAt: costItems.updatedAt,
    })
    .from(costItems)
    .innerJoin(budgetCategories, eq(costItems.categoryId, budgetCategories.id))
    .where(eq(costItems.id, id))
    .limit(1);

  if (!item) return null;

  // Schedules
  const schedules = await txDb
    .select()
    .from(paymentSchedules)
    .where(eq(paymentSchedules.costItemId, id))
    .orderBy(asc(paymentSchedules.installmentNumber));

  // Payments
  const paymentList = await txDb
    .select()
    .from(payments)
    .where(eq(payments.costItemId, id))
    .orderBy(desc(payments.transactionTime));

  // Allocations for this cost item's payments
  const paymentIds = paymentList.map((p: any) => p.id);
  const allocations = paymentIds.length > 0
    ? await txDb
        .select()
        .from(paymentAllocations)
        .where(sql`${paymentAllocations.paymentId} IN ${paymentIds}`)
    : [];

  const metrics = calculateCostItemMetrics(item, paymentList);

  const scheduleStatuses = schedules.map((s: any) => {
    const itemAllocations = allocations.map((a: any) => {
      const p = paymentList.find((pay: any) => pay.id === a.paymentId);
      return {
        scheduleId: a.scheduleId,
        allocatedAmount: a.allocatedAmount,
        isPaymentVoided: p ? p.isVoided : false,
      };
    });
    return calculateInstallmentStatus(s, itemAllocations);
  });

  return {
    ...item,
    metrics,
    schedules: scheduleStatuses,
    payments: paymentList,
  };
}

export async function createCostItem(
  txDb: TxOrDb,
  input: CreateCostItemInput,
  userId: string
) {
  const estimatedAmount = parseBigIntOrNull(input.estimated_amount);
  const contractedAmount = parseBigIntOrNull(input.contracted_amount);
  const finalSettlementAmount = parseBigIntOrNull(input.final_settlement_amount);
  const cancellationFee = parseBigIntOrNull(input.cancellation_fee);

  const [created] = await txDb
    .insert(costItems)
    .values({
      name: input.name,
      categoryId: input.category_id,
      eventId: input.event_id || null,
      vendorName: input.vendor_name || null,
      vendorPhone: input.vendor_phone || null,
      vendorContact: input.vendor_contact || null,
      estimatedAmount,
      contractedAmount,
      finalSettlementAmount,
      status: input.status as any,
      inChargeUserId: input.in_charge_user_id || null,
      cancellationFee,
      cancellationNotes: input.cancellation_notes || null,
      notes: input.notes || null,
      version: 1,
    })
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'CREATE',
    entityType: 'cost_items',
    entityId: created.id,
    afterState: created,
  });

  return created;
}

export async function updateCostItem(
  txDb: TxOrDb,
  id: string,
  input: UpdateCostItemInput,
  userId: string
) {
  const [existing] = await txDb
    .select()
    .from(costItems)
    .where(eq(costItems.id, id))
    .limit(1);

  if (!existing) {
    throw new CostItemNotFoundError();
  }

  // Optimistic locking
  if (existing.version !== input.version) {
    throw new VersionConflictError();
  }

  const estimatedAmount = parseBigIntOrNull(input.estimated_amount);
  const contractedAmount = parseBigIntOrNull(input.contracted_amount);
  const finalSettlementAmount = parseBigIntOrNull(input.final_settlement_amount);
  const cancellationFee = parseBigIntOrNull(input.cancellation_fee);

  // AT16: Check if contracted price changed after deposits
  const contractedPriceChanged =
    existing.contractedAmount !== null &&
    contractedAmount !== null &&
    existing.contractedAmount !== contractedAmount;

  const [updated] = await txDb
    .update(costItems)
    .set({
      name: input.name,
      categoryId: input.category_id,
      eventId: input.event_id || null,
      vendorName: input.vendor_name || null,
      vendorPhone: input.vendor_phone || null,
      vendorContact: input.vendor_contact || null,
      estimatedAmount,
      contractedAmount,
      finalSettlementAmount,
      status: input.status as any,
      inChargeUserId: input.in_charge_user_id || null,
      cancellationFee,
      cancellationNotes: input.cancellation_notes || null,
      notes: input.notes || null,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(costItems.id, id), eq(costItems.version, input.version)))
    .returning();

  if (!updated) {
    throw new VersionConflictError();
  }

  await txDb.insert(auditLogs).values({
    userId,
    action: 'UPDATE',
    entityType: 'cost_items',
    entityId: id,
    beforeState: existing,
    afterState: updated,
  });

  return {
    ...updated,
    contractedPriceChanged,
  };
}

/**
 * Service Cancellation Flow (AT47, AT48)
 * Sets status to 'cancelled', penalty fee becomes final_settlement_amount.
 * Cancels remaining unpaid payment schedules.
 */
export async function cancelCostItem(
  txDb: TxOrDb,
  id: string,
  params: {
    cancellationFee: bigint; // 0n is valid (AT48)
    cancellationNotes?: string | null;
    version: number;
  },
  userId: string
) {
  const [existing] = await txDb
    .select()
    .from(costItems)
    .where(eq(costItems.id, id))
    .limit(1);

  if (!existing) {
    throw new CostItemNotFoundError();
  }

  if (existing.version !== params.version) {
    throw new VersionConflictError();
  }

  // AT47: In cancellation, penalty fee becomes the final settlement liability
  const [cancelled] = await txDb
    .update(costItems)
    .set({
      status: 'cancelled',
      cancellationFee: params.cancellationFee,
      finalSettlementAmount: params.cancellationFee,
      cancellationNotes: params.cancellationNotes || null,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(costItems.id, id), eq(costItems.version, params.version)))
    .returning();

  // Cancel any remaining schedules that are not completed
  await txDb
    .update(paymentSchedules)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentSchedules.costItemId, id),
        sql`${paymentSchedules.status} != 'cancelled'`
      )
    );

  await txDb.insert(auditLogs).values({
    userId,
    action: 'CANCEL',
    entityType: 'cost_items',
    entityId: id,
    beforeState: existing,
    afterState: cancelled,
  });

  return cancelled;
}

export async function deleteCostItem(txDb: TxOrDb, id: string, userId: string) {
  const [existing] = await txDb
    .select()
    .from(costItems)
    .where(eq(costItems.id, id))
    .limit(1);

  if (!existing) {
    throw new CostItemNotFoundError();
  }

  // Check if non-voided payments exist
  const existingPayments = await txDb
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.costItemId, id), eq(payments.isVoided, false)))
    .limit(1);

  if (existingPayments.length > 0) {
    throw new CostItemHasPaymentsError();
  }

  await txDb.delete(costItems).where(eq(costItems.id, id));

  await txDb.insert(auditLogs).values({
    userId,
    action: 'DELETE',
    entityType: 'cost_items',
    entityId: id,
    beforeState: existing,
  });

  return { success: true };
}
