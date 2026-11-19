import { eq, and, desc } from 'drizzle-orm';
import { gifts, giftContributors, giftReturns } from '@/db/schema/gifts';
import { GiftDto, GiftSummaryDto } from '@/schemas/gifts';
import { TxDb } from './types';
import { GiftNotFoundError, OptimisticLockError } from './errors';

export function mapToGiftDto(rawGift: any, contributors: any[] = [], returns: any[] = []): GiftDto {
  let netAmount = 0n;
  if (rawGift.giftType === 'cash' && rawGift.amount !== null && rawGift.amount !== undefined) {
    const rawAmt = typeof rawGift.amount === 'bigint' ? rawGift.amount : BigInt(rawGift.amount);
    let totalReturns = 0n;
    for (const r of returns) {
      const rAmt = typeof r.amount === 'bigint' ? r.amount : BigInt(r.amount);
      totalReturns += rAmt;
    }
    netAmount = rawAmt > totalReturns ? rawAmt - totalReturns : 0n;
  }

  return {
    id: rawGift.id,
    eventId: rawGift.eventId,
    giftType: rawGift.giftType,
    receivedAt: new Date(rawGift.receivedAt || rawGift.createdAt).toISOString(),
    amount: rawGift.amount !== null && rawGift.amount !== undefined ? rawGift.amount.toString() : null,
    description: rawGift.description ?? null,
    receivedByUserId: rawGift.receivedByUserId ?? null,
    receivedByProxy: rawGift.receivedByProxy ?? null,
    envelopeCode: rawGift.envelopeCode ?? null,
    isSenderIdentified: Boolean(rawGift.isSenderIdentified),
    unidentifiedNotes: rawGift.unidentifiedNotes ?? null,
    reconciliationStatus: rawGift.reconciliationStatus,
    isThanked: Boolean(rawGift.isThanked),
    thankedAt: rawGift.thankedAt ? new Date(rawGift.thankedAt).toISOString() : null,
    thankedByUserId: rawGift.thankedByUserId ?? null,
    thankYouChannel: rawGift.thankYouChannel ?? null,
    thankYouNotes: rawGift.thankYouNotes ?? null,
    isVoided: Boolean(rawGift.isVoided),
    voidedReason: rawGift.voidedReason ?? null,
    voidedAt: rawGift.voidedAt ? new Date(rawGift.voidedAt).toISOString() : null,
    voidedByUserId: rawGift.voidedByUserId ?? null,
    notes: rawGift.notes ?? null,
    version: rawGift.version,
    createdAt: new Date(rawGift.createdAt).toISOString(),
    updatedAt: new Date(rawGift.updatedAt).toISOString(),
    contributors: contributors.map((c) => ({
      id: c.id,
      giftId: c.giftId,
      guestId: c.guestId ?? null,
      contributorName: c.contributorName,
      relationship: c.relationship ?? null,
      createdAt: new Date(c.createdAt).toISOString(),
    })),
    returns: returns.map((r) => ({
      id: r.id,
      giftId: r.giftId,
      amount: r.amount.toString(),
      returnReason: r.returnReason,
      returnedAt: r.returnedAt ? new Date(r.returnedAt).toISOString() : new Date().toISOString(),
      handledByUserId: r.handledByUserId ?? null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    })),
    netAmount: netAmount.toString(),
  };
}

export async function createGiftRecord(
  db: TxDb,
  giftValues: {
    eventId: string;
    giftType: 'cash' | 'physical';
    amount?: bigint | null;
    receivedAt?: Date;
    description?: string | null;
    receivedByUserId?: string | null;
    receivedByProxy?: string | null;
    envelopeCode?: string | null;
    isSenderIdentified?: boolean;
    unidentifiedNotes?: string | null;
    reconciliationStatus?: 'reconciled' | 'needs_reconciliation';
    notes?: string | null;
  },
  contributors: Array<{
    guestId?: string | null;
    contributorName: string;
    relationship?: string | null;
  }> = []
): Promise<GiftDto> {
  const [created] = await db
    .insert(gifts)
    .values({
      eventId: giftValues.eventId,
      giftType: giftValues.giftType,
      amount: giftValues.amount ?? null,
      receivedAt: giftValues.receivedAt,
      description: giftValues.description ?? null,
      receivedByUserId: giftValues.receivedByUserId ?? null,
      receivedByProxy: giftValues.receivedByProxy ?? null,
      envelopeCode: giftValues.envelopeCode ?? null,
      isSenderIdentified: giftValues.isSenderIdentified ?? true,
      unidentifiedNotes: giftValues.unidentifiedNotes ?? null,
      reconciliationStatus: giftValues.reconciliationStatus ?? 'reconciled',
      notes: giftValues.notes ?? null,
      version: 1,
    })
    .returning();

  const createdContributors: any[] = [];
  for (const c of contributors) {
    const [contrib] = await db
      .insert(giftContributors)
      .values({
        giftId: created.id,
        guestId: c.guestId ?? null,
        contributorName: c.contributorName,
        relationship: c.relationship ?? null,
      })
      .returning();
    createdContributors.push(contrib);
  }

  return mapToGiftDto(created, createdContributors, []);
}

