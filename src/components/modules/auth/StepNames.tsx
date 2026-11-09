'use client';

import * as React from 'react';
import { TextInput } from '@/components/ui/input';

const h = React.createElement;

export interface StepNamesProps {
  groomName: string;
  brideName: string;
  onChangeGroom: (val: string) => void;
  onChangeBride: (val: string) => void;
  errors?: { groom?: string; bride?: string };
}

export const StepNames: React.FC<StepNamesProps> = ({
  groomName,
  brideName,
  onChangeGroom,
  onChangeBride,
  errors = {},
}) => {
  return h(
    'div',
    { className: 'space-y-5' },
    h(
      'div',
      { className: 'text-left mb-4' },
      h('h2', { className: 'text-lg font-semibold text-text-main' }, 'Bước 1: Thông tin đôi uyên ương'),
      h(
        'p',
        { className: 'text-sm text-text-muted mt-1' },
        'Vui lòng nhập họ và tên của Chú rể và Cô dâu để cá nhân hóa toàn bộ sổ cưới.'
      )
    ),

    h(TextInput, {
      label: 'Họ và tên Chú rể',
      value: groomName,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChangeGroom(e.target.value),
      placeholder: 'Ví dụ: Nguyễn Văn Minh',
      required: true,
      error: errors.groom,
    }),

    h(TextInput, {
      label: 'Họ và tên Cô dâu',
      value: brideName,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChangeBride(e.target.value),
      placeholder: 'Ví dụ: Trần Phương Linh',
      required: true,
      error: errors.bride,
    })
  );
};
