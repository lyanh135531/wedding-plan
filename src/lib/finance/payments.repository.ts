import { eq, and, sql, desc } from 'drizzle-orm';
import {
  payments,
  paymentAllocations,
  fundingEntries,
  costItems,
  paymentSchedules,
} from '@/db/schema/finance';
import { auditLogs } from '@/db/schema/system';
import {
  CreatePaymentInput,
  VoidPaymentInput,
} from '@/schemas/finance';
import { calculateRefundCeiling } from './calculator';
import { TxOrDb } from './costs.repository';

export class PaymentNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy giao dịch thanh toán') {
    super(message);
    this.name = 'PaymentNotFoundError';
  }
}

export class ParentPaymentNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy giao dịch chi gốc để hoàn tiền') {
    super(message);
    this.name = 'ParentPaymentNotFoundError';
  }
}

export class RefundExceedsCeilingError extends Error {
  readonly statusCode = 400;
  constructor(message = 'Số tiền hoàn vượt quá số tiền còn có thể hoàn của giao dịch gốc') {
    super(message);
    this.name = 'RefundExceedsCeilingError';
  }
}

export class AllocationSumMismatchError extends Error {
  readonly statusCode = 400;
  constructor(message = 'Tổng số tiền phân bổ cho các đợt không khớp với tổng số tiền giao dịch') {
    super(message);
    this.name = 'AllocationSumMismatchError';
  }
}

export class VoidDependentRefundsError extends Error {
  readonly statusCode = 400;
  constructor(message = 'Không thể hủy giao dịch chi gốc khi vẫn còn giao dịch hoàn tiền tham chiếu đến nó') {
    super(message);
    this.name = 'VoidDependentRefundsError';
  }
}

export interface ListPaymentsParams {
  costItemId?: string;
  paymentType?: 'outflow' | 'refund';
  includeVoided?: boolean;
  limit?: number;
  offset?: number;
}

