import { eq, and, sql, desc } from 'drizzle-orm';
import {
  fundSettings,
  fundingEntries,
  payments,
  costItems,
  budgetCategories,
  categoryBudgets,
} from '@/db/schema/finance';
import { auditLogs } from '@/db/schema/system';
import { gifts, giftReturns } from '@/db/schema/gifts';
import { weddingSettings } from '@/db/schema/events';
import {
  UpdateFundSettingsInput,
  CreateFundingEntryInput,
} from '@/schemas/finance';
import {
  calculateCashLedger,
  calculateCostItemMetrics,
  calculateOverallBudgetSummary,
} from './calculator';
import { TxOrDb } from './costs.repository';

export class FundSettingsNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Chưa thiết lập quỹ') {
    super(message);
    this.name = 'FundSettingsNotFoundError';
  }
}

export class FundingEntryNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy nguồn tiền đóng góp') {
    super(message);
    this.name = 'FundingEntryNotFoundError';
  }
}

export class FundVersionConflictError extends Error {
  readonly statusCode = 409;
  constructor() { super('Sổ quỹ đã thay đổi. Vui lòng tải lại trước khi lưu.'); }
}

/**
 * Gets the current wedding fund settings (opening_as_of anchor & initial balance).
 * Returns null if not yet configured (AT37).
 */
export async function getFundSettings(txDb: TxOrDb) {
  const [settings] = await txDb
    .select()
    .from(fundSettings)
    .limit(1);

  return settings || null;
}

/**
 * Updates or establishes the fund anchor cutoff and initial verified balance.
 *
 * Invariants:
 * - AT37: Initial balance of 0n with fundScopeConfirmed = true is recognized as a confirmed 0 VND fund,
 *   strictly distinguished from unconfigured fund (fundScopeConfirmed = false or record missing).
 * - AT45: Changing opening_as_of shifts which historical payments are excluded from available cash.
 */
export async function updateFundSettings(
  txDb: TxOrDb,
  input: UpdateFundSettingsInput,
  userId: string
) {
  const [existing] = await txDb
    .select()
    .from(fundSettings)
    .limit(1);

  const initialBalance = BigInt(input.initial_balance);
  const openingAsOf = input.opening_as_of ? new Date(input.opening_as_of) : null;

  if (existing) {
    if (existing.version !== input.version) throw new FundVersionConflictError();
    const [updated] = await txDb
      .update(fundSettings)
      .set({
        openingAsOf,
        initialBalance,
        fundScopeConfirmed: input.fund_scope_confirmed,
        confirmedBy: userId,
        notes: input.notes || null,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(fundSettings.id, existing.id), eq(fundSettings.version, input.version)))
      .returning();

    if (!updated) throw new FundVersionConflictError();

    await txDb.insert(auditLogs).values({
      userId,
      action: 'UPDATE_FUND_SETTINGS',
      entityType: 'fund_settings',
      entityId: existing.id,
      beforeState: existing,
      afterState: updated,
    });

    return updated;
  } else {
    const [created] = await txDb
      .insert(fundSettings)
      .values({
        openingAsOf,
        initialBalance,
        fundScopeConfirmed: input.fund_scope_confirmed,
        confirmedBy: userId,
        notes: input.notes || null,
        version: 1,
      })
      .returning();

    await txDb.insert(auditLogs).values({
      userId,
      action: 'CREATE_FUND_SETTINGS',
      entityType: 'fund_settings',
      entityId: created.id,
      afterState: created,
    });

    return created;
  }
}

export async function listFundingEntries(txDb: TxOrDb, includeVoided = true) {
  let query = txDb
    .select()
    .from(fundingEntries)
    .$dynamic();

  if (!includeVoided) {
    query = query.where(eq(fundingEntries.isVoided, false));
  }

  return query.orderBy(desc(fundingEntries.contributionDate));
}

export async function createFundingEntry(
  txDb: TxOrDb,
  input: CreateFundingEntryInput,
  userId: string
) {
  const amount = BigInt(input.amount);
  if (amount <= 0n) {
    throw new Error('Số tiền phải lớn hơn 0');
  }

  const contributionDate = input.contribution_date
    ? new Date(input.contribution_date)
    : new Date();

  const [created] = await txDb
    .insert(fundingEntries)
    .values({
      entryType: input.entry_type as any,
      amount,
      contributorName: input.contributor_name || null,
      contributionDate,
      linkedCostItemId: input.linked_cost_item_id || null,
      notes: input.notes || null,
      isVoided: false,
      version: 1,
    })
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'CREATE',
    entityType: 'funding_entries',
    entityId: created.id,
    afterState: created,
  });

  return created;
}

