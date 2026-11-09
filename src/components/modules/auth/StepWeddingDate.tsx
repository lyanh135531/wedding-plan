'use client';

import * as React from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { TextInput } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const h = React.createElement;

export interface StepWeddingDateProps {
  weddingDate: string | null;
  isUnconfirmedDate: boolean;
  estimatedDateNote: string;
  onChangeDate: (date: string | null) => void;
  onChangeUnconfirmed: (unconfirmed: boolean) => void;
  onChangeEstimatedNote: (note: string) => void;
  errors?: { date?: string; note?: string };
}

export const StepWeddingDate: React.FC<StepWeddingDateProps> = ({
  weddingDate,
  isUnconfirmedDate,
  estimatedDateNote,
  onChangeDate,
  onChangeUnconfirmed,
  onChangeEstimatedNote,
  errors = {},
}) => {
  return h(
    'div',
    { className: 'space-y-5 text-left' },
    h(
      'div',
      { className: 'mb-4' },
      h('h2', { className: 'text-lg font-semibold text-text-main' }, 'Bước 2: Thời gian tổ chức'),
      h(
        'p',
        { className: 'text-sm text-text-muted mt-1' },
        'Chọn ngày cưới chính thức hoặc ghi chú thời gian dự kiến nếu hai bạn đang xem ngày.'
      )
    ),

    // Checkbox toggle: Chưa chốt ngày chính thức
    h(
      'div',
      { className: 'p-3 bg-[#FAF9F5] border border-border-subtle rounded-control' },
      h(Checkbox, {
        checked: isUnconfirmedDate,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          const checked = e.target.checked;
          onChangeUnconfirmed(checked);
          if (checked) {
            onChangeDate(null);
          }
        },
        label: 'Chưa chốt ngày cưới chính thức (đang xem ngày)',
      })
    ),

    // Conditional rendering based on isUnconfirmedDate
    isUnconfirmedDate
      ? h(
          'div',
          { className: 'space-y-3' },
          h(TextInput, {
            label: 'Ghi chú thời gian dự kiến',
            value: estimatedDateNote,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              onChangeEstimatedNote(e.target.value),
            placeholder: 'Ví dụ: Dự kiến sau Tết âm lịch 2028 / Cuối năm sau',
            helperText:
              'Hệ thống sẽ không tự gán ngày giả và không bật đồng hồ đếm ngược khi chưa có ngày chính thức.',
            error: errors.note,
          })
        )
      : h(
          'div',
          { className: 'space-y-3' },
          h(DatePicker, {
            label: 'Ngày cưới chính thức',
            value: weddingDate,
            onChange: onChangeDate,
            required: true,
            error: errors.date,
          })
        )
  );
};
