'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { ModalDialog } from '@/components/ui/dialog';
import { Calendar, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

const h = React.createElement;

export interface RescheduleDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate?: string;
  onConfirmReschedule: (newDate: string) => void;
}

export const RescheduleDateModal: React.FC<RescheduleDateModalProps> = ({
  isOpen,
  onClose,
  currentDate = '15/12/2026',
  onConfirmReschedule,
}) => {
  const [newDate, setNewDate] = React.useState<string | null>('29/12/2026');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!newDate) return;
    onConfirmReschedule(newDate);
    onClose();
  };

  return h(
    ModalDialog,
    {
      isOpen,
      onClose,
      title: 'Dời ngày cưới & Xem trước tác động',
      maxWidth: 'lg',
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
            variant: 'primary',
            onClick: handleConfirm,
          },
          'Xác nhận đổi ngày'
        )
      ),
    },
    h(
      'div',
      { className: 'space-y-4' },
      h(
        'div',
        { className: 'p-3 bg-page border border-border-subtle rounded flex items-center justify-between text-xs' },
        h('span', null, `Ngày hiện tại: `, h('span', { className: 'font-semibold' }, currentDate)),
        h('span', { className: 'text-primary font-medium' }, '→ Đang chọn ngày mới')
      ),

      h(DatePicker, {
        label: 'Ngày cưới mới (+14 ngày)',
        value: newDate,
        onChange: setNewDate,
        required: true,
      }),

      // 3-category impact preview (UXT11)
      h(
        'div',
        { className: 'space-y-2.5 pt-2' },
        h('h3', { className: 'text-xs font-semibold uppercase text-text-muted tracking-wider' }, 'Bản đồ tác động hạn chót công việc (3 nhóm):'),

        // Group 1: Relative tasks
        h(
          'div',
          { className: 'p-3 bg-[#E8F5E9] border border-[#A5D6A7] rounded-control flex items-start gap-2.5 text-xs text-[#1B5E20]' },
          h(RefreshCw, { className: 'w-4 h-4 text-[#2E7D32] shrink-0 mt-0.5' }),
          h(
            'div',
            null,
            h('span', { className: 'font-bold block' }, 'Nhóm 1: Tự động tính lại theo ngày mới (8 công việc)'),
            h('span', { className: 'text-[11px] block mt-0.5' }, 'Các công việc có hạn tương đối (ví dụ: "7 ngày trước lễ") sẽ tự động tịnh tiến sang ngày mới.')
          )
        ),

        // Group 2: Fixed date tasks
        h(
          'div',
          { className: 'p-3 bg-page border border-border-subtle rounded-control flex items-start gap-2.5 text-xs text-text-main' },
          h(CheckCircle2, { className: 'w-4 h-4 text-text-muted shrink-0 mt-0.5' }),
          h(
            'div',
            null,
            h('span', { className: 'font-bold block' }, 'Nhóm 2: Giữ nguyên ngày cố định (5 công việc)'),
            h('span', { className: 'text-[11px] text-text-muted block mt-0.5' }, 'Các công việc hẹn lịch cố định với studio/xưởng in không bị thay đổi.')
          )
        ),

        // Group 3: Potential conflicts
        h(
          'div',
          { className: 'p-3 bg-[#FFF8E1] border border-[#F59E0B] rounded-control flex items-start gap-2.5 text-xs text-[#B45309]' },
          h(AlertTriangle, { className: 'w-4 h-4 text-[#D97706] shrink-0 mt-0.5' }),
          h(
            'div',
            null,
            h('span', { className: 'font-bold block' }, 'Nhóm 3: Cần kiểm tra lại thủ công (2 công việc)'),
            h('span', { className: 'text-[11px] block mt-0.5' }, 'Hợp đồng sảnh tiệc và đặt cọc xe cưới cần xác nhận lại tình trạng trống sảnh.')
          )
        )
      )
    )
  );
};
