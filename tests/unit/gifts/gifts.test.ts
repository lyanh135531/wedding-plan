import { describe, it, expect } from 'vitest';
import { createMockG10TxDb } from '../../helpers/g10-mock-db';
import {
  createGift,
  recordGiftReturn,
  voidGift,
  markGiftThanked,
  reconcileSender,
  listGifts,
  getGiftSummary,
  reconcileSafeCash,
} from '@/lib/gifts';
import {
  GiftReturnExceedsBalanceError,
  PhysicalGiftReturnNotAllowedError,
  GiftAlreadyVoidedError,
} from '@/lib/gifts/errors';

describe('Gate G10: Gifts Registry & Financial Reconciliation (PLAN §16, AT25, FL16)', () => {
  const eventId = '00000000-0000-4000-8000-000000000001';

  it('records cash and physical gifts correctly (Edge Case 9)', async () => {
    const db = createMockG10TxDb();

    // Cash gift
    const cashGift = await createGift(db, {
      eventId,
      giftType: 'cash',
      amount: '2000000',
      contributors: [{ contributorName: 'Bác Ba' }],
    });
    expect(cashGift.giftType).toBe('cash');
    expect(cashGift.amount).toBe('2000000');

    // Physical gift
    const physicalGift = await createGift(db, {
      eventId,
      giftType: 'physical',
      description: 'Lò vi sóng Panasonic',
      contributors: [{ contributorName: 'Cô Bảy' }],
    });
    expect(physicalGift.giftType).toBe('physical');
    expect(physicalGift.amount).toBeNull();
    expect(physicalGift.description).toBe('Lò vi sóng Panasonic');

    const summary = await getGiftSummary(db, eventId);
    expect(summary.totalReceivedCash).toBe('2000000');
    expect(summary.physicalGiftsCount).toBe(1);
    expect(summary.cashGiftsCount).toBe(1);
  });

  it('verifies multi-contributor joint envelope does NOT replicate cash amount (AT25)', async () => {
    const db = createMockG10TxDb();

    // Family of 3 (Bố, Mẹ, Con gái) gives a single envelope of 5,000,000 VND
    const envelope = await createGift(db, {
      eventId,
      giftType: 'cash',
      amount: '5000000',
      envelopeCode: 'PB-001',
      contributors: [
        { contributorName: 'Nguyễn Văn Bố', relationship: 'Bác ruột' },
        { contributorName: 'Lê Thị Mẹ', relationship: 'Bác gái' },
        { contributorName: 'Nguyễn Thị Con', relationship: 'Em họ' },
      ],
    });

    expect(envelope.contributors.length).toBe(3);
    expect(envelope.amount).toBe('5000000');

    // Total cash in registry must increase by exactly 5,000,000 VND (NOT 15,000,000 VND!)
    const summary = await getGiftSummary(db, eventId);
    expect(summary.totalReceivedCash).toBe('5000000');
    expect(summary.netReceivedCash).toBe('5000000');
  });

  it('enforces gift return balance ceiling and rejects excessive returns (FL16, Edge Case 8)', async () => {
    const db = createMockG10TxDb();
    const gift = await createGift(db, {
      eventId,
      giftType: 'cash',
      amount: '2000000',
      contributors: [{ contributorName: 'Anh Hùng' }],
    });

    // 1st partial return: 500,000 -> succeeds. Remaining held: 1,500,000
    const return1 = await recordGiftReturn(db, gift.id, {
      amount: '500000',
      returnReason: 'Trả lại bớt một phần tiền mừng',
    });
    expect(return1.netAmount).toBe('1500000');

    // 2nd return: 1,800,000 -> exceeds 1,500,000 remaining held -> rejects!
    await expect(
      recordGiftReturn(db, gift.id, {
        amount: '1800000',
        returnReason: 'Trả quá số tiền còn giữ',
      })
    ).rejects.toThrow(GiftReturnExceedsBalanceError);

    // Valid remaining return: 1,500,000 -> succeeds. Remaining: 0
    const return2 = await recordGiftReturn(db, gift.id, {
      amount: '1500000',
      returnReason: 'Trả lại hết phần còn lại',
    });
    expect(return2.netAmount).toBe('0');

    const summary = await getGiftSummary(db, eventId);
    expect(summary.totalReceivedCash).toBe('2000000');
    expect(summary.totalReturnedCash).toBe('2000000');
    expect(summary.netReceivedCash).toBe('0');
  });

  it('rejects cash return on physical gifts', async () => {
    const db = createMockG10TxDb();
    const phys = await createGift(db, {
      eventId,
      giftType: 'physical',
      description: 'Tranh thêu chữ thập',
      contributors: [{ contributorName: 'Chị Lan' }],
    });

    await expect(
      recordGiftReturn(db, phys.id, {
        amount: '500000',
        returnReason: 'Không thể hoàn tiền mặt cho hiện vật',
      })
    ).rejects.toThrow(PhysicalGiftReturnNotAllowedError);
  });

  it('soft-voids mistyped gifts and excludes them strictly from financial totals (Edge Case 17)', async () => {
    const db = createMockG10TxDb();
    const mistyped = await createGift(db, {
      eventId,
      giftType: 'cash',
      amount: '10000000', // 10M mistyped
      contributors: [{ contributorName: 'Nhầm lẫn' }],
    });

    const valid = await createGift(db, {
      eventId,
      giftType: 'cash',
      amount: '1000000', // 1M valid
      contributors: [{ contributorName: 'Đúng người' }],
    });

    // Before voiding: total is 11M
    let summary = await getGiftSummary(db, eventId);
    expect(summary.totalReceivedCash).toBe('11000000');

    // Void mistyped gift
    await voidGift(db, mistyped.id, {
      voidedReason: 'Nhập thừa một chữ số 0, thay thế bằng bản ghi đúng',
      version: 1,
    });

    // After voiding: total is strictly 1M (mistyped 10M is excluded!)
    summary = await getGiftSummary(db, eventId);
    expect(summary.totalReceivedCash).toBe('1000000');
    expect(summary.netReceivedCash).toBe('1000000');
  });

  it('handles unidentified sender review queue and subsequent reconciliation', async () => {
    const db = createMockG10TxDb();
    // Unidentified envelope found in box
    const unmapped = await createGift(db, {
      eventId,
      giftType: 'cash',
      amount: '1000000',
      envelopeCode: 'PB-UNKNOWN-1',
      isSenderIdentified: false,
      unidentifiedNotes: 'Phong bì không ghi tên, chữ ký mờ',
      reconciliationStatus: 'needs_reconciliation',
      contributors: [],
    });

    expect(unmapped.isSenderIdentified).toBe(false);

    let summary = await getGiftSummary(db, eventId);
    expect(summary.unidentifiedCount).toBe(1);
    expect(summary.needsReconciliationCount).toBe(1);

    // Reconcile sender
    const matched = await reconcileSender(db, unmapped.id, {
      contributorName: 'Chú Chín',
      relationship: 'Họ ngoại',
    });

    expect(matched.isSenderIdentified).toBe(true);
    expect(matched.reconciliationStatus).toBe('reconciled');
    expect(matched.contributors.length).toBe(1);
    expect(matched.contributors[0].contributorName).toBe('Chú Chín');

    summary = await getGiftSummary(db, eventId);
    expect(summary.unidentifiedCount).toBe(0);
    expect(summary.needsReconciliationCount).toBe(0);
  });

  it('reconciles physical safe cash tally against software registry with variance tracking', async () => {
    const db = createMockG10TxDb();
    await createGift(db, {
      eventId,
      giftType: 'cash',
      amount: '10000000',
      contributors: [{ contributorName: 'Khách A' }],
    });
    await createGift(db, {
      eventId,
      giftType: 'cash',
      amount: '5000000',
      contributors: [{ contributorName: 'Khách B' }],
    });

    // Case 1: Counted exactly 15,000,000 -> isBalanced = true, variance = 0
    const balancedRecon = await reconcileSafeCash(db, {
      eventId,
      countedCashAmount: '15000000',
    });
    expect(balancedRecon.isBalanced).toBe(true);
    expect(balancedRecon.variance).toBe('0');

    // Case 2: Counted 14,500,000 -> variance = -500,000
    const shortRecon = await reconcileSafeCash(db, {
      eventId,
      countedCashAmount: '14500000',
    });
    expect(shortRecon.isBalanced).toBe(false);
    expect(shortRecon.variance).toBe('-500000');
  });

  it('tracks manual thank-you logging with channel and notes', async () => {
    const db = createMockG10TxDb();
    const gift = await createGift(db, {
      eventId,
      giftType: 'cash',
      amount: '1000000',
      contributors: [{ contributorName: 'Bạn Thân' }],
    });

    expect(gift.isThanked).toBe(false);

    const thanked = await markGiftThanked(db, gift.id, {
      isThanked: true,
      channel: 'sms',
      notes: 'Đã gửi lời cảm ơn qua tin nhắn',
    }, 'owner-user');

    expect(thanked.isThanked).toBe(true);
    expect(thanked.thankedAt).toBeDefined();
    expect(thanked.thankYouChannel).toBe('sms');
  });
});
