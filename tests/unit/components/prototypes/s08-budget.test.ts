import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { BudgetOverviewCards } from '@/components/modules/finance/BudgetOverviewCards';
import { CostItemsTable, CostItemRow } from '@/components/modules/finance/CostItemsTable';
import { CreateCostModal } from '@/components/modules/finance/CreateCostModal';
import { RecordPaymentModal } from '@/components/modules/finance/RecordPaymentModal';
import { RefundTransactionModal } from '@/components/modules/finance/RefundTransactionModal';
import { VoidTransactionDialog } from '@/components/modules/finance/VoidTransactionDialog';
import { OpeningCutoffBanner } from '@/components/modules/finance/OpeningCutoffBanner';
import { BudgetScreen } from '@/components/modules/finance/BudgetScreen';
import { PaymentsLedgerScreen } from '@/components/modules/finance/PaymentsLedgerScreen';
import { formatVND } from '@/lib/utils';

const h = React.createElement;

describe('S08 & S10: Budget & Payments Financial Precision Prototype', () => {
  it('enforces native BigInt VND formatting formatVND strictly', () => {
    expect(formatVND(15000000n)).toBe('15.000.000 ₫');
    expect(formatVND(0n)).toBe('0 ₫');
    expect(formatVND(null)).toBe('Chưa nhập');
  });

  it('BudgetOverviewCards appends provisional warning when missing prices exist (UXT06)', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'owner' },
        h(BudgetOverviewCards, {
          targetBudget: 300000000n,
          projectedCost: 265000000n,
          netPaid: 120000000n,
          remainingDue: 145000000n,
          missingPricesCount: 2,
        })
      )
    );

    expect(html).toContain('Tổng chi dự báo');
    expect(html).toContain('265.000.000 ₫');
    expect(html).toContain('Tạm tính — còn 2 khoản thiếu giá');
  });

  it('CostItemsTable displays Thiếu giá badge for items without finalized pricing (UXT06)', () => {
    const mockItems: CostItemRow[] = [
      { id: '1', name: 'Sảnh tiệc cưới', category: 'Tiệc cưới', contractedAmount: 180000000n, paidAmount: 80000000n, status: 'contracted', isMissingPrice: false },
      { id: '2', name: 'Ban nhạc acoustic', category: 'Âm thanh', contractedAmount: null, paidAmount: 0n, status: 'draft', isMissingPrice: true },
    ];

    const html = renderToStaticMarkup(
      h(CostItemsTable, { items: mockItems })
    );

    expect(html).toContain('180.000.000 ₫');
    expect(html).toContain('Thiếu giá');
    expect(html).toContain('Ban nhạc acoustic');
  });

  it('RecordPaymentModal supports Idempotency Key lock and Paid-by-Other classification (UXT07)', () => {
    const html = renderToStaticMarkup(
      h(RecordPaymentModal, {
        isOpen: true,
        onClose: () => {},
        costItemName: 'Sảnh tiệc cưới',
        defaultAmount: 50000000n,
        onSubmit: () => {},
      })
    );

    expect(html).toContain('Ghi nhận thanh toán chi tiền');
    expect(html).toContain('50.000.000 ₫');
    expect(html).toContain('Khóa chống submit trùng lặp (Idempotency Key v4) được kích hoạt');
    expect(html).toContain('Người khác trả hộ');
    expect(html).toContain('Xác nhận chi 50.000.000 ₫');
  });

  it('RefundTransactionModal supports cancelled vendor settlement and refund flow FX02 (UXT08)', () => {
    const html = renderToStaticMarkup(
      h(RefundTransactionModal, {
        isOpen: true,
        onClose: () => {},
        originalOutflowAmount: 5000000n,
        vendorName: 'Áo cưới Hoàng Gia (Hủy hợp đồng - FX02)',
        onConfirmRefund: () => {},
      })
    );

    expect(html).toContain('Ghi nhận hoàn tiền từ nhà cung cấp');
    expect(html).toContain('5.000.000 ₫');
    expect(html).toContain('3.500.000'); // Refund amount
    expect(html).toContain('Xác nhận hoàn tiền');
  });

  it('VoidTransactionDialog supports erroneous entry reversal without trace removal (UXT08)', () => {
    const html = renderToStaticMarkup(
      h(VoidTransactionDialog, {
        isOpen: true,
        onClose: () => {},
        transactionAmount: 10000000n,
        transactionDate: '2026-11-04',
        onConfirmVoid: () => {},
      })
    );

    expect(html).toContain('Hủy ghi nhận giao dịch (Void)');
    expect(html).toContain('10.000.000 ₫');
    expect(html).toContain('Lý do hủy ghi nhận (bắt buộc)');
    expect(html).toContain('Xác nhận hủy giao dịch');
  });

  it('OpeningCutoffBanner confirms opening fund anchor date and pre-opening deposit non-deduction (UXT09)', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'owner' },
        h(OpeningCutoffBanner, {
          openingDate: '01/10/2026',
          openingBalance: 100000000n,
          preOpeningExpensesTotal: 10000000n,
        })
      )
    );

    expect(html).toContain('Mốc mở sổ quỹ: 01/10/2026');
    expect(html).toContain('100.000.000 ₫');
    expect(html).toContain('không bị trừ lần hai');
    expect(html).toContain('10.000.000 ₫');
  });

  it('BudgetScreen strictly yields 403 PermissionDeniedView when accessed by Family View', () => {
    const familyHtml = renderToStaticMarkup(
      h(RoleProvider, { initialRole: 'family_view' }, h(BudgetScreen, null))
    );

    expect(familyHtml).toContain('Bạn không có quyền truy cập');
    expect(familyHtml).toContain('Mục Ngân sách và Sổ quỹ chỉ dành riêng cho hai Chủ sở hữu đám cưới');
    // Financial numbers must never leak!
    expect(familyHtml).not.toContain('265.000.000 ₫');
    expect(familyHtml).not.toContain('300.000.000 ₫');
  });

  it('PaymentsLedgerScreen strictly yields 403 when accessed by Family View', () => {
    const familyHtml = renderToStaticMarkup(
      h(RoleProvider, { initialRole: 'family_view' }, h(PaymentsLedgerScreen, null))
    );

    expect(familyHtml).toContain('Bạn không có quyền truy cập');
    expect(familyHtml).toContain('Sổ chi tiền và nhật ký giao dịch chỉ dành riêng cho Chủ sở hữu đám cưới');
  });
});
