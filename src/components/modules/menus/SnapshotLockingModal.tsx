'use client';

import * as React from 'react';
import { MealSummary, CateringSnapshot } from './types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, ShieldCheck, AlertTriangle } from 'lucide-react';

const h = React.createElement;

export interface SnapshotLockingModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: MealSummary;
  onLockSnapshot: (notes?: string) => void;
}

export const SnapshotLockingModal: React.FC<SnapshotLockingModalProps> = ({
  isOpen,
  onClose,
  summary,
  onLockSnapshot,
}) => {
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!isOpen) return null;

  const handleConfirmLock = () => {
    setIsSubmitting(true);
    onLockSnapshot(notes);
    setIsSubmitting(false);
    onClose();
  };

  return h(
    Dialog,
    {
      isOpen,
      onClose,
      title: 'Chốt & Khóa Thực Đơn Tiệc Cưới (Snapshot AT52)',
    },
    h(
      'div',
      { className: 'space-y-4 text-xs' },

      // Warning message
      h(
        'div',
        {
          className:
            'p-3.5 bg-[#FFFBEB] border border-[#F59E0B] rounded-control flex items-start gap-2.5 text-[#92400E]',
        },
        h(AlertTriangle, { className: 'w-4 h-4 text-[#D97706] shrink-0 mt-0.5' }),
        h(
          'div',
          null,
          h('p', { className: 'font-bold' }, 'Lưu ý đóng băng dữ liệu suất ăn (AT52)'),
          h(
            'p',
            { className: 'mt-0.5 leading-relaxed' },
            'Sau khi khóa, toàn bộ số lượng suất ăn, danh mục món và suất dự phòng sẽ được cố định làm phụ lục hợp đồng bàn giao nhà hàng. Mọi phát sinh khách sau thời điểm này sẽ được đánh dấu phiên bản chênh lệch.'
          )
        )
      ),

      // Snapshot numbers summary
      h(
        'div',
        { className: 'bg-page p-3 rounded-control border border-border-subtle space-y-2' },
        h('h4', { className: 'font-bold text-text-main text-xs uppercase' }, 'Dữ liệu suất chốt bàn giao:'),
        h(
          'div',
          { className: 'grid grid-cols-2 gap-2 text-text-main' },
          h('div', null, '• Suất người lớn: ', h('strong', null, summary.adultMeals)),
          h('div', null, '• Suất trẻ em: ', h('strong', null, summary.childMeals)),
          h('div', null, '• Suất ăn chay: ', h('strong', null, summary.vegetarianMeals)),
          h('div', null, '• Suất ăn kiêng: ', h('strong', null, summary.specialMeals)),
          h('div', null, '• Suất dự phòng: ', h('strong', null, summary.bufferMeals)),
          h(
            'div',
            { className: 'col-span-2 pt-1 border-t border-border-subtle text-primary font-bold' },
            'Tổng cộng bàn giao: ',
            summary.totalMeals,
            ' suất (phục vụ ',
            summary.confirmedGuests,
            ' khách RSVP)'
          )
        )
      ),

      // Notes
      h(
        'div',
        { className: 'space-y-1' },
        h(
          'label',
          { className: 'block font-semibold text-text-main' },
          'Ghi chú bàn giao với đại diện sảnh tiệc'
        ),
        h('textarea', {
          value: notes,
          onChange: (e: any) => setNotes(e.target.value),
          rows: 2,
          placeholder: 'Ví dụ: Đã ký biên bản chốt số lượng với Quản lý sảnh tiệc Trống Đồng...',
          className:
            'w-full p-2 border border-border-control rounded-control text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary',
        })
      ),

      // Actions
      h(
        'div',
        { className: 'flex items-center justify-end gap-2 pt-3 border-t border-border-subtle' },
        h(
          Button,
          {
            type: 'button',
            variant: 'secondary',
            onClick: onClose,
            className: 'text-xs',
          },
          'Hủy'
        ),
        h(
          Button,
          {
            type: 'button',
            variant: 'primary',
            onClick: handleConfirmLock,
            disabled: isSubmitting,
            className: 'text-xs flex items-center gap-1.5 bg-[#B45309] hover:bg-[#92400E]',
          },
          h(Lock, { className: 'w-3.5 h-3.5' }),
          'Khóa thực đơn ngay'
        )
      )
    )
  );
};
