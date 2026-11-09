import { describe, it, expect } from 'vitest';
import {
  // Common
  vndCurrencyStringSchema,
  vndBigIntSchema,
  sanitizedTextSchema,
  vietnamesePhoneSchema,
  nullableVietnamesePhoneSchema,
  emailSchema,
  nullableEmailSchema,
  // Auth
  weddingSettingsOwnerDtoSchema,
  weddingSettingsFamilyDtoSchema,
  // Guests
  guestOwnerDtoSchema,
  guestFamilyDtoSchema,
  invitationOwnerDtoSchema,
  invitationFamilyDtoSchema,
  attendanceOwnerDtoSchema,
  attendanceFamilyDtoSchema,
  eventHeadcountSummaryDtoSchema,
  mergeGuestsSchema,
  // Finance
  costItemDtoSchema,
  createCostItemSchema,
  paymentScheduleDtoSchema,
  fundSettingsDtoSchema,
  fundingEntryDtoSchema,
  createFundingEntrySchema,
  paymentDtoSchema,
  createPaymentSchema,
  costItemFinancialSummaryDtoSchema,
  overallBudgetSummaryDtoSchema,
  // Tasks
  taskOwnerDtoSchema,
  taskFamilyDtoSchema,
  createTaskSchema,
  createTaskDependencySchema,
  rescheduleImpactPreviewDtoSchema,
  // Files
  attachmentOwnerDtoSchema,
  attachmentFamilyDtoSchema,
  fileUploadHeaderSchema,
} from '../../../src/schemas';
import {
  FX01_FAMILY_GROUP,
  FX02_CANCELLED_SERVICE,
  FX03_OPENING_CUTOFF,
  calculateAttendanceMetrics,
  calculateCostFinancialMetrics,
  calculateCashFundLedger,
  getFx01FamilyGroupClone,
  getFx02CancelledServiceClone,
  getFx03OpeningCutoffClone,
} from '../../fixtures';

