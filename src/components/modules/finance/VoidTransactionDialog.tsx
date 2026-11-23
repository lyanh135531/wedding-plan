'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/dialog';
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
    ModalDialog,
    {
      isOpen,
      onClose,
      title: 'Hủy ghi nhận giao dịch (Void)',
      maxWidth: 'sm',
      footer: h(
        'div',
        { className: 'flex items-center justify-end gap-3 w-full' },
        h(
          Button,
          {
            type: 'button',
            variant: 'secondary',
            onClick: onClose,
          },
          'Hủy bỏ'
        ),
        h(
          Button,
          {
            type: 'button',
            variant: 'danger',
            onClick: handleConfirm,
          },
          'Xác nhận hủy giao dịch'
        )
      ),
    },
    h(
      'div',
      { className: 'space-y-4' },
      h(
        'div',
        { className: 'flex items-start gap-3 p-3 bg-danger-bg border border-danger/30 rounded-control text-xs text-danger leading-relaxed' },
        h(AlertOctagon, { className: 'w-4 h-4 shrink-0 mt-0.5' }),
        h(
          'span',
          null,
          `Bạn đang hủy ghi nhận giao dịch `,
          h('span', { className: 'font-mono font-bold' }, formatVND(transactionAmount)),
          ` ngày ${transactionDate}. Giao dịch này sẽ bị loại khỏi các số liệu tính toán nhưng vẫn lưu vết kiểm toán.`
        )
      ),
      h(TextInput, {
        label: 'Lý do hủy ghi nhận (bắt buộc)',
        value: reason,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value),
        placeholder: 'Ví dụ: Nhập sai số tiền, sai tài khoản...',
        required: true,
      })
    )
  );
};
