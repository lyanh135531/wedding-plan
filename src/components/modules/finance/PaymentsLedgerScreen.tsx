'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatVND } from '@/lib/utils';
import { RefundTransactionModal } from './RefundTransactionModal';
import { VoidTransactionDialog } from './VoidTransactionDialog';
import { RecordPaymentModal } from './RecordPaymentModal';
import { ArrowDownLeft, ArrowUpRight, Plus, Ban, RotateCcw } from 'lucide-react';

const h = React.createElement;

export interface LedgerTransaction {
  id: string;
  type: 'outflow' | 'refund' | 'inflow';
  amount: bigint;
  date: string;
  payerOrPayee: string;
  costItemName: string;
  method: string;
  isVoided: boolean;
  voidReason?: string;
}

export const INITIAL_LEDGER: LedgerTransaction[] = [
  {
    id: 'tx-1',
    type: 'outflow',
    amount: 50000000n,
    date: '2026-10-15',
    payerOrPayee: 'Trung tâm tiệc cưới White Palace',
    costItemName: 'Sảnh tiệc cưới & Thực đơn',
    method: 'Chuyển khoản',
    isVoided: false,
  },
  {
    id: 'tx-2',
    type: 'outflow',
    amount: 20000000n,
    date: '2026-10-20',
    payerOrPayee: 'Studio Chụp Ảnh Cưới',
    costItemName: 'Gói chụp ảnh pre-wedding',
    method: 'Chuyển khoản',
    isVoided: false,
  },
  {
    id: 'tx-3',
    type: 'outflow',
    amount: 5000000n,
    date: '2026-10-25',
    payerOrPayee: 'Áo cưới Hoàng Gia (Tiền cọc)',
    costItemName: 'Áo cưới Hoàng Gia (FX02)',
    method: 'Tiền mặt',
    isVoided: false,
  },
  {
    id: 'tx-4',
    type: 'refund',
    amount: 3500000n,
    date: '2026-11-02',
    payerOrPayee: 'Áo cưới Hoàng Gia (Hoàn cọc)',
    costItemName: 'Áo cưới Hoàng Gia (FX02)',
    method: 'Chuyển khoản',
    isVoided: false,
  },
  {
    id: 'tx-5',
    type: 'outflow',
    amount: 10000000n,
    date: '2026-11-04',
    payerOrPayee: 'Xưởng in Tân Phú',
    costItemName: 'Thiệp cưới in ấn',
    method: 'Chuyển khoản',
    isVoided: true,
    voidReason: 'Nhập nhầm số tiền giao dịch',
  },
];

export interface PaymentsLedgerScreenProps {
  initialState?: PrototypeState;
}