export async function getGiftById(db: TxDb, id: string): Promise<any | null> {
  const [gift] = await db
    .select()
    .from(gifts)
    .where(eq(gifts.id, id))
    .limit(1).for('update');

  return gift || null;
}

export async function getGiftWithDetails(db: TxDb, id: string): Promise<GiftDto | null> {
  const gift = await getGiftById(db, id);
  if (!gift) return null;

  const contribs = await db
    .select()
    .from(giftContributors)
    .where(eq(giftContributors.giftId, id));

  const rets = await db
    .select()
    .from(giftReturns)
    .where(eq(giftReturns.giftId, id));

  return mapToGiftDto(gift, contribs, rets);
}

export async function listGiftsByEvent(
  db: TxDb,
  eventId: string,
  filter?: {
    giftType?: 'cash' | 'physical';
    isThanked?: boolean;
    isSenderIdentified?: boolean;
    isVoided?: boolean;
  }
): Promise<GiftDto[]> {
  const allGifts = await db
    .select()
    .from(gifts)
    .where(eq(gifts.eventId, eventId))
    .orderBy(desc(gifts.createdAt));

  const allContribs = await db
    .select()
    .from(giftContributors);

  const allReturns = await db
    .select()
    .from(giftReturns);

  const contribMap = new Map<string, any[]>();
  for (const c of allContribs) {
    const list = contribMap.get(c.giftId) || [];
    list.push(c);
    contribMap.set(c.giftId, list);
  }

  const returnMap = new Map<string, any[]>();
  for (const r of allReturns) {
    const list = returnMap.get(r.giftId) || [];
    list.push(r);
    returnMap.set(r.giftId, list);
  }

  let filtered = allGifts;
  if (filter) {
    if (filter.giftType !== undefined) {
      filtered = filtered.filter((g: any) => g.giftType === filter.giftType);
    }
    if (filter.isThanked !== undefined) {
      filtered = filtered.filter((g: any) => g.isThanked === filter.isThanked);
    }
    if (filter.isSenderIdentified !== undefined) {
      filtered = filtered.filter((g: any) => g.isSenderIdentified === filter.isSenderIdentified);
    }
    if (filter.isVoided !== undefined) {
      filtered = filtered.filter((g: any) => g.isVoided === filter.isVoided);
    }
  }

  return filtered.map((g: any) =>
    mapToGiftDto(g, contribMap.get(g.id) || [], returnMap.get(g.id) || [])
  );
}

export async function addGiftReturnRecord(
  db: TxDb,
  giftId: string,
  amount: bigint,
  returnReason: string,
  userId?: string | null
): Promise<any> {
  const [created] = await db
    .insert(giftReturns)
    .values({
      giftId,
      amount,
      returnReason,
      returnedAt: new Date(),
      handledByUserId: userId ?? null,
    })
    .returning();

  return created;
}

export async function voidGiftRecord(
  db: TxDb,
  giftId: string,
  voidedReason: string,
  expectedVersion: number,
  userId?: string | null
): Promise<GiftDto> {
  const current = await getGiftById(db, giftId);
  if (!current) {
    throw new GiftNotFoundError(giftId);
  }
  if (current.version !== expectedVersion) {
    throw new OptimisticLockError(undefined, current.version);
  }

  const [updated] = await db
    .update(gifts)
    .set({
      isVoided: true,
      voidedReason,
      voidedAt: new Date(),
      voidedByUserId: userId ?? null,
      version: current.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(gifts.id, giftId), eq(gifts.version, expectedVersion)))
    .returning();

  return (await getGiftWithDetails(db, giftId))!;
}

export async function markGiftThankedRecord(
  db: TxDb,
  giftId: string,
  channel: string,
  notes?: string | null,
  userId?: string | null
): Promise<GiftDto> {
  const current = await getGiftById(db, giftId);
  if (!current) {
    throw new GiftNotFoundError(giftId);
  }

  await db
    .update(gifts)
    .set({
      isThanked: true,
      thankedAt: new Date(),
      thankedByUserId: userId ?? null,
      thankYouChannel: channel,
      thankYouNotes: notes ?? null,
      version: current.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(gifts.id, giftId));

  return (await getGiftWithDetails(db, giftId))!;
}

export async function addContributorsToGift(
  db: TxDb,
  giftId: string,
  contributors: Array<{
    guestId?: string | null;
    contributorName: string;
    relationship?: string | null;
  }>
): Promise<void> {
  for (const c of contributors) {
    await db.insert(giftContributors).values({
      giftId,
      guestId: c.guestId ?? null,
      contributorName: c.contributorName,
      relationship: c.relationship ?? null,
    });
  }
}

export async function reconcileSenderRecord(
  db: TxDb,
  giftId: string,
  contributor: {
    guestId?: string | null;
    contributorName: string;
    relationship?: string | null;
  }
): Promise<GiftDto> {
  const current = await getGiftById(db, giftId);
  if (!current) {
    throw new GiftNotFoundError(giftId);
  }

  await addContributorsToGift(db, giftId, [contributor]);

  await db
    .update(gifts)
    .set({
      isSenderIdentified: true,
      reconciliationStatus: 'reconciled',
      version: current.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(gifts.id, giftId));

  return (await getGiftWithDetails(db, giftId))!;
}