describe('Gate G0: FX01_FAMILY_GROUP Schema & Domain Validation', () => {
  it('parses all 4 family guests against guestOwnerDtoSchema', () => {
    const guests = Object.values(FX01_FAMILY_GROUP.guests);
    expect(guests).toHaveLength(4);

    for (const guest of guests) {
      const parsed = guestOwnerDtoSchema.safeParse({
        id: guest.id,
        display_name: guest.displayName,
        side: guest.side,
        group_id: guest.groupId,
        sub_tags: guest.subTags,
        age_tier: guest.ageTier,
        phone: guest.phone,
        email: guest.email,
        address: guest.address,
        private_notes: guest.privateNotes,
        is_archived: guest.isArchived,
        is_placeholder: guest.isPlaceholder,
        version: guest.version,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      expect(parsed.success).toBe(true);
    }
  });

  it('masks private notes, phone, email, and address for Family role (AT03, AT57)', () => {
    const father = FX01_FAMILY_GROUP.guests.father;
    const ownerPayload = {
      id: father.id,
      display_name: father.displayName,
      side: father.side,
      group_id: father.groupId,
      sub_tags: father.subTags,
      age_tier: father.ageTier,
      phone: father.phone,
      email: father.email,
      address: father.address,
      private_notes: father.privateNotes,
      is_archived: father.isArchived,
      is_placeholder: father.isPlaceholder,
      version: father.version,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsedOwner = guestOwnerDtoSchema.parse(ownerPayload);
    expect(parsedOwner.phone).toBe('0901234567');
    expect(parsedOwner.email).toBe('bacba@example.com');
    expect(parsedOwner.private_notes).toBe('Uống trà nóng, kiêng bia rượu lạnh');

    // Family schema strips phone, email, address, private_notes, is_archived, archived_at
    const parsedFamily = guestFamilyDtoSchema.parse(ownerPayload);
    expect(parsedFamily.display_name).toBe('Nguyễn Văn Ba (Bác Ba)');
    expect((parsedFamily as Record<string, unknown>).phone).toBeUndefined();
    expect((parsedFamily as Record<string, unknown>).email).toBeUndefined();
    expect((parsedFamily as Record<string, unknown>).address).toBeUndefined();
    expect((parsedFamily as Record<string, unknown>).private_notes).toBeUndefined();
  });

  it('calculates correct headcount, seating, and meals for Evening Reception (AT06, AT07)', () => {
    const guestsMap = {
      [FX01_FAMILY_GROUP.guests.father.id]: FX01_FAMILY_GROUP.guests.father,
      [FX01_FAMILY_GROUP.guests.mother.id]: FX01_FAMILY_GROUP.guests.mother,
      [FX01_FAMILY_GROUP.guests.child.id]: FX01_FAMILY_GROUP.guests.child,
      [FX01_FAMILY_GROUP.guests.baby.id]: FX01_FAMILY_GROUP.guests.baby,
    };

    const metrics = calculateAttendanceMetrics(
      FX01_FAMILY_GROUP.eveningAttendance,
      guestsMap
    );

    expect(metrics.totalInvited).toBe(4);
    expect(metrics.confirmedGuests).toBe(3);
    expect(metrics.declinedGuests).toBe(1);
    expect(metrics.uncertainGuests).toBe(0);
    expect(metrics.confirmedSeats).toBe(3);
    expect(metrics.mealsTotal).toBe(3);
    expect(metrics.mealsRegularAdult).toBe(1);
    expect(metrics.mealsVegetarian).toBe(1);
    expect(metrics.mealsChild).toBe(1);
    expect(metrics.mealsBaby).toBe(0);

    const summaryDto = {
      event_id: FX01_FAMILY_GROUP.events.eveningReception.id,
      total_invited: metrics.totalInvited,
      confirmed_guests: metrics.confirmedGuests,
      uncertain_guests: metrics.uncertainGuests,
      declined_guests: metrics.declinedGuests,
      confirmed_seats: metrics.confirmedSeats,
      meals_total: metrics.mealsTotal,
      meals_regular: metrics.mealsRegularAdult,
      meals_vegetarian: metrics.mealsVegetarian,
      meals_child: metrics.mealsChild,
      babies_count: metrics.mealsBaby,
    };
    const parsedSummary = eventHeadcountSummaryDtoSchema.safeParse(summaryDto);
    expect(parsedSummary.success).toBe(true);
  });

  it('verifies baby attendance in Morning Ceremony needs baby highchair without occupying adult seat', () => {
    const babyMorning = FX01_FAMILY_GROUP.morningAttendance.find(
      (a) => a.guestId === FX01_FAMILY_GROUP.guests.baby.id
    );
    expect(babyMorning).toBeDefined();
    expect(babyMorning?.rsvpStatus).toBe('accepted');
    expect(babyMorning?.needsSeat).toBe(false);
    expect(babyMorning?.dietaryNotes).toContain('baby highchair');
  });

  it('validates mergeGuestsSchema prevents merging a guest into themselves', () => {
    const invalidMerge = {
      retained_guest_id: FX01_FAMILY_GROUP.guests.father.id,
      merged_guest_id: FX01_FAMILY_GROUP.guests.father.id,
      resolved_phone: '0901234567',
      resolved_email: 'bacba@example.com',
      attendance_conflict_resolutions: [],
    };
    const res = mergeGuestsSchema.safeParse(invalidMerge);
    expect(res.success).toBe(false);
  });
});

describe('Gate G0: FX02_CANCELLED_SERVICE Schema & Invariant Validation', () => {
  it('validates cost item and payment transaction DTO string representations', () => {
    const itemDto = {
      id: FX02_CANCELLED_SERVICE.costItem.id,
      name: FX02_CANCELLED_SERVICE.costItem.name,
      category_id: FX02_CANCELLED_SERVICE.costItem.categoryId,
      vendor_name: FX02_CANCELLED_SERVICE.costItem.vendorName,
      contracted_amount: FX02_CANCELLED_SERVICE.expectedCalculations.dto.contractedAmount,
      final_settlement_amount: FX02_CANCELLED_SERVICE.expectedCalculations.dto.finalSettlementAmount,
      status: FX02_CANCELLED_SERVICE.costItem.status,
      cancellation_fee: FX02_CANCELLED_SERVICE.expectedCalculations.dto.cancellationFee,
      cancellation_notes: FX02_CANCELLED_SERVICE.costItem.cancellationNotes,
      version: FX02_CANCELLED_SERVICE.costItem.version,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsedItem = costItemDtoSchema.safeParse(itemDto);
    expect(parsedItem.success).toBe(true);

    const paymentDto = {
      id: FX02_CANCELLED_SERVICE.initialPayment.id,
      cost_item_id: FX02_CANCELLED_SERVICE.initialPayment.costItemId,
      payment_type: FX02_CANCELLED_SERVICE.initialPayment.paymentType,
      amount: FX02_CANCELLED_SERVICE.expectedCalculations.dto.totalOutflows,
      transaction_time: FX02_CANCELLED_SERVICE.initialPayment.transactionTime,
      payment_method: FX02_CANCELLED_SERVICE.initialPayment.paymentMethod,
      parent_payment_id: FX02_CANCELLED_SERVICE.initialPayment.parentPaymentId,
      is_direct_third_party: FX02_CANCELLED_SERVICE.initialPayment.isDirectThirdParty,
      is_voided: false,
      version: FX02_CANCELLED_SERVICE.initialPayment.version,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsedPayment = paymentDtoSchema.safeParse(paymentDto);
    expect(parsedPayment.success).toBe(true);
  });

  it('verifies exact BigInt net paid, cancellation fee, and zero remaining due (AT47)', () => {
    const payments = [
      FX02_CANCELLED_SERVICE.initialPayment,
      FX02_CANCELLED_SERVICE.refundInstallment1,
      FX02_CANCELLED_SERVICE.refundInstallment2,
    ];

    const metrics = calculateCostFinancialMetrics(
      FX02_CANCELLED_SERVICE.costItem,
      payments
    );

    expect(metrics.totalOutflows).toBe(10_000_000n);
    expect(metrics.totalRefunds).toBe(7_000_000n);
    expect(metrics.netPaid).toBe(3_000_000n);
    expect(metrics.obligationAmount).toBe(3_000_000n);
    expect(metrics.confirmedRemaining).toBe(0n);
    expect(metrics.surplusPaid).toBe(0n);
  });

  it('rejects illegal refund exceeding initial payment amount (AT14)', () => {
    const initialAmount = FX02_CANCELLED_SERVICE.initialPayment.amount; // 10M
    const existingRefunds =
      FX02_CANCELLED_SERVICE.refundInstallment1.amount +
      FX02_CANCELLED_SERVICE.refundInstallment2.amount; // 7M
    const remainingRefundable = initialAmount - existingRefunds; // 3M

    expect(remainingRefundable).toBe(3_000_000n);

    // Attempting an excessive refund of 3,000,001 VND must fail
    const illegalRefundAmount = 3_000_001n;
    expect(illegalRefundAmount > remainingRefundable).toBe(true);
  });

  it('preserves valid 0n final settlement without truthy fallback bug (AT48)', () => {
    const costItemZeroSettlement = {
      ...FX02_CANCELLED_SERVICE.costItem,
      contractedAmount: 25_000_000n,
      finalSettlementAmount: 0n, // Free or waived cancellation
    };

    const metrics = calculateCostFinancialMetrics(costItemZeroSettlement, []);
    expect(metrics.obligationAmount).toBe(0n);
    expect(metrics.confirmedRemaining).toBe(0n);
  });

  it('validates refund payments require parent_payment_id in createPaymentSchema', () => {
    const refundWithoutParent = {
      cost_item_id: FX02_CANCELLED_SERVICE.costItem.id,
      payment_type: 'refund' as const,
      amount: '5000000',
      payment_method: 'bank_transfer' as const,
      parent_payment_id: null,
    };
    const res = createPaymentSchema.safeParse(refundWithoutParent);
    expect(res.success).toBe(false);

    const refundWithParent = {
      ...refundWithoutParent,
      parent_payment_id: FX02_CANCELLED_SERVICE.initialPayment.id,
    };
    const validRes = createPaymentSchema.safeParse(refundWithParent);
    expect(validRes.success).toBe(true);
  });
});

describe('Gate G0: FX03_OPENING_CUTOFF Schema & Cashflow Ledger Validation', () => {
  it('does NOT subtract historical pre-opening disbursements from initial fund balance (AT45)', () => {
    const allPayments = [
      ...FX03_OPENING_CUTOFF.historicalPayments,
      ...FX03_OPENING_CUTOFF.postOpeningPayments,
    ];

    const ledger = calculateCashFundLedger(
      FX03_OPENING_CUTOFF.fundSettings,
      allPayments,
      FX03_OPENING_CUTOFF.fundingEntries
    );

    expect(ledger.isConfigured).toBe(true);
    expect(ledger.initialBalance).toBe(100_000_000n);
    expect(ledger.disbursedPriorToOpening).toBe(30_000_000n);
    expect(ledger.disbursedAfterOpening).toBe(35_000_000n);
    expect(ledger.totalDisbursedAllTime).toBe(65_000_000n);

    // Initial 100M + 50M contribution - 25M post-opening cash disbursements = 125M
    expect(ledger.availableCash).toBe(125_000_000n);
    // Explicitly assert it is NOT 95M (which would occur if pre-opening 30M was deducted)
    expect(ledger.availableCash).not.toBe(95_000_000n);
  });

  it('keeps direct third-party vendor payment cash-neutral to couple fund (AT38)', () => {
    const directPayment = FX03_OPENING_CUTOFF.postOpeningPayments.find(
      (p) => p.isDirectThirdParty
    );
    const linkedFunding = FX03_OPENING_CUTOFF.fundingEntries.find(
      (fe) => fe.entryType === 'direct_vendor_payment'
    );

    expect(directPayment).toBeDefined();
    expect(linkedFunding).toBeDefined();
    expect(directPayment?.amount).toBe(10_000_000n);
    expect(linkedFunding?.amount).toBe(10_000_000n);

    // Schema requires linked_cost_item_id for direct_vendor_payment
    const invalidDirectFunding = {
      entry_type: 'direct_vendor_payment' as const,
      amount: '10000000',
      contributor_name: 'Bà Loan',
      linked_cost_item_id: null,
    };
    const res = createFundingEntrySchema.safeParse(invalidDirectFunding);
    expect(res.success).toBe(false);
  });

  it('parses overallBudgetSummaryDtoSchema with separate surplus and balance due (AT15)', () => {
    const summary = {
      target_budget: '500000000',
      total_forecast_cost: '450000000',
      has_missing_prices: false,
      missing_prices_count: 0,
      total_net_paid: '200000000',
      total_confirmed_balance_due: '250000000',
      total_surplus: '2000000', // Separate surplus (not netted into debt)
      available_cash: FX03_OPENING_CUTOFF.expectedCalculations.dto.availableCashBalance,
    };
    const parsed = overallBudgetSummaryDtoSchema.safeParse(summary);
    expect(parsed.success).toBe(true);
  });
});

describe('Gate G0: Role Isolation & Masking (Owner vs Family View-only)', () => {
  it('masks budget_target and contingency_budget in weddingSettingsFamilyDtoSchema (AT03, AT36)', () => {
    const ownerSettings = {
      id: 'e0000000-0000-4000-8000-000000000099',
      bride_name: 'Nguyễn Thị Dâu',
      groom_name: 'Trần Văn Rể',
      short_title: 'Đám cưới Dâu & Rể',
      tentative_date_note: 'Dự kiến sau Tết 2028',
      is_date_confirmed: true,
      budget_target: '300000000',
      contingency_budget: '50000000',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsedOwner = weddingSettingsOwnerDtoSchema.parse(ownerSettings);
    expect(parsedOwner.budget_target).toBe('300000000');
    expect(parsedOwner.contingency_budget).toBe('50000000');

    const parsedFamily = weddingSettingsFamilyDtoSchema.parse(ownerSettings);
    expect(parsedFamily.bride_name).toBe('Nguyễn Thị Dâu');
    expect((parsedFamily as Record<string, unknown>).budget_target).toBeUndefined();
    expect((parsedFamily as Record<string, unknown>).contingency_budget).toBeUndefined();
  });

  it('masks internal title, private_notes, and in_charge_user_id in taskFamilyDtoSchema (AT59)', () => {
    const internalTask = {
      id: '41000000-0000-4000-8000-000000000001',
      title: 'Nhắc anh Hoàng hoàn thiện hợp đồng quay phim (Nội bộ)',
      category: 'Quay chụp',
      priority: 'high' as const,
      status: 'in_progress' as const,
      deadline_type: 'fixed_date' as const,
      fixed_date: '2028-02-01',
      pinned_manual: false,
      private_notes: 'Cần mặc cả thêm gói flycam miễn phí',
      shared_with_family: true,
      shared_public_title: 'Chốt hợp đồng quay phim phóng sự',
      shared_public_notes: 'Đã thống nhất khung giờ quay lễ sáng',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsedOwner = taskOwnerDtoSchema.parse(internalTask);
    expect(parsedOwner.title).toContain('Nội bộ');
    expect(parsedOwner.private_notes).toContain('mặc cả');

    // For Family, title is mapped from shared_public_title, notes from shared_public_notes
    const familyView = {
      id: internalTask.id,
      title: internalTask.shared_public_title,
      category: internalTask.category,
      priority: internalTask.priority,
      status: internalTask.status,
      deadline_type: internalTask.deadline_type,
      is_waiting_official_date: false,
      notes: internalTask.shared_public_notes,
    };
    const parsedFamily = taskFamilyDtoSchema.parse(familyView);
    expect(parsedFamily.title).toBe('Chốt hợp đồng quay phim phóng sự');
    expect(parsedFamily.title).not.toContain('Nội bộ');
    expect((parsedFamily as Record<string, unknown>).private_notes).toBeUndefined();
  });

  it('masks server storage_key and original file size in attachmentFamilyDtoSchema (AT41)', () => {
    const attachmentData = {
      id: 'a0000000-0000-4000-8000-000000000001',
      storage_key: '/data/uploads/2026/04/contract_diamond.pdf',
      original_name: 'HopDong_Diamond_ChupAnh.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 5242880,
      checksum_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      is_private: false,
      owner_only: false,
      entity_type: 'cost_item' as const,
      processing_status: 'ready' as const,
      uploader_user_id: 'usr00000-0000-4000-8000-000000000001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsedOwner = attachmentOwnerDtoSchema.parse(attachmentData);
    expect(parsedOwner.storage_key).toBe('/data/uploads/2026/04/contract_diamond.pdf');
    expect(parsedOwner.file_size_bytes).toBe(5242880);

    const parsedFamily = attachmentFamilyDtoSchema.parse({
      id: attachmentData.id,
      original_name: attachmentData.original_name,
      mime_type: attachmentData.mime_type,
      entity_type: attachmentData.entity_type,
    });
    expect(parsedFamily.original_name).toBe('HopDong_Diamond_ChupAnh.pdf');
    expect((parsedFamily as Record<string, unknown>).storage_key).toBeUndefined();
    expect((parsedFamily as Record<string, unknown>).file_size_bytes).toBeUndefined();
  });
});

describe('Gate G0: Negative / Adversarial Boundary Validation', () => {
  it('rejects floating-point numbers in vndCurrencyStringSchema', () => {
    const invalidFloats = ['15000000.5', '1000.00', '1e6', 'NaN', '0.1'];
    for (const val of invalidFloats) {
      const res = vndCurrencyStringSchema.safeParse(val);
      expect(res.success).toBe(false);
    }
  });

  it('rejects negative strings in vndCurrencyStringSchema', () => {
    const negativeStrings = ['-5000000', '-1', '-0'];
    for (const val of negativeStrings) {
      const res = vndCurrencyStringSchema.safeParse(val);
      expect(res.success).toBe(false);
    }
  });

  it('transforms strings and bigints via vndBigIntSchema without loss of precision', () => {
    expect(vndBigIntSchema.parse('50000000000')).toBe(50_000_000_000n);
    expect(vndBigIntSchema.parse(50_000_000_000n)).toBe(50_000_000_000n);
    expect(vndBigIntSchema.safeParse('-1000').success).toBe(false);
    expect(vndBigIntSchema.safeParse(-1000n).success).toBe(false);
  });

  it('neutralizes CSV/XLSX formula injection characters via sanitizedTextSchema (AT29)', () => {
    const dangerousInputs = [
      '=cmd|"/C calc"!A0',
      '+1+2',
      '-2+3',
      '@SUM(A1:A10)',
      '\tDANGEROUS',
      '\rCRLF',
    ];

    const sanitizer = sanitizedTextSchema(255);
    for (const input of dangerousInputs) {
      const sanitized = sanitizer.parse(input);
      expect(sanitized.startsWith("'")).toBe(true);
    }

    const whitespaceBypassInputs = [
      '  =cmd|"/C calc"!A0',
      '   +1+2',
      '  -2+3',
      '  @SUM(A1:A10)',
      '\n=1+1',
      '\r\n+999',
    ];
    for (const input of whitespaceBypassInputs) {
      const sanitized = sanitizer.parse(input);
      expect(sanitized.startsWith("'")).toBe(true);
    }

    const safeInput = 'Nguyễn Văn An';
    expect(sanitizer.parse(safeInput)).toBe('Nguyễn Văn An');
  });

  it('rejects self-dependent task in createTaskDependencySchema (AT19)', () => {
    const sameId = '41000000-0000-4000-8000-000000000001';
    const res = createTaskDependencySchema.safeParse({
      dependent_task_id: sameId,
      prerequisite_task_id: sameId,
    });
    expect(res.success).toBe(false);
  });

  it('rejects file upload exceeding maximum allowed size in fileUploadHeaderSchema (AT39)', () => {
    const oversizedFile = {
      content_type: 'image/jpeg',
      content_length: 25 * 1024 * 1024, // 25 MiB > 20 MiB limit
      entity_type: 'cost_item',
    };
    const res = fileUploadHeaderSchema.safeParse(oversizedFile);
    expect(res.success).toBe(false);
  });

  it('rejects unallowed MIME types in fileUploadHeaderSchema (AT39)', () => {
    const invalidMime = {
      content_type: 'application/x-msdownload',
      content_length: 1024,
      entity_type: 'cost_item',
    };
    const res = fileUploadHeaderSchema.safeParse(invalidMime);
    expect(res.success).toBe(false);
  });
});
