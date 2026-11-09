/**
 * FX02_CANCELLED_SERVICE: Canonical domain fixture for a contracted vendor service
 * cancelled with penalty fee and multi-stage refunds (AT12, AT14, AT47, AT48).
 */

export interface FixtureCostItem {
  id: string;
  name: string;
  categoryId: string;
  eventId: string | null;
  vendorName: string;
  vendorPhone: string | null;
  vendorContact: string | null;
  estimatedAmount: bigint | null;
  contractedAmount: bigint | null;
  finalSettlementAmount: bigint | null;
  status: 'draft' | 'contracted' | 'completed' | 'cancelling' | 'cancelled';
  cancellationFee: bigint | null;
  cancellationNotes: string | null;
  notes: string | null;
  version: number;
}

export interface FixturePaymentSchedule {
  id: string;
  costItemId: string;
  installmentNumber: number;
  title: string;
  amountDue: bigint;
  dueDate: string;
  status: 'estimated' | 'agreed' | 'cancelled';
  notes: string | null;
  version: number;
}

export interface FixturePayment {
  id: string;
  costItemId: string;
  paymentType: 'outflow' | 'refund';
  amount: bigint;
  transactionTime: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'other';
  payerName: string;
  recipientName: string;
  parentPaymentId: string | null;
  isDirectThirdParty: boolean;
  notes: string | null;
  isVoided: boolean;
  version: number;
}

export interface FixturePaymentAllocation {
  id: string;
  paymentId: string;
  scheduleId: string | null;
  allocatedAmount: bigint;
}

export interface Fx02CancelledServiceFixture {
  readonly costItem: FixtureCostItem;
  readonly schedules: FixturePaymentSchedule[];
  readonly initialPayment: FixturePayment;
  readonly initialAllocation: FixturePaymentAllocation;
  readonly refundInstallment1: FixturePayment;
  readonly refundInstallment2: FixturePayment;
  readonly expectedCalculations: {
    totalOutflows: bigint;
    totalRefunds: bigint;
    netPaid: bigint;
    finalSettlement: bigint;
    confirmedRemaining: bigint;
    surplusPaid: bigint;
    remainingRefundableAmount: bigint;
    effectiveCancellationCost: bigint;
    // Serialized DTO representation for API boundary testing
    dto: {
      contractedAmount: string;
      cancellationFee: string;
      finalSettlementAmount: string;
      totalOutflows: string;
      totalRefunds: string;
      netPaid: string;
      confirmedRemaining: string;
    };
  };
}