export async function listPayments(txDb: TxOrDb, params: ListPaymentsParams = {}) {
  const { costItemId, paymentType, includeVoided = true, limit = 100, offset = 0 } = params;

  let query = txDb
    .select({
      id: payments.id,
      costItemId: payments.costItemId,
      costItemName: costItems.name,
      paymentType: payments.paymentType,
      amount: payments.amount,
      transactionTime: payments.transactionTime,
      paymentMethod: payments.paymentMethod,
      payerName: payments.payerName,
      recipientName: payments.recipientName,
      parentPaymentId: payments.parentPaymentId,
      isDirectThirdParty: payments.isDirectThirdParty,
      linkedFundingEntryId: payments.linkedFundingEntryId,
      notes: payments.notes,
      isVoided: payments.isVoided,
      voidedReason: payments.voidedReason,
      version: payments.version,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
    })
    .from(payments)
    .innerJoin(costItems, eq(payments.costItemId, costItems.id))
    .$dynamic();

  const conditions = [];

  if (costItemId) {
    conditions.push(eq(payments.costItemId, costItemId));
  }
  if (paymentType) {
    conditions.push(eq(payments.paymentType, paymentType));
  }
  if (!includeVoided) {
    conditions.push(eq(payments.isVoided, false));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return query
    .orderBy(desc(payments.transactionTime), desc(payments.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getPaymentById(txDb: TxOrDb, id: string) {
  const [payment] = await txDb
    .select({
      id: payments.id,
      costItemId: payments.costItemId,
      costItemName: costItems.name,
      paymentType: payments.paymentType,
      amount: payments.amount,
      transactionTime: payments.transactionTime,
      paymentMethod: payments.paymentMethod,
      payerName: payments.payerName,
      recipientName: payments.recipientName,
      parentPaymentId: payments.parentPaymentId,
      isDirectThirdParty: payments.isDirectThirdParty,
      linkedFundingEntryId: payments.linkedFundingEntryId,
      notes: payments.notes,
      isVoided: payments.isVoided,
      voidedReason: payments.voidedReason,
      version: payments.version,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
    })
    .from(payments)
    .innerJoin(costItems, eq(payments.costItemId, costItems.id))
    .where(eq(payments.id, id))
    .limit(1);

  if (!payment) return null;

  const allocations = await txDb
    .select()
    .from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, id));

  return {
    ...payment,
    allocations,
  };
}

/**
 * Creates an outflow or refund payment with strict financial invariants.
 *
 * Invariants:
 * - AT12: Allocations properly distributed across installment schedules.
 * - AT14: Refund ceiling strictly validated against parent payment.
 * - AT46: Unallocated amount recorded as advance payment (scheduleId = null).
 */
export async function createPayment(
  txDb: TxOrDb,
  input: CreatePaymentInput,
  userId: string
) {
  const amount = BigInt(input.amount);
  if (amount <= 0n) {
    throw new Error('Số tiền thanh toán phải lớn hơn 0');
  }

  // 1. Verify cost item exists
  const [costItem] = await txDb
    .select()
    .from(costItems)
    .where(eq(costItems.id, input.cost_item_id))
    .limit(1);

  if (!costItem) {
    throw new Error('Khoản chi không tồn tại');
  }

  // 2. If REFUND: check parent payment and validate refund ceiling (AT12, AT14)
  if (input.payment_type === 'refund') {
    if (!input.parent_payment_id) {
      throw new ParentPaymentNotFoundError('Giao dịch hoàn tiền bắt buộc phải có parent_payment_id');
    }

    const [parentPayment] = await txDb
      .select()
      .from(payments)
      .where(eq(payments.id, input.parent_payment_id))
      .limit(1).for('update');

    if (!parentPayment || parentPayment.costItemId !== input.cost_item_id) {
      throw new ParentPaymentNotFoundError('Không tìm thấy giao dịch chi gốc của khoản chi này');
    }

    // Fetch existing refunds referencing parentPayment
    const existingRefunds = await txDb
      .select({
        parentPaymentId: payments.parentPaymentId,
        amount: payments.amount,
        isVoided: payments.isVoided,
      })
      .from(payments)
      .where(
        and(
          eq(payments.parentPaymentId, input.parent_payment_id),
          eq(payments.paymentType, 'refund'),
          eq(payments.isVoided, false)
        )
      );

    const ceiling = calculateRefundCeiling(parentPayment, existingRefunds);
    if (!ceiling.isValid) {
      throw new RefundExceedsCeilingError(ceiling.errorMessage);
    }

    if (amount > ceiling.maxRefundable) {
      throw new RefundExceedsCeilingError(
        `Số tiền hoàn (${amount}) vượt quá số còn có thể hoàn của giao dịch gốc (${ceiling.maxRefundable})`
      );
    }
  }

  // 3. Insert payment record
  const transactionTime = input.transaction_time
    ? new Date(input.transaction_time)
    : new Date();

  const [paymentRecord] = await txDb
    .insert(payments)
    .values({
      costItemId: input.cost_item_id,
      paymentType: input.payment_type as any,
      amount,
      transactionTime,
      paymentMethod: input.payment_method as any,
      payerName: input.payer_name || null,
      recipientName: input.recipient_name || null,
      parentPaymentId: input.parent_payment_id || null,
      isDirectThirdParty: input.is_direct_third_party || false,
      notes: input.notes || null,
      isVoided: false,
      version: 1,
    })
    .returning();

  // 4. Create allocations
  const allocationsToInsert = [];
  if (input.schedule_allocations && input.schedule_allocations.length > 0) {
    let allocatedSum = 0n;
    for (const alloc of input.schedule_allocations) {
      const allocAmt = BigInt(alloc.amount);
      allocatedSum += allocAmt;
      allocationsToInsert.push({
        paymentId: paymentRecord.id,
        scheduleId: alloc.schedule_id || null,
        allocatedAmount: allocAmt,
      });
    }

    if (allocatedSum !== amount) {
      throw new AllocationSumMismatchError(
        `Tổng phân bổ (${allocatedSum}) không bằng tổng giao dịch (${amount})`
      );
    }
  } else {
    // AT46: Default to unallocated advance payment
    allocationsToInsert.push({
      paymentId: paymentRecord.id,
      scheduleId: null,
      allocatedAmount: amount,
    });
  }

  const insertedAllocations = await txDb
    .insert(paymentAllocations)
    .values(allocationsToInsert)
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'CREATE',
    entityType: 'payments',
    entityId: paymentRecord.id,
    afterState: { payment: paymentRecord, allocations: insertedAllocations },
  });

  return {
    ...paymentRecord,
    allocations: insertedAllocations,
  };
}

/**
 * Creates a direct third party vendor payment ("Người khác góp bằng cách trả hộ" - AT38).
 * Atomically creates a funding entry and linked payment in a single transaction.
 */
