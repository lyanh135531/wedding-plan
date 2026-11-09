'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { TextInput } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { formatVND } from '@/lib/utils';
import { DollarSign, ShieldCheck } from 'lucide-react';

const h = React.createElement;

export interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  costItemName?: string;
  defaultAmount?: bigint;
  onSubmit: (payment: {
    amount: bigint;
    paidDate: string;
    payer: 'groom' | 'bride' | 'other';
    otherPaidType?: 'gift_non_refundable' | 'debt_obligation';
    method: 'cash' | 'transfer' | 'card';
    idempotencyKey: string;
  }) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  costItemName = 'Trung tâm tiệc cưới White Palace',
  defaultAmount = 5000000n,
  onSubmit,
}) => {
  const [amount, setAmount] = React.useState<bigint | null>(defaultAmount);
  const [paidDate, setPaidDate] = React.useState<string | null>('2026-11-06');
  const [payer, setPayer] = React.useState<'groom' | 'bride' | 'other'>('groom');
  const [otherPaidType, setOtherPaidType] = React.useState<'gift_non_refundable' | 'debt_obligation'>('gift_non_refundable');
  const [method, setMethod] = React.useState<'cash' | 'transfer' | 'card'>('transfer');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0n || !paidDate) return;

    // Generate Idempotency Key (UXT07)
    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    setIsSubmitting(true);

    // Simulate network submission with idempotency lock
    setTimeout(() => {
      onSubmit({
        amount,
        paidDate,
        payer,
        otherPaidType: payer === 'other' ? otherPaidType : undefined,
        method,
        idempotencyKey,
      });
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  const formattedConfirm = amount ? formatVND(amount) : '0 ₫';

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'record-payment-title',
    },
    h(
      'div',
      {
        className:
          'bg-surface w-full max-w-md rounded-card border border-border-control shadow-2xl p-6 text-text-main',
      },
      // Header
      h(
        'div',
        { className: 'flex items-center justify-between border-b border-border-subtle pb-3 mb-4' },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(DollarSign, { className: 'w-5 h-5 text-primary' }),
          h('h2', { id: 'record-payment-title', className: 'text-base font-bold' }, 'Ghi nhận thanh toán chi tiền')
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
          { className: 'p-3 bg-[#FAF9F5] border border-border-subtle rounded text-xs' },
          h('span', { className: 'text-text-muted block' }, 'Khoản chi liên kết:'),
          h('span', { className: 'font-semibold text-text-main text-sm mt-0.5 block' }, costItemName)
        ),

        // Amount Input
        h(CurrencyInput, {
          label: 'Số tiền thanh toán',
          value: amount,
          onChange: setAmount,
          required: true,
        }),

        // Date
        h(DatePicker, {
          label: 'Ngày thanh toán thực tế',
          value: paidDate,
          onChange: setPaidDate,
          required: true,
        }),

        // Payer Selection
        h(
          'div',
          null,
          h('label', { className: 'block text-xs font-medium text-text-muted mb-1' }, 'Người thực chi:'),
          h(
            'div',
            { className: 'grid grid-cols-3 gap-2' },
            (['groom', 'bride', 'other'] as const).map((p) => {
              const labels = { groom: 'Chú rể', bride: 'Cô dâu', other: 'Người khác trả hộ' };
              const isSelected = payer === p;
              return h(
                'button',
                {
                  key: p,
                  type: 'button',
                  onClick: () => setPayer(p),
                  className: `h-9 text-xs rounded border font-medium transition-colors ${
                    isSelected
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-main border-[#7A8881] hover:bg-[#F7F5F0]'
                  }`,
                },
                labels[p]
              );
            })
          )
        ),

        // If 'Người khác trả hộ', classify obligation (UXT07)
        payer === 'other' &&
          h(
            'div',
            { className: 'p-3 bg-[#FFF8E1] border border-[#F59E0B] rounded-control space-y-2 text-xs' },
            h('span', { className: 'font-semibold text-[#B45309] block' }, 'Phân loại chi phí người khác trả hộ:'),
            h(
              'label',
              { className: 'flex items-center gap-2 cursor-pointer' },
              h('input', {
                type: 'radio',
                name: 'otherPaidType',
                checked: otherPaidType === 'gift_non_refundable',
                onChange: () => setOtherPaidType('gift_non_refundable'),
                className: 'accent-primary',
              }),
              h('span', null, 'Góp không hoàn lại (Tăng nguồn tiền góp + ghi nhận chi)')
            ),
            h(
              'label',
              { className: 'flex items-center gap-2 cursor-pointer' },
              h('input', {
                type: 'radio',
                name: 'otherPaidType',
                checked: otherPaidType === 'debt_obligation',
                onChange: () => setOtherPaidType('debt_obligation'),
                className: 'accent-primary',
              }),
              h('span', null, 'Nghĩa vụ cần đối chiếu / trả lại sau')
            )
          ),

        // Method
        h(
          'div',
          null,
          h('label', { className: 'block text-xs font-medium text-text-muted mb-1' }, 'Hình thức:'),
          h(
            'select',
            {
              value: method,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setMethod(e.target.value as any),
              className: 'w-full h-9 px-2.5 text-xs bg-white border border-[#7A8881] rounded',
            },
            h('option', { value: 'transfer' }, 'Chuyển khoản ngân hàng'),
            h('option', { value: 'cash' }, 'Tiền mặt'),
            h('option', { value: 'card' }, 'Thẻ tín dụng / Ghi nợ')
          )
        ),

        // Idempotency guarantee note
        h(
          'div',
          { className: 'flex items-center gap-1.5 text-[11px] text-text-muted pt-1' },
          h(ShieldCheck, { className: 'w-3.5 h-3.5 text-primary' }),
          h('span', null, 'Khóa chống submit trùng lặp (Idempotency Key v4) được kích hoạt.')
        ),

        // Buttons
        h(
          'div',
          { className: 'flex items-center justify-end gap-3 pt-3 border-t border-border-subtle' },
          h(
            Button,
            {
              type: 'button',
              variant: 'secondary',
              onClick: onClose,
              disabled: isSubmitting,
            },
            'Hủy bỏ'
          ),
          h(
            Button,
            {
              type: 'submit',
              variant: 'primary',
              loading: isSubmitting,
              loadingText: 'Đang lưu...',
            },
            `Xác nhận chi ${formattedConfirm}`
          )
        )
      )
    )
  );
};