export const FX02_CANCELLED_SERVICE: Fx02CancelledServiceFixture = {
  costItem: {
    id: 'c0000000-0000-4000-8000-000000000001',
    name: 'Dịch vụ Chụp ảnh & Phóng sự Cưới Diamond',
    categoryId: 'ca000000-0000-4000-8000-000000000003',
    eventId: null,
    vendorName: 'Studio Nghệ Thuật Ánh Sáng',
    vendorPhone: '0988776655',
    vendorContact: 'Anh Hoàng (Chủ studio)',
    estimatedAmount: 25_000_000n,
    contractedAmount: 25_000_000n,
    finalSettlementAmount: 3_000_000n,
    status: 'cancelled',
    cancellationFee: 3_000_000n,
    cancellationNotes:
      'Hủy hợp đồng do gia đình đổi kế hoạch chụp ngoại cảnh; studio giữ 3.000.000đ phí đặt cọc và hoàn trả 7.000.000đ theo 2 đợt.',
    notes: 'Biên bản thỏa thuận chấm dứt hợp đồng ký ngày 2027-05-28',
    version: 3,
  },
  schedules: [
    {
      id: '21000000-0000-4000-8000-000000000001',
      costItemId: 'c0000000-0000-4000-8000-000000000001',
      installmentNumber: 1,
      title: 'Đặt cọc đợt 1 khi ký hợp đồng',
      amountDue: 10_000_000n,
      dueDate: '2027-05-10',
      status: 'agreed',
      notes: 'Đã thanh toán đủ',
      version: 1,
    },
    {
      id: '21000000-0000-4000-8000-000000000002',
      costItemId: 'c0000000-0000-4000-8000-000000000001',
      installmentNumber: 2,
      title: 'Thanh toán đợt 2 sau ngày chụp pre-wedding',
      amountDue: 10_000_000n,
      dueDate: '2027-08-01',
      status: 'cancelled',
      notes: 'Hủy bỏ do hợp đồng đã chấm dứt',
      version: 2,
    },
    {
      id: '21000000-0000-4000-8000-000000000003',
      costItemId: 'c0000000-0000-4000-8000-000000000001',
      installmentNumber: 3,
      title: 'Quyết toán đợt cuối khi nhận toàn bộ album',
      amountDue: 5_000_000n,
      dueDate: '2027-10-01',
      status: 'cancelled',
      notes: 'Hủy bỏ do hợp đồng đã chấm dứt',
      version: 2,
    },
  ],
  initialPayment: {
    id: '22000000-0000-4000-8000-000000000001',
    costItemId: 'c0000000-0000-4000-8000-000000000001',
    paymentType: 'outflow',
    amount: 10_000_000n,
    transactionTime: '2027-05-10T10:00:00Z',
    paymentMethod: 'bank_transfer',
    payerName: 'Chú rể',
    recipientName: 'Studio Nghệ Thuật Ánh Sáng',
    parentPaymentId: null,
    isDirectThirdParty: false,
    notes: 'Chuyển khoản cọc đợt 1 qua Vietcombank',
    isVoided: false,
    version: 1,
  },
  initialAllocation: {
    id: '23000000-0000-4000-8000-000000000001',
    paymentId: '22000000-0000-4000-8000-000000000001',
    scheduleId: '21000000-0000-4000-8000-000000000001',
    allocatedAmount: 10_000_000n,
  },
  refundInstallment1: {
    id: '22000000-0000-4000-8000-000000000002',
    costItemId: 'c0000000-0000-4000-8000-000000000001',
    paymentType: 'refund',
    amount: 5_000_000n,
    transactionTime: '2027-06-01T14:30:00Z',
    paymentMethod: 'bank_transfer',
    payerName: 'Studio Nghệ Thuật Ánh Sáng',
    recipientName: 'Chú rể',
    parentPaymentId: '22000000-0000-4000-8000-000000000001',
    isDirectThirdParty: false,
    notes: 'Hoàn tiền cọc đợt 1 từ studio',
    isVoided: false,
    version: 1,
  },
  refundInstallment2: {
    id: '22000000-0000-4000-8000-000000000003',
    costItemId: 'c0000000-0000-4000-8000-000000000001',
    paymentType: 'refund',
    amount: 2_000_000n,
    transactionTime: '2027-06-15T09:15:00Z',
    paymentMethod: 'bank_transfer',
    payerName: 'Studio Nghệ Thuật Ánh Sáng',
    recipientName: 'Chú rể',
    parentPaymentId: '22000000-0000-4000-8000-000000000001',
    isDirectThirdParty: false,
    notes: 'Hoàn tiền cọc đợt 2 (tất toán nghĩa vụ hoàn tiền)',
    isVoided: false,
    version: 1,
  },
  expectedCalculations: {
    totalOutflows: 10_000_000n,
    totalRefunds: 7_000_000n,
    netPaid: 3_000_000n,
    finalSettlement: 3_000_000n,
    confirmedRemaining: 0n,
    surplusPaid: 0n,
    remainingRefundableAmount: 3_000_000n,
    effectiveCancellationCost: 3_000_000n,
    dto: {
      contractedAmount: '25000000',
      cancellationFee: '3000000',
      finalSettlementAmount: '3000000',
      totalOutflows: '10000000',
      totalRefunds: '7000000',
      netPaid: '3000000',
      confirmedRemaining: '0',
    },
  },
};
