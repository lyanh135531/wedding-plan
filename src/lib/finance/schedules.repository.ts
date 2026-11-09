import { eq, and, sql, asc } from 'drizzle-orm';
import { paymentSchedules, paymentAllocations, payments, costItems } from '@/db/schema/finance';
import { auditLogs } from '@/db/schema/system';
import { CreatePaymentScheduleInput } from '@/schemas/finance';
import { TxOrDb } from './costs.repository';

export class ScheduleNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy đợt thanh toán') {
    super(message);
    this.name = 'ScheduleNotFoundError';
  }
}

export class AllocationNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy phân bổ thanh toán') {
    super(message);
    this.name = 'AllocationNotFoundError';
  }
}

export class ReallocationAmountError extends Error {
  readonly statusCode = 400;
  constructor(message = 'Số tiền tái phân bổ không hợp lệ hoặc vượt quá khoản trả trước hiện có') {
    super(message);
    this.name = 'ReallocationAmountError';
  }
}

export async function listSchedulesByCostItem(txDb: TxOrDb, costItemId: string) {
  return txDb
    .select()
    .from(paymentSchedules)
    .where(eq(paymentSchedules.costItemId, costItemId))
    .orderBy(asc(paymentSchedules.installmentNumber));
}

export async function createPaymentSchedule(
  txDb: TxOrDb,
  input: CreatePaymentScheduleInput,
  userId: string
) {
  const amountDue = BigInt(input.amount_due);

  const [created] = await txDb
    .insert(paymentSchedules)
    .values({
      costItemId: input.cost_item_id,
      installmentNumber: input.installment_number,
      title: input.title,
      amountDue,
      dueDate: input.due_date,
      status: input.status as any,
      notes: input.notes || null,
      version: 1,
    })
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'CREATE',
    entityType: 'payment_schedules',
    entityId: created.id,
    afterState: created,
  });

  return created;
}

export async function updatePaymentSchedule(
  txDb: TxOrDb,
  id: string,
  input: Partial<CreatePaymentScheduleInput> & { version: number },
  userId: string
) {
  const [existing] = await txDb
    .select()
    .from(paymentSchedules)
    .where(eq(paymentSchedules.id, id))
    .limit(1);

  if (!existing) {
    throw new ScheduleNotFoundError();
  }

  const updateFields: any = {
    updatedAt: new Date(),
    version: existing.version + 1,
  };

  if (input.title) updateFields.title = input.title;
  if (input.amount_due) updateFields.amountDue = BigInt(input.amount_due);
  if (input.due_date) updateFields.dueDate = input.due_date;
  if (input.status) updateFields.status = input.status;
  if (input.notes !== undefined) updateFields.notes = input.notes;

  const [updated] = await txDb
    .update(paymentSchedules)
    .set(updateFields)
    .where(eq(paymentSchedules.id, id))
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'UPDATE',
    entityType: 'payment_schedules',
    entityId: id,
    beforeState: existing,
    afterState: updated,
  });

  return updated;
}

/**
 * Re-allocates advance payments to a newly created or existing payment schedule installment.
 *
 * CRITICAL INVARIANT (AT46):
 * When advance deposit was recorded before schedules were established,
 * reallocating it to the newly created schedule installment updates or splits
 * payment_allocations rows, strictly WITHOUT creating any duplicate payment records.
 */
export async function reallocateAdvancePayment(
  txDb: TxOrDb,
  params: {
    costItemId: string;
    allocationId: string;
    targetScheduleId: string;
    amountToReallocate: bigint;
  },
  userId: string
) {
  const { costItemId, allocationId, targetScheduleId, amountToReallocate } = params;

  if (amountToReallocate <= 0n) {
    throw new ReallocationAmountError('Số tiền tái phân bổ phải lớn hơn 0');
  }

  // 1. Fetch existing unallocated allocation (scheduleId is null)
  const [existingAlloc] = await txDb
    .select({
      id: paymentAllocations.id,
      paymentId: paymentAllocations.paymentId,
      scheduleId: paymentAllocations.scheduleId,
      allocatedAmount: paymentAllocations.allocatedAmount,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(
      and(
        eq(paymentAllocations.id, allocationId),
        eq(payments.costItemId, costItemId)
      )
    )
    .limit(1);

  if (!existingAlloc) {
    throw new AllocationNotFoundError('Không tìm thấy khoản phân bổ trả trước của khoản chi này');
  }

  if (amountToReallocate > existingAlloc.allocatedAmount) {
    throw new ReallocationAmountError(
      `Số tiền tái phân bổ (${amountToReallocate}) vượt quá số dư trả trước hiện có (${existingAlloc.allocatedAmount})`
    );
  }

  // 2. Fetch target schedule
  const [targetSchedule] = await txDb
    .select()
    .from(paymentSchedules)
    .where(
      and(
        eq(paymentSchedules.id, targetScheduleId),
        eq(paymentSchedules.costItemId, costItemId)
      )
    )
    .limit(1);

  if (!targetSchedule) {
    throw new ScheduleNotFoundError('Đợt thanh toán đích không thuộc khoản chi này');
  }

  // 3. Reallocate: if full amount, just update scheduleId. If partial, split the allocation.
  if (amountToReallocate === existingAlloc.allocatedAmount) {
    const [updated] = await txDb
      .update(paymentAllocations)
      .set({
        scheduleId: targetScheduleId,
        updatedAt: new Date(),
      })
      .where(eq(paymentAllocations.id, allocationId))
      .returning();

    await txDb.insert(auditLogs).values({
      userId,
      action: 'REALLOCATE_PAYMENT',
      entityType: 'payment_allocations',
      entityId: allocationId,
      beforeState: existingAlloc,
      afterState: updated,
    });

    return { allocated: updated, remainingAdvance: null };
  } else {
    // Partial reallocation: shrink existing advance allocation, insert new allocated row
    const remainingAmount = existingAlloc.allocatedAmount - amountToReallocate;

    const [shrunk] = await txDb
      .update(paymentAllocations)
      .set({
        allocatedAmount: remainingAmount,
        updatedAt: new Date(),
      })
      .where(eq(paymentAllocations.id, allocationId))
      .returning();

    const [newAlloc] = await txDb
      .insert(paymentAllocations)
      .values({
        paymentId: existingAlloc.paymentId,
        scheduleId: targetScheduleId,
        allocatedAmount: amountToReallocate,
      })
      .returning();

    await txDb.insert(auditLogs).values({
      userId,
      action: 'REALLOCATE_PAYMENT_SPLIT',
      entityType: 'payment_allocations',
      entityId: newAlloc.id,
      beforeState: existingAlloc,
      afterState: { shrunk, newAlloc },
    });

    return { allocated: newAlloc, remainingAdvance: shrunk };
  }
}
