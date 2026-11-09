'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { TextInput } from '@/components/ui/input';
import { Send, CheckCircle2 } from 'lucide-react';

const h = React.createElement;

export interface BulkMarkSentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onConfirm: (sentDate: string, senderName: string) => void;
}

export const BulkMarkSentDialog: React.FC<BulkMarkSentDialogProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onConfirm,
}) => {
  const [sentDate, setSentDate] = React.useState<string | null>('2026-11-06');
  const [senderName, setSenderName] = React.useState('Chú rể');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentDate) return;
    onConfirm(sentDate, senderName);
    onClose();
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'bulk-sent-title',
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
          h(Send, { className: 'w-5 h-5 text-primary' }),
          h('h2', { id: 'bulk-sent-title', className: 'text-base font-bold' }, 'Đánh dấu thiệp đã gửi')
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
          'p',
          { className: 'text-xs text-text-muted' },
          `Bạn đang đánh dấu `,
          h('span', { className: 'font-semibold text-text-main' }, `${selectedCount} thiệp mời`),
          ` sang trạng thái Đã gửi.`
        ),

        // Tripartite invariant reminder (UXT05 / FL04)
        h(
          'div',
          { className: 'p-3 bg-primary/10 border border-primary/20 rounded text-xs text-text-main' },
          h('p', { className: 'font-semibold mb-0.5' }, '📌 Quy tắc bất biến:'),
          h(
            'p',
            null,
            'Đánh dấu thiệp đã gửi chỉ cập nhật tiến độ chuyển phát thiệp, hoàn toàn không tự ý thay đổi trạng thái phản hồi tham dự (RSVP) của khách mời.'
          )
        ),

        h(DatePicker, {
          label: 'Ngày gửi thiệp',
          value: sentDate,
          onChange: setSentDate,
          required: true,
        }),

        h(TextInput, {
          label: 'Người phụ trách chuyển thiệp',
          value: senderName,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSenderName(e.target.value),
          placeholder: 'Ví dụ: Chú rể, Bố mẹ nhà trai...',
        }),

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
            },
            'Hủy bỏ'
          ),
          h(
            Button,
            {
              type: 'submit',
              variant: 'primary',
            },
            `Xác nhận gửi (${selectedCount} thiệp)`
          )
        )
      )
    )
  );
};
