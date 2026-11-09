'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { formatVND } from '@/lib/utils';
import { AlertOctagon } from 'lucide-react';

const h = React.createElement;

export interface VoidTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transactionAmount?: bigint;
  transactionDate?: string;
  onConfirmVoid: (reason: string) => void;
}

export const VoidTransactionDialog: React.FC<VoidTransactionDialogProps> = ({
  isOpen,
  onClose,
  transactionAmount = 5000000n,
  transactionDate = '2026-11-06',
  onConfirmVoid,
}) => {
  const [reason, setReason] = React.useState('Nhập nhầm giao dịch trùng lặp');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirmVoid(reason);
    onClose();
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'void-title',
    },
    h(
      'div',
      {
        className:
          'bg-surface w-full max-w-md rounded-card border border-danger/40 shadow-2xl p-6 text-text-main',
      },
      h(
        'div',
        { className: 'flex items-center gap-3 mb-3' },
        h(
          'div',
          { className: 'w-10 h-10 rounded-full bg-danger-bg text-danger flex items-center justify-center shrink-0' },
          h(AlertOctagon, { className: 'w-5 h-5' })
        ),
        h('h2', { id: 'void-title', className: 'text-base font-bold text-text-main' }, 'Hủy ghi nhận giao dịch (Void)')
      ),

      h(
        'p',
        { className: 'text-xs text-text-muted mb-4' },
        `Bạn đang hủy ghi nhận giao dịch `,
        h('span', { className: 'font-mono font-bold text-text-main' }, formatVND(transactionAmount)),
        ` ngày ${transactionDate}. Giao dịch này sẽ bị loại khỏi các số liệu tính toán nhưng vẫn lưu vết kiểm toán.`
      ),

      h(TextInput, {
        label: 'Lý do hủy ghi nhận (bắt buộc)',
        value: reason,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value),
        placeholder: 'Ví dụ: Nhập sai số tiền, sai tài khoản...',
        required: true,
      }),

      h(
        'div',
        { className: 'flex items-center justify-end gap-3 pt-4 mt-4 border-t border-border-subtle' },
        h(
          Button,
          {
            variant: 'secondary',
            onClick: onClose,
          },
          'Hủy bỏ'
        ),
        h(
          Button,
          {
            variant: 'danger',
            onClick: handleConfirm,
          },
          'Xác nhận hủy giao dịch'
        )
      )
    )
  );
};