export const PaymentsLedgerScreen: React.FC<PaymentsLedgerScreenProps> = ({
  initialState = 'populated',
}) => {
  const { isFamily } = useRole();
  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [transactions, setTransactions] = React.useState<LedgerTransaction[]>(INITIAL_LEDGER);

  // Modals
  const [isRecordOpen, setIsRecordOpen] = React.useState(false);
  const [refundTarget, setRefundTarget] = React.useState<LedgerTransaction | null>(null);
  const [voidTarget, setVoidTarget] = React.useState<LedgerTransaction | null>(null);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const effectiveState = isFamily ? 'permission_denied' : state;

  const handleRecordPayment = (paymentData: any) => {
    const newTx: LedgerTransaction = {
      id: `tx_${Date.now()}`,
      type: 'outflow',
      amount: paymentData.amount,
      date: paymentData.paidDate,
      payerOrPayee: paymentData.payer === 'groom' ? 'Chú rể' : paymentData.payer === 'bride' ? 'Cô dâu' : 'Người khác trả hộ',
      costItemName: 'Khoản thanh toán mới',
      method: paymentData.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt',
      isVoided: false,
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  const handleConfirmRefund = (refundAmount: bigint, refundDate: string, reason: string) => {
    if (!refundTarget) return;
    const refundTx: LedgerTransaction = {
      id: `ref_${Date.now()}`,
      type: 'refund',
      amount: refundAmount,
      date: refundDate,
      payerOrPayee: `${refundTarget.payerOrPayee} (Hoàn tiền)`,
      costItemName: refundTarget.costItemName,
      method: 'Chuyển khoản',
      isVoided: false,
    };
    setTransactions((prev) => [refundTx, ...prev]);
  };

  const handleConfirmVoid = (reason: string) => {
    if (!voidTarget) return;
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === voidTarget.id ? { ...tx, isVoided: true, voidReason: reason } : tx
      )
    );
  };

  // Loading skeleton
  const loadingSkeleton = h(
    'div',
    { className: 'space-y-4 animate-pulse', role: 'status', 'aria-label': 'Đang tải sổ chi' },
    h('div', { className: 'h-12 bg-border-subtle rounded-control' }),
    h('div', { className: 'space-y-2' },
      [1, 2, 3, 4, 5].map((i) => h('div', { key: i, className: 'h-16 bg-border-subtle rounded-control' }))
    )
  );

  return h(
    StateWrapper,
    {
      state: effectiveState,
      loadingSkeleton,
      emptyTitle: 'Chưa có giao dịch chi tiền nào',
      emptyDescription: 'Ghi nhận đợt đặt cọc hoặc thanh toán đầu tiên cho các nhà cung cấp.',
      emptyActionLabel: '+ Ghi nhận thanh toán',
      onEmptyAction: () => {
        setTransactions(INITIAL_LEDGER);
        setState('populated');
      },
      errorTitle: 'Lỗi truy xuất sổ nhật ký thanh toán',
      errorMessage: 'Không thể tải lịch sử giao dịch từ cơ sở dữ liệu.',
      errorRequestId: 'REQ-20261106-PAYMENTS-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không có giao dịch nào khớp với bộ lọc',
      filteredDescription: 'Hãy thử chọn mốc thời gian hoặc loại giao dịch khác.',
      onClearFilter: () => setState('populated'),
      permissionDeniedMessage:
        'Sổ chi tiền và nhật ký giao dịch chỉ dành riêng cho Chủ sở hữu đám cưới.',
    },
    h(
      'div',
      { className: 'space-y-6 max-w-7xl mx-auto' },
      // Header
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Sổ Chi Tiền & Nhật Ký Giao Dịch'),
          h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Ghi nhận chi, hoàn tiền và hủy giao dịch sai sót')
        ),
        h(
          Button,
          {
            variant: 'primary',
            leftIcon: h(Plus, { className: 'w-4 h-4' }),
            onClick: () => setIsRecordOpen(true),
          },
          '+ Ghi nhận chi tiền'
        )
      ),

      // Transactions Table
      h(
        'div',
        { className: 'w-full overflow-x-auto bg-surface border border-border-subtle rounded-card shadow-sm' },
        h(
          'table',
          { className: 'w-full text-left border-collapse text-sm', 'aria-label': 'Sổ nhật ký thanh toán chi tiết' },
          h(
            'thead',
            { className: 'bg-page border-b border-border-subtle text-xs font-semibold uppercase text-text-muted select-none' },
            h(
              'tr',
              null,
              h('th', { className: 'px-4 py-3.5' }, 'Ngày giao dịch'),
              h('th', { className: 'px-4 py-3.5' }, 'Loại giao dịch'),
              h('th', { className: 'px-4 py-3.5' }, 'Đối tượng / Nhà cung cấp'),
              h('th', { className: 'px-4 py-3.5' }, 'Hạng mục chi'),
              h('th', { className: 'px-4 py-3.5 text-right' }, 'Số tiền'),
              h('th', { className: 'px-4 py-3.5 text-right' }, 'Thao tác')
            )
          ),

          h(
            'tbody',
            { className: 'divide-y divide-border-subtle' },
            transactions.map((tx) => {
              const isRefund = tx.type === 'refund';
              const isVoided = tx.isVoided;

              return h(
                'tr',
                {
                  key: tx.id,
                  className: `hover:bg-page/70 transition-colors ${
                    isVoided ? 'opacity-50 line-through bg-black/[0.02]' : ''
                  }`,
                },
                // Date
                h(
                  'td',
                  { className: 'px-4 py-3 text-xs font-mono text-text-muted' },
                  tx.date
                ),

                // Type
                h(
                  'td',
                  { className: 'px-4 py-3' },
                  isVoided
                    ? h(StatusBadge, { variant: 'danger', text: 'Đã hủy (Void)' })
                    : isRefund
                    ? h(
                        'span',
                        { className: 'inline-flex items-center gap-1 text-xs font-semibold text-primary px-2 py-0.5 rounded bg-primary/10' },
                        h(RotateCcw, { className: 'w-3 h-3' }),
                        'Hoàn tiền'
                      )
                    : h(
                        'span',
                        { className: 'inline-flex items-center gap-1 text-xs font-semibold text-[#B91C1C] px-2 py-0.5 rounded bg-danger-bg' },
                        h(ArrowUpRight, { className: 'w-3 h-3' }),
                        'Chi tiền'
                      )
                ),

                // Payee
                h(
                  'td',
                  { className: 'px-4 py-3 font-medium text-text-main text-xs' },
                  tx.payerOrPayee
                ),

                // Item
                h(
                  'td',
                  { className: 'px-4 py-3 text-text-muted text-xs' },
                  tx.costItemName
                ),

                // Amount
                h(
                  'td',
                  {
                    className: `px-4 py-3 text-right tabular-nums font-semibold text-sm ${
                      isVoided
                        ? 'text-text-muted'
                        : isRefund
                        ? 'text-[#2E7D32]'
                        : 'text-text-main'
                    }`,
                  },
                  isRefund ? `+${formatVND(tx.amount)}` : `-${formatVND(tx.amount)}`
                ),

                // Actions
                h(
                  'td',
                  { className: 'px-4 py-3 text-right' },
                  !isVoided &&
                    h(
                      'div',
                      { className: 'flex items-center justify-end gap-2' },
                      // If it's an outflow, allow refund
                      !isRefund &&
                        h(
                          'button',
                          {
                            type: 'button',
                            onClick: () => setRefundTarget(tx),
                            className: 'p-1 text-xs text-primary hover:underline font-medium',
                            title: 'Hoàn tiền',
                          },
                          'Hoàn tiền'
                        ),
                      // Void button
                      h(
                        'button',
                        {
                          type: 'button',
                          onClick: () => setVoidTarget(tx),
                          className: 'p-1 text-xs text-danger hover:underline font-medium',
                          title: 'Hủy giao dịch do nhập sai',
                        },
                        'Hủy (Void)'
                      )
                    )
                )
              );
            })
          )
        )
      ),

      // Modals
      h(RecordPaymentModal, {
        isOpen: isRecordOpen,
        onClose: () => setIsRecordOpen(false),
        onSubmit: handleRecordPayment,
      }),

      refundTarget &&
        h(RefundTransactionModal, {
          isOpen: Boolean(refundTarget),
          onClose: () => setRefundTarget(null),
          originalOutflowAmount: refundTarget.amount,
          vendorName: refundTarget.payerOrPayee,
          onConfirmRefund: handleConfirmRefund,
        }),

      voidTarget &&
        h(VoidTransactionDialog, {
          isOpen: Boolean(voidTarget),
          onClose: () => setVoidTarget(null),
          transactionAmount: voidTarget.amount,
          transactionDate: voidTarget.date,
          onConfirmVoid: handleConfirmVoid,
        })
    )
  );
};
