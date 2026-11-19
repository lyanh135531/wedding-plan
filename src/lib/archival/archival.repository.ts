import { eq } from 'drizzle-orm';
import { weddingSettings } from '@/db/schema/events';
import { auditLogs } from '@/db/schema/system';
import { postWeddingTasks } from '@/db/schema/handovers';
import { costItems, payments } from '@/db/schema/finance';
import { calculateCostItemMetrics } from '@/lib/finance/calculator';
import { preparationItems } from '@/db/schema/preparation';
import { gifts } from '@/db/schema/gifts';
import { TxDb } from './types';

export async function getWeddingSettings(db: TxDb): Promise<any | null> {
  const [settings] = await db
    .select()
    .from(weddingSettings)
    .limit(1);

  return settings || null;
}

export async function updateWeddingArchivalStatus(
  db: TxDb,
  settingsId: string,
  data: {
    isArchived: boolean;
    archivedAt?: Date | null;
    archivedByUserId?: string | null;
    archivedReason?: string | null;
    reopenedAt?: Date | null;
    reopenedByUserId?: string | null;
  }
): Promise<any> {
  const [updated] = await db
    .update(weddingSettings)
    .set({
      isArchived: data.isArchived,
      archivedAt: data.archivedAt,
      archivedByUserId: data.archivedByUserId,
      archivedReason: data.archivedReason,
      reopenedAt: data.reopenedAt,
      reopenedByUserId: data.reopenedByUserId,
      updatedAt: new Date(),
    })
    .where(eq(weddingSettings.id, settingsId))
    .returning();

  return updated;
}

export async function recordAuditLog(
  db: TxDb,
  values: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    beforeState?: any;
    afterState?: any;
  }
): Promise<void> {
  await db.insert(auditLogs).values({
    userId: values.userId,
    action: values.action,
    entityType: values.entityType,
    entityId: values.entityId,
    beforeState: values.beforeState ?? null,
    afterState: values.afterState ?? null,
  });
}

export async function getOutstandingCostItems(db: TxDb, eventId?: string): Promise<any[]> {
  const allCosts = await db.select().from(costItems);
  const transactions = await db.select().from(payments);
  return allCosts.filter((c: any) => {
    if (eventId && c.eventId !== eventId) return false;
    const metrics = calculateCostItemMetrics({ estimatedAmount: c.estimatedAmount == null ? null : BigInt(c.estimatedAmount), contractedAmount: c.contractedAmount == null ? null : BigInt(c.contractedAmount), finalSettlementAmount: c.finalSettlementAmount == null ? null : BigInt(c.finalSettlementAmount) }, transactions.filter((p:any)=>p.costItemId===c.id));
    return metrics.isPriceMissing || (metrics.projectedRemaining !== null && metrics.projectedRemaining > 0n);
  });
}

export async function getPendingDepositRefunds(db: TxDb, eventId?: string): Promise<any[]> {
  const allCosts = await db.select().from(costItems);
  const transactions = await db.select().from(payments);
  return allCosts.filter((c: any) => {
    if (eventId && c.eventId !== eventId) return false;
    const net = transactions.filter((p:any)=>p.costItemId===c.id&&!p.isVoided).reduce((sum:bigint,p:any)=>sum+(p.paymentType==='refund'?-1n:1n)*BigInt(p.amount),0n);
    const settled = c.finalSettlementAmount ?? c.contractedAmount;
    return c.status === 'cancelling' || (settled != null && net > BigInt(settled));
  });
}

export async function getUnreturnedRentals(db: TxDb, eventId?: string): Promise<any[]> {
  const allPreps = await db.select().from(preparationItems);
  return allPreps.filter((p: any) => p.isRental && p.status !== 'returned' && p.status !== 'completed');
}

export async function getPendingMediaItems(db: TxDb, eventId?: string): Promise<any[]> {
  const allPreps = await db.select().from(preparationItems);
  return allPreps.filter((p: any) => p.type === 'photo' && p.status !== 'completed');
}

export async function getUnthankedGifts(db: TxDb, eventId?: string): Promise<any[]> {
  const allGifts = await db.select().from(gifts);
  return allGifts.filter((g: any) => !g.isVoided && !g.isThanked);
}

export async function getUnreconciledGifts(db: TxDb, eventId?: string): Promise<any[]> {
  const allGifts = await db.select().from(gifts);
  return allGifts.filter((g: any) => !g.isVoided && (!g.isSenderIdentified || g.reconciliationStatus === 'needs_reconciliation'));
}

export async function getPostWeddingTasks(db: TxDb, weddingId?: string): Promise<any[]> {
  return db.select().from(postWeddingTasks);
}

export async function upsertPostWeddingTask(
  db: TxDb,
  taskKey: string,
  title: string,
  isCompleted: boolean,
  notes?: string | null,
  userId?: string | null
): Promise<any> {
  const existing = await db
    .select()
    .from(postWeddingTasks)
    .where(eq(postWeddingTasks.taskKey, taskKey));

  if (existing.length > 0) {
    const [updated] = await db
      .update(postWeddingTasks)
      .set({
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        completedByUserId: isCompleted ? (userId ?? null) : null,
        notes: notes !== undefined ? notes : existing[0].notes,
        updatedAt: new Date(),
      })
      .where(eq(postWeddingTasks.taskKey, taskKey))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(postWeddingTasks)
      .values({
        taskKey,
        title,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        completedByUserId: isCompleted ? (userId ?? null) : null,
        notes: notes ?? null,
      })
      .returning();
    return created;
  }
}
