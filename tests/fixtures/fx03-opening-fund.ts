import { FixturePayment } from './fx02-cancellation';

/**
 * FX03_OPENING_CUTOFF: Canonical domain fixture for opening fund anchor date,
 * pre-opening deposit non-deduction, and third-party direct payment neutrality (AT37, AT38, AT45).
 */

export interface FixtureFundSettings {
  id: string;
  openingAsOf: string; // ISO 8601 UTC timestamp
  initialBalance: bigint;
  fundScopeConfirmed: boolean;
  confirmedBy: string;
  notes: string | null;
  version: number;
}

export interface FixtureFundingEntry {
  id: string;
  entryType: 'cash_fund' | 'direct_vendor_payment' | 'pledged_unreceived';
  amount: bigint;
  contributorName: string | null;
  contributionDate: string;
  linkedCostItemId: string | null;
  linkedPaymentId: string | null;
  notes: string | null;
  isVoided: boolean;
  version: number;
}

export interface Fx03OpeningFundFixture {
  readonly fundSettings: FixtureFundSettings;
  readonly historicalPayments: FixturePayment[];
  readonly postOpeningPayments: FixturePayment[];
  readonly fundingEntries: FixtureFundingEntry[];
  readonly expectedCalculations: {
    initialBalance: bigint;
    totalDisbursedAllTime: bigint;
    disbursedPriorToOpening: bigint;
    disbursedAfterOpening: bigint;
    disbursedFromCashFundPostOpening: bigint;
    directThirdPartyDisbursements: bigint;
    cashContributionsPostOpening: bigint;
    availableCashBalance: bigint;
    // Serialized DTO representations for API testing
    dto: {
      initialBalance: string;
      totalDisbursedAllTime: string;
      disbursedPriorToOpening: string;
      disbursedAfterOpening: string;
      availableCashBalance: string;
    };
  };
}

export const FX03_OPENING_CUTOFF: Fx03OpeningFundFixture = {
  fundSettings: {
    id: '31000000-0000-4000-8000-000000000001',
    openingAsOf: '2026-05-31T17:00:00.000Z', // 2026-06-01T00:00:00+07:00 in Asia/Ho_Chi_Minh
    initialBalance: 100_000_000n,
    fundScopeConfirmed: true,
    confirmedBy: '32000000-0000-4000-8000-000000000001',
    notes: 'Quỹ tiết kiệm cưới chung của hai vợ chồng tại ngân hàng Vietcombank',
    version: 1,
  },
  historicalPayments: [
    {
      id: '33000000-0000-4000-8000-000000000010',
      costItemId: 'c0000000-0000-4000-8000-000000000010',
      paymentType: 'outflow',
      amount: 15_000_000n,
      transactionTime: '2026-05-10T03:00:00.000Z', // 2026-05-10 10:00 VN
      paymentMethod: 'bank_transfer',
      payerName: 'Chú rể',
      recipientName: 'Trung tâm Hội nghị Grand Palace',
      parentPaymentId: null,
      isDirectThirdParty: false,
      notes: 'Đặt cọc giữ chỗ sảnh tiệc đợt 1',
      isVoided: false,
      version: 1,
    },
    {
      id: '33000000-0000-4000-8000-000000000011',
      costItemId: 'c0000000-0000-4000-8000-000000000011',
      paymentType: 'outflow',
      amount: 15_000_000n,
      transactionTime: '2026-05-20T09:30:00.000Z', // 2026-05-20 16:30 VN
      paymentMethod: 'bank_transfer',
      payerName: 'Cô dâu',
      recipientName: 'Tiệm Kim Hoàn PNJ Diamond',
      parentPaymentId: null,
      isDirectThirdParty: false,
      notes: 'Đặt cọc gia công cặp nhẫn cưới',
      isVoided: false,
      version: 1,
    },
  ],
  postOpeningPayments: [
    {
      id: '33000000-0000-4000-8000-000000000012',
      costItemId: 'c0000000-0000-4000-8000-000000000012',
      paymentType: 'outflow',
      amount: 20_000_000n,
      transactionTime: '2026-06-15T04:00:00.000Z', // 2026-06-15 11:00 VN
      paymentMethod: 'bank_transfer',
      payerName: 'Cô dâu',
      recipientName: 'Bridal Gown Boutique',
      parentPaymentId: null,
      isDirectThirdParty: false,
      notes: 'Thanh toán thuê váy cưới chính ngày cưới',
      isVoided: false,
      version: 1,
    },
    {
      id: '33000000-0000-4000-8000-000000000013',
      costItemId: 'c0000000-0000-4000-8000-000000000013',
      paymentType: 'outflow',
      amount: 10_000_000n,
      transactionTime: '2026-06-18T07:00:00.000Z', // 2026-06-18 14:00 VN
      paymentMethod: 'bank_transfer',
      payerName: 'Mẹ chú rể (Bà Loan)',
      recipientName: 'Florist Shop Hương Mộc',
      parentPaymentId: null,
      isDirectThirdParty: true, // Direct parent contribution (AT38)
      notes: 'Mẹ chú rể trả thẳng tiền hoa tươi cho tiệm hoa',
      isVoided: false,
      version: 1,
    },
    {
      id: '33000000-0000-4000-8000-000000000014',
      costItemId: 'c0000000-0000-4000-8000-000000000014',
      paymentType: 'outflow',
      amount: 5_000_000n,
      transactionTime: '2026-07-01T08:30:00.000Z', // 2026-07-01 15:30 VN
      paymentMethod: 'bank_transfer',
      payerName: 'Chú rể',
      recipientName: 'Xưởng in Thiệp cưới Ánh Vàng',
      parentPaymentId: null,
      isDirectThirdParty: false,
      notes: 'Thanh toán tiền in thiệp giấy ép kim',
      isVoided: false,
      version: 1,
    },
  ],
  fundingEntries: [
    {
      id: 'fe000000-0000-4000-8000-000000000001',
      entryType: 'direct_vendor_payment',
      amount: 10_000_000n,
      contributorName: 'Mẹ chú rể (Bà Loan)',
      contributionDate: '2026-06-18T07:00:00.000Z',
      linkedCostItemId: 'c0000000-0000-4000-8000-000000000013',
      linkedPaymentId: '33000000-0000-4000-8000-000000000013',
      notes: 'Góp tặng đám cưới bằng cách thanh toán thẳng chi phí hoa tươi',
      isVoided: false,
      version: 1,
    },
    {
      id: 'fe000000-0000-4000-8000-000000000002',
      entryType: 'cash_fund',
      amount: 50_000_000n,
      contributorName: 'Hai vợ chồng trích từ lương tháng 6',
      contributionDate: '2026-06-25T02:00:00.000Z',
      linkedCostItemId: null,
      linkedPaymentId: null,
      notes: 'Nạp thêm tiền vào tài khoản quỹ chung mở tại VCB',
      isVoided: false,
      version: 1,
    },
  ],
  expectedCalculations: {
    initialBalance: 100_000_000n,
    totalDisbursedAllTime: 65_000_000n,
    disbursedPriorToOpening: 30_000_000n,
    disbursedAfterOpening: 35_000_000n,
    disbursedFromCashFundPostOpening: 25_000_000n,
    directThirdPartyDisbursements: 10_000_000n,
    cashContributionsPostOpening: 50_000_000n,
    availableCashBalance: 125_000_000n,
    dto: {
      initialBalance: '100000000',
      totalDisbursedAllTime: '65000000',
      disbursedPriorToOpening: '30000000',
      disbursedAfterOpening: '35000000',
      availableCashBalance: '125000000',
    },
  },
};
