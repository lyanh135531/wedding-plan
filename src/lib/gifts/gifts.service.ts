import { TxDb } from './types';
import {
  CreateGiftInput,
  CreateGiftReturnInput,
  MarkThankedInput,
  VoidGiftInput,
  ReconcileSafeCashInput,
  GiftDto,
  GiftSummaryDto,
} from '@/schemas/gifts';
import {
  createGiftRecord,
  getGiftById,
  getGiftWithDetails,
  listGiftsByEvent,
  addGiftReturnRecord,
  voidGiftRecord,
  markGiftThankedRecord,
  reconcileSenderRecord,
} from './gifts.repository';
import {
  GiftNotFoundError,
  GiftAlreadyVoidedError,
  GiftReturnExceedsBalanceError,
  PhysicalGiftReturnNotAllowedError,
} from './errors';

/**
 * Creates a gift entry.
 * Invariant (AT25): Multi-contributor joint envelope.
 * A single gift record with N contributors is created with 1 monetary amount.
 * The total cash amount is NEVER multiplied by the number of contributors.
 */
export async function createGift(
  db: TxDb,
  input: CreateGiftInput,
  userId?: string | null
): Promise<GiftDto> {
  const amountBigInt = input.giftType === 'cash' && input.amount ? BigInt(input.amount) : null;

  return createGiftRecord(
    db,
    {
      eventId: input.eventId,
      giftType: input.giftType ?? 'cash',
      amount: amountBigInt,
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : undefined,
      description: input.description ?? null,
      receivedByUserId: userId ?? input.receivedByUserId ?? null,
      receivedByProxy: input.receivedByProxy ?? null,
      envelopeCode: input.envelopeCode ?? null,
      isSenderIdentified: input.isSenderIdentified ?? true,
      unidentifiedNotes: input.unidentifiedNotes ?? null,
      reconciliationStatus: input.reconciliationStatus ?? 'reconciled',
      notes: input.notes ?? null,
    },
    input.contributors || []
  );
}

/**
 * Records a return of cash to a guest (FL16).
 * Invariants:
 * - Physical gifts cannot have cash returns.
 * - Cannot return more than the net held gift balance (gift.amount - previous_returns).
 * - Voided gifts cannot be returned.
 */
export async function recordGiftReturn(
  db: TxDb,
  giftId: string,
  input: CreateGiftReturnInput,
  userId?: string | null
): Promise<GiftDto> {
  const gift = await getGiftWithDetails(db, giftId);
  if (!gift) {
    throw new GiftNotFoundError(giftId);
  }
  if (gift.isVoided) {
    throw new GiftAlreadyVoidedError();
  }
  if (gift.giftType !== 'cash' || !gift.amount) {
    throw new PhysicalGiftReturnNotAllowedError();
  }

  const giftTotal = BigInt(gift.amount);
  const existingReturns = gift.returns.reduce((sum, r) => sum + BigInt(r.amount), 0n);
  const currentHeld = giftTotal > existingReturns ? giftTotal - existingReturns : 0n;

  const returnAmount = BigInt(input.amount);
  if (returnAmount > currentHeld) {
    throw new GiftReturnExceedsBalanceError(currentHeld, returnAmount);
  }

  await addGiftReturnRecord(db, giftId, returnAmount, input.returnReason, userId);
  return (await getGiftWithDetails(db, giftId))!;
}

/**
 * Soft-voids an erroneous gift entry with a mandatory reason.
 * Invariant: Excluded from cash tallies, thank-you tracking, and totals.
 */
export async function voidGift(
  db: TxDb,
  giftId: string,
  input: VoidGiftInput,
  userId?: string | null
): Promise<GiftDto> {
  const gift = await getGiftById(db, giftId);
  if (!gift) {
    throw new GiftNotFoundError(giftId);
  }
  if (gift.isVoided) {
    throw new GiftAlreadyVoidedError();
  }

  return voidGiftRecord(db, giftId, input.voidedReason, input.version, userId);
}

/**
 * Marks a gift as thanked manually.
 * Invariant: The system records manual thank-you actions; it never dispatches automated external messages.
 */
export async function markGiftThanked(
  db: TxDb,
  giftId: string,
  input: MarkThankedInput,
  userId?: string | null
): Promise<GiftDto> {
  return markGiftThankedRecord(db, giftId, input.channel, input.notes, userId);
}

/**
 * Matches an unidentified envelope from the review queue to a verified guest profile.
 */
export async function reconcileSender(
  db: TxDb,
  giftId: string,
  contributor: {
    guestId?: string | null;
    contributorName: string;
    relationship?: string | null;
  },
  userId?: string | null
): Promise<GiftDto> {
  return reconcileSenderRecord(db, giftId, contributor);
}

export async function listGifts(
  db: TxDb,
  eventId: string,
  filter?: {
    giftType?: 'cash' | 'physical';
    isThanked?: boolean;
    isSenderIdentified?: boolean;
    isVoided?: boolean;
  }
): Promise<GiftDto[]> {
  return listGiftsByEvent(db, eventId, filter);
}

/**
 * Calculates comprehensive gift totals and statistics.
 * Invariants:
 * - Excludes voided gifts.
 * - Net cash = valid cash received - valid cash returned.
 * - Multi-contributor gifts counted exactly once.
 */
export async function getGiftSummary(
  db: TxDb,
  eventId: string
): Promise<GiftSummaryDto> {
  const allGifts = await listGiftsByEvent(db, eventId);

  let totalReceived = 0n;
  let totalReturned = 0n;
  let cashCount = 0;
  let physicalCount = 0;
  let unthankedCount = 0;
  let unidentifiedCount = 0;
  let needsReconCount = 0;
  let validGiftsCount = 0;

  for (const g of allGifts) {
    if (g.isVoided) continue; // Exclude voided gifts from financial statistics

    validGiftsCount++;

    if (g.giftType === 'cash') {
      cashCount++;
      if (g.amount) {
        totalReceived += BigInt(g.amount);
      }
      for (const r of g.returns) {
        totalReturned += BigInt(r.amount);
      }
    } else {
      physicalCount++;
    }

    if (!g.isThanked) {
      unthankedCount++;
    }

    if (!g.isSenderIdentified) {
      unidentifiedCount++;
    }

    if (g.reconciliationStatus === 'needs_reconciliation') {
      needsReconCount++;
    }
  }

  const netReceived = totalReceived > totalReturned ? totalReceived - totalReturned : 0n;

  return {
    totalReceivedCash: totalReceived.toString(),
    totalReturnedCash: totalReturned.toString(),
    netReceivedCash: netReceived.toString(),
    totalGiftsCount: validGiftsCount,
    cashGiftsCount: cashCount,
    physicalGiftsCount: physicalCount,
    unthankedCount,
    unidentifiedCount,
    needsReconciliationCount: needsReconCount,
  };
}

/**
 * Safe Cash Reconciliation against physical count.
 */
export async function reconcileSafeCash(
  db: TxDb,
  input: ReconcileSafeCashInput
): Promise<{
  registeredCashTotal: string;
  countedCash: string;
  variance: string;
  isBalanced: boolean;
}> {
  const summary = await getGiftSummary(db, input.eventId);
  const registeredCash = BigInt(summary.netReceivedCash);
  const countedCash = BigInt(input.countedCashAmount);
  const variance = countedCash - registeredCash;

  return {
    registeredCashTotal: registeredCash.toString(),
    countedCash: countedCash.toString(),
    variance: variance.toString(),
    isBalanced: variance === 0n,
  };
}