export async function voidFundingEntry(
  txDb: TxOrDb,
  id: string,
  voidReason: string,
  userId: string
) {
  let [existing] = await txDb
    .select()
    .from(fundingEntries)
    .where(eq(fundingEntries.id, id))
    .limit(1);

  if (!existing) {
    throw new FundingEntryNotFoundError();
  }

  if (existing.isVoided) {
    return existing;
  }

  if (existing.linkedPaymentId) {
    const { voidPayment } = await import('./payments.repository');
    const [linked] = await txDb.select().from(payments).where(eq(payments.id, existing.linkedPaymentId));
    if (!linked) throw new FundingEntryNotFoundError('Không tìm thấy giao dịch trả hộ liên kết.');
    await voidPayment(txDb, { payment_id: linked.id, voided_reason: voidReason, version: linked.version }, userId);
    return (await txDb.select().from(fundingEntries).where(eq(fundingEntries.id,id)))[0];
  }
  [existing] = await txDb.select().from(fundingEntries).where(eq(fundingEntries.id,id)).for('update');
  if (existing.isVoided) return existing;
  const [voided] = await txDb
    .update(fundingEntries)
    .set({
      isVoided: true,
      voidedReason: voidReason,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(fundingEntries.id, id))
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'VOID',
    entityType: 'funding_entries',
    entityId: id,
    beforeState: existing,
    afterState: voided,
  });

  return voided;
}

/**
 * Aggregates complete wedding financial overview:
 * Budget categories, overall budget summary, cash fund ledger.
 */
export async function getFinanceOverview(txDb: TxOrDb) {
  // 1. Fetch budget categories with allocated budgets
  const categories = await txDb
    .select({
      id: budgetCategories.id,
      name: budgetCategories.name,
      defaultOrder: budgetCategories.defaultOrder,
      allocatedAmount: categoryBudgets.allocatedAmount,
    })
    .from(budgetCategories)
    .leftJoin(categoryBudgets, eq(budgetCategories.id, categoryBudgets.categoryId))
    .orderBy(budgetCategories.defaultOrder);

  let targetBudget = 0n;
  for (const c of categories) {
    if (c.allocatedAmount) {
      targetBudget += c.allocatedAmount;
    }
  }

  // 2. Fetch all cost items
  const allCostItems = await txDb
    .select()
    .from(costItems);

  // 3. Fetch all payments
  const allPayments = await txDb
    .select()
    .from(payments);

  // Map payments by cost item
  const paymentsByItem = new Map<string, Array<{ paymentType: 'outflow' | 'refund'; amount: bigint; isVoided: boolean }>>();
  for (const p of allPayments) {
    if (!paymentsByItem.has(p.costItemId)) {
      paymentsByItem.set(p.costItemId, []);
    }
    paymentsByItem.get(p.costItemId)!.push({
      paymentType: p.paymentType as 'outflow' | 'refund',
      amount: p.amount,
      isVoided: p.isVoided,
    });
  }

  const itemsWithMetrics = allCostItems.map((item: any) => {
    const itemPayments = paymentsByItem.get(item.id) || [];
    const metrics = calculateCostItemMetrics(item, itemPayments);
    return { item, metrics };
  });

  // Calculate overall budget summary (AT15, AT17, AT53)
  const [wedding] = await txDb.select().from(weddingSettings).limit(1);
  const budgetSummary = calculateOverallBudgetSummary(wedding?.budgetTarget ?? (targetBudget > 0n ? targetBudget : null), itemsWithMetrics);

  // 4. Fetch fund settings & funding entries for cash fund ledger (AT37, AT38, AT45)
  const [settings] = await txDb
    .select()
    .from(fundSettings)
    .limit(1);

  const allFundingEntries = await txDb
    .select()
    .from(fundingEntries);

  const baseLedger = calculateCashLedger(settings || null, allPayments, allFundingEntries);
  const giftRows = await txDb.select().from(gifts);
  const returns = await txDb.select().from(giftReturns);
  const activeGifts = new Set(giftRows.filter((g: typeof gifts.$inferSelect) => !g.isVoided && g.giftType === 'cash').map((g: typeof gifts.$inferSelect) => g.id));
  const openingEpoch = settings?.openingAsOf ? new Date(settings.openingAsOf).getTime() : 0;
  const postOpeningGiftReceipts = giftRows.filter((g: typeof gifts.$inferSelect) => activeGifts.has(g.id) && new Date(g.receivedAt || g.createdAt).getTime() >= openingEpoch).reduce((sum: bigint,g: typeof gifts.$inferSelect) => sum + BigInt(g.amount || 0), 0n);
  const postOpeningGiftReturns = returns.filter((r: typeof giftReturns.$inferSelect) => activeGifts.has(r.giftId) && new Date(r.returnedAt).getTime() >= openingEpoch).reduce((sum: bigint,r: typeof giftReturns.$inferSelect) => sum + BigInt(r.amount),0n);
  const cashLedger = { ...baseLedger, postOpeningGiftReceipts, postOpeningGiftReturns, availableCash: baseLedger.availableCash === null ? null : baseLedger.availableCash + postOpeningGiftReceipts - postOpeningGiftReturns };

  return {
    categories,
    budgetSummary,
    cashLedger,
    totalItemsCount: allCostItems.length,
    recentPaymentsCount: allPayments.length,
  };
}
