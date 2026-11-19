import * as React from 'react';
import { cn } from '@/lib/utils';

const h = React.createElement;

export interface PrintViewProps {
  title: string;
  subtitle?: string;
  timestamp?: string;
  children?: React.ReactNode;
  className?: string;
}

export const PrintView: React.FC<PrintViewProps> = ({
  title,
  subtitle,
  timestamp,
  children,
  className,
}) => {
  const printTimestamp =
    timestamp ||
    new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
    });

  return h(
    'div',
    {
      className: cn(
        'w-full bg-surface text-black p-8 print:p-0 print:m-0 max-w-4xl mx-auto',
        'print:[&_.no-print]:hidden',
        className
      ),
    },
    // Print Header
    h(
      'div',
      {
        className:
          'border-b-2 border-black pb-4 mb-6 flex items-start justify-between',
      },
      h(
        'div',
        null,
        h('h1', { className: 'text-2xl font-bold tracking-tight text-black' }, title),
        subtitle && h('p', { className: 'text-sm text-gray-700 mt-1' }, subtitle)
      ),
      h(
        'div',
        { className: 'text-right text-xs text-gray-600' },
        h('p', null, `Thời điểm in: ${printTimestamp}`),
        h('p', { className: 'mt-0.5' }, 'Múi giờ: Asia/Ho_Chi_Minh (GMT+7)')
      )
    ),
    // Main Print Body
    h('div', { className: 'print:break-inside-auto' }, children),
    // Print Footer
    h(
      'div',
      {
        className:
          'mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500 hidden print:block',
      },
      'Trang in tự động từ Hệ thống Quản Lý Đám Cưới'
    )
  );
};
