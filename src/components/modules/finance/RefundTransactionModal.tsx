'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import { TextInput } from '@/components/ui/input';
import { formatVND } from '@/lib/utils';
import { RotateCcw } from 'lucide-react';

const h = React.createElement;

export interface RefundTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalOutflowAmount?: bigint;
  vendorName?: string;
  onConfirmRefund: (refundAmount: bigint, refundDate: string, reason: string) => void;
}

export const RefundTransactionModal: React.FC<RefundTransactionModalProps> = ({
  isOpen,
  onClose,
  originalOutflowAmount = 5000000n,
  vendorName = 'Áo cưới Hoàng Gia (Hủy hợp đồng)',
  onConfirmRefund,
}) => {
  // FX02 canonical: Deposit 5M, penalty 1.5M -> Refund 3.5M
  const [refundAmount, setRefundAmount] = React.useState<bigint | null>(3500000n);
  const [refundDate, setRefundDate] = React.useState<string | null>('2026-11-06');
  const [reason, setReason] = React.useState('Hoàn cọc sau khi trừ phạt hủy hợp đồng 1.500.000 ₫');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundAmount || refundAmount <= 0n || !refundDate) return;
    onConfirmRefund(refundAmount, refundDate, reason);
    onClose();
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'refund-title',
    },
    h(
      'div',
      {
        className:
          'bg-surface w-full max-w-md rounded-card border border-border-control shadow-2xl p-6 text-text-main',
      },
      h(
        'div',
        { className: 'flex items-center justify-between border-b border-border-subtle pb-3 mb-4' },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(RotateCcw, { className: 'w-5 h-5 text-primary' }),
          h('h2', { id: 'refund-title', className: 'text-base font-bold' }, 'Ghi nhận hoàn tiền từ nhà cung cấp')
        ),
        h(
          'button',
          {
            onClick: onClose,
            className: 'text-text-muted hover:text-text-main p-1 rounded',
            'aria-label': 'Đóng',
          },
          '✕'
        )
      ),

      h(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-4' },
        h(
          'div',
          { className: 'p-3 bg-[#FAF9F5] border border-border-subtle rounded text-xs space-y-1' },
          h('p', null, `Nhà cung cấp: `, h('span', { className: 'font-semibold text-text-main' }, vendorName)),
          h('p', null, `Khoản đã chi trước đó: `, h('span', { className: 'font-mono font-semibold text-text-main' }, formatVND(originalOutflowAmount)))
        ),

        h(CurrencyInput, {
          label: 'Số tiền hoàn lại thực nhận (VND)',
          value: refundAmount,
          onChange: setRefundAmount,
          required: true,
        }),

        h(DatePicker, {
          label: 'Ngày nhận tiền hoàn',
          value: refundDate,
          onChange: setRefundDate,
          required: true,
        }),

        h(TextInput, {
          label: 'Lý do hoàn tiền',
          value: reason,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value),
          required: true,
        }),

        h(
          'div',
          { className: 'flex items-center justify-end gap-3 pt-3 border-t border-border-subtle' },
          h(
            Button,
            {
              type: 'button',
              variant: 'secondary',
              onClick: onClose,
            },
            'Hủy'
          ),
          h(
            Button,
            {
              type: 'submit',
              variant: 'primary',
            },
            'Xác nhận hoàn tiền'
          )
        )
      )
    )
  );
};
