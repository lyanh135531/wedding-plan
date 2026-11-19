'use client';

import * as React from 'react';
import { Sliders, Users, Calculator, Percent } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export interface CompareSimulationBarProps {
  tableCount: number;
  onTableCountChange: (tables: number) => void;
  guestCount: number;
  onGuestCountChange: (guests: number) => void;
  includeVatAndFee: boolean;
  onIncludeVatAndFeeChange: (include: boolean) => void;
}

export const CompareSimulationBar: React.FC<CompareSimulationBarProps> = ({
  tableCount,
  onTableCountChange,
  guestCount,
  onGuestCountChange,
  includeVatAndFee,
  onIncludeVatAndFeeChange,
}) => {
  return React.createElement(
    'div',
    {
      className:
        'bg-surface rounded-card p-5 border border-border-control/60 shadow-sm mb-6 space-y-4',
      role: 'region',
      'aria-label': 'Bảng điều khiển mô phỏng số bàn tiệc cưới',
    },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between gap-3 flex-wrap' },
      React.createElement(
        'div',
        { className: 'flex items-center gap-2' },
        React.createElement(Sliders, { className: 'w-5 h-5 text-primary', 'aria-hidden': 'true' }),
        React.createElement(
          'h2',
          { className: 'text-base font-bold text-text-main' },
          'Mô Phỏng Kịch Bản Bàn Tiệc & Chi Phí Thực Tế'
        )
      ),
      React.createElement(
        'span',
        {
          className:
            'text-xs text-text-muted bg-page px-2.5 py-1 rounded border border-border-subtle font-medium',
        },
        'Tự động chuẩn hóa trên cùng kịch bản (PLAN §11.2)'
      )
    ),

    React.createElement(
      'div',
      { className: 'grid grid-cols-1 md:grid-cols-3 gap-6 items-center pt-2' },
      // 1. Table Count Slider
      React.createElement(
        'div',
        { className: 'space-y-2' },
        React.createElement(
          'div',
          { className: 'flex justify-between items-center text-sm' },
          React.createElement(
            'label',
            { htmlFor: 'table-count-slider', className: 'font-semibold text-text-main flex items-center gap-1.5' },
            React.createElement(Calculator, { className: 'w-4 h-4 text-primary', 'aria-hidden': 'true' }),
            'Số bàn giả định:'
          ),
          React.createElement(
            'span',
            { className: 'text-base font-bold text-primary px-2.5 py-0.5 bg-primary/10 rounded' },
            `${tableCount} bàn`
          )
        ),
        React.createElement('input', {
          id: 'table-count-slider',
          type: 'range',
          min: 5,
          max: 100,
          step: 1,
          value: tableCount,
          onChange: (e) => {
            const val = Number(e.target.value);
            onTableCountChange(val);
            onGuestCountChange(val * 10);
          },
          className:
            'w-full h-2 bg-page rounded-lg appearance-none cursor-pointer accent-primary focus:outline-2 focus:outline-focus',
          'aria-valuemin': 5,
          'aria-valuemax': 100,
          'aria-valuenow': tableCount,
        }),
        React.createElement(
          'div',
          { className: 'flex justify-between text-[11px] text-text-muted' },
          React.createElement('span', null, '5 bàn'),
          React.createElement('span', null, '20 bàn (Chuẩn)'),
          React.createElement('span', null, '50 bàn'),
          React.createElement('span', null, '100 bàn')
        )
      ),

      // 2. Guest Count input
      React.createElement(
        'div',
        { className: 'space-y-1.5' },
        React.createElement(
          'label',
          { htmlFor: 'guest-count-input', className: 'block text-sm font-semibold text-text-main flex items-center gap-1.5' },
          React.createElement(Users, { className: 'w-4 h-4 text-primary', 'aria-hidden': 'true' }),
          'Số khách ước tính:'
        ),
        React.createElement('input', {
          id: 'guest-count-input',
          type: 'number',
          min: 10,
          max: 2000,
          value: guestCount,
          onChange: (e) => onGuestCountChange(Number(e.target.value) || 0),
          className:
            'w-full py-2 px-3 bg-page border border-border-control rounded-control text-base font-semibold text-text-main focus:outline-2 focus:outline-focus min-h-[44px]',
          'aria-label': 'Số lượng khách giả định',
        }),
        React.createElement(
          'p',
          { className: 'text-[11px] text-text-muted' },
          `Tương đương trung bình ${(guestCount / Math.max(1, tableCount)).toFixed(1)} khách/bàn`
        )
      ),

      // 3. VAT & Service Charge Toggle
      React.createElement(
        'div',
        { className: 'p-3 bg-page rounded border border-border-subtle space-y-1.5' },
        React.createElement(Checkbox, {
          label: React.createElement(
            'span',
            { className: 'font-semibold text-sm text-text-main' },
            'Tính kèm VAT (10%) & Phí phục vụ (5%)'
          ),
          description:
            'Áp dụng ước tính tự động nếu đơn giá bàn tiệc của sảnh chưa bao gồm thuế phí.',
          checked: includeVatAndFee,
          onChange: (e) => onIncludeVatAndFeeChange(e.target.checked),
        })
      )
    )
  );
};