export async function createDirectThirdPartyPayment(
  txDb: TxOrDb,
  params: {
    costItemId: string;
    amount: bigint;
    contributorName: string;
    transactionTime?: Date;
    scheduleAllocations?: Array<{ schedule_id?: string | null; amount: string }>;
    notes?: string | null;
  },
  userId: string
) {
  const { costItemId, amount, contributorName, transactionTime = new Date(), scheduleAllocations, notes } = params;

  if (amount <= 0n) {
    throw new Error('Số tiền trả hộ phải lớn hơn 0');
  }

  // 1. Create funding entry of type 'direct_vendor_payment'
  const [fundingEntry] = await txDb
    .insert(fundingEntries)
    .values({
      entryType: 'direct_vendor_payment',
      amount,
      contributorName,
      contributionDate: transactionTime,
      linkedCostItemId: costItemId,
      notes: notes ? `Trả hộ: ${notes}` : 'Người thân trả hộ trực tiếp nhà cung cấp',
      isVoided: false,
      version: 1,
    })
    .returning();

  // 2. Create linked payment
  const [paymentRecord] = await txDb
    .insert(payments)
    .values({
      costItemId,
      paymentType: 'outflow',
      amount,
      transactionTime,
      paymentMethod: 'bank_transfer',
      payerName: contributorName,
      recipientName: 'Nhà cung cấp',
      isDirectThirdParty: true,
      linkedFundingEntryId: fundingEntry.id,
      notes: notes || 'Người thân trả hộ trực tiếp',
      isVoided: false,
      version: 1,
    })
    .returning();

  // 3. Link funding entry back to payment
  await txDb
    .update(fundingEntries)
    .set({ linkedPaymentId: paymentRecord.id })
    .where(eq(fundingEntries.id, fundingEntry.id));

  // 4. Create allocations
  const allocationsToInsert = [];
  if (scheduleAllocations && scheduleAllocations.length > 0) {
    let allocatedSum = 0n;
    for (const alloc of scheduleAllocations) {
      const allocAmt = BigInt(alloc.amount);
      allocatedSum += allocAmt;
      allocationsToInsert.push({
        paymentId: paymentRecord.id,
        scheduleId: alloc.schedule_id || null,
        allocatedAmount: allocAmt,
      });
    }

    if (allocatedSum !== amount) {
      throw new AllocationSumMismatchError();
    }
  } else {
    allocationsToInsert.push({
      paymentId: paymentRecord.id,
      scheduleId: null,
      allocatedAmount: amount,
    });
  }

  const insertedAllocations = await txDb
    .insert(paymentAllocations)
    .values(allocationsToInsert)
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'CREATE_DIRECT_THIRD_PARTY',
    entityType: 'payments',
    entityId: paymentRecord.id,
    afterState: { payment: paymentRecord, fundingEntry, allocations: insertedAllocations },
  });

  return {
    payment: paymentRecord,
    fundingEntry,
    allocations: insertedAllocations,
  };
}

/**
 * Voids a payment record with audit reason.
 *
 * Invariants (PLAN §9.3):
 * - Cannot void a parent payment if active refunds exist referencing it.
 * - If isDirectThirdParty, voids BOTH the payment and linked funding entry atomically.
 */
export async function voidPayment(
  txDb: TxOrDb,
  input: VoidPaymentInput,
  userId: string
) {
  const [existing] = await txDb
    .select()
    .from(payments)
    .where(eq(payments.id, input.payment_id))
    .limit(1).for('update');

  if (!existing) {
    throw new PaymentNotFoundError();
  }

  if (existing.isVoided) {
    return existing; // Idempotently already voided
  }

  // Check if active refunds exist referencing this payment
  const activeRefunds = await txDb
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.parentPaymentId, input.payment_id),
        eq(payments.paymentType, 'refund'),
        eq(payments.isVoided, false)
      )
    )
    .limit(1);

  if (activeRefunds.length > 0) {
    throw new VoidDependentRefundsError();
  }

  // Soft-void the payment
  const [voidedPayment] = await txDb
    .update(payments)
    .set({
      isVoided: true,
      voidedReason: input.voided_reason,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, input.payment_id))
    .returning();

  // If this was a direct third party payment, void the linked funding entry as well (PLAN §9.3)
  if (existing.isDirectThirdParty && existing.linkedFundingEntryId) {
    await txDb
      .update(fundingEntries)
      .set({
        isVoided: true,
        voidedReason: `Hủy cùng giao dịch chi liên kết: ${input.voided_reason}`,
        updatedAt: new Date(),
      })
      .where(eq(fundingEntries.id, existing.linkedFundingEntryId));
  }

  await txDb.insert(auditLogs).values({
    userId,
    action: 'VOID',
    entityType: 'payments',
    entityId: input.payment_id,
    beforeState: existing,
    afterState: voidedPayment,
  });

  return voidedPayment;
}
