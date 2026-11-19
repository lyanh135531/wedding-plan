'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { formatVND } from '@/lib/utils';
import { Info, Calendar } from 'lucide-react';

const h = React.createElement;

export interface OpeningCutoffBannerProps {
  openingDate?: string;
  openingBalance?: bigint;
  preOpeningExpensesTotal?: bigint;
}

export const OpeningCutoffBanner: React.FC<OpeningCutoffBannerProps> = ({
  openingDate = '01/10/2026',
  openingBalance = 100000000n,
  preOpeningExpensesTotal = 10000000n,
}) => {
  const { isOwner } = useRole();

  if (!isOwner) return null;

  return h(
    'div',
    {
      className:
        'p-4 bg-page border border-border-control/60 rounded-card mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm text-text-main',
      role: 'region',
      'aria-label': 'Mốc mở sổ quỹ và tiền đặt cọc trước mốc',
    },
    h(
      'div',
      { className: 'flex items-start gap-3' },
      h(Calendar, { className: 'w-5 h-5 text-primary shrink-0 mt-0.5' }),
      h(
        'div',
        null,
        h(
          'p',
          { className: 'font-semibold text-text-main' },
          `Mốc mở sổ quỹ: ${openingDate} (Số dư ban đầu: ${formatVND(openingBalance)})`
        ),
        h(
          'p',
          { className: 'text-xs text-text-muted mt-0.5 max-w-2xl' },
          `Các khoản cọc trước ngày mở sổ (${formatVND(preOpeningExpensesTotal)}) đã được tính vào tổng chi đám cưới nhưng `,
          h('span', { className: 'font-semibold text-text-main' }, 'không bị trừ lần hai'),
          ` khỏi số dư tiền mặt đầu kỳ.`
        )
      )
    ),
    h(
      'div',
      { className: 'shrink-0 px-2.5 py-1 bg-surface border border-border-subtle rounded text-xs text-primary font-medium' },
      'FX03: Khớp sổ quỹ'
    )
  );
};
