'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { StatCard } from '@/components/ui/stat-card';
import { formatVND } from '@/lib/utils';
import { DollarSign, Wallet, CheckCircle2, Clock } from 'lucide-react';

const h = React.createElement;

export interface BudgetOverviewCardsProps {
  targetBudget?: bigint | null;
  projectedCost?: bigint;
  netPaid?: bigint;
  remainingDue?: bigint;
  missingPricesCount?: number;
}

export const BudgetOverviewCards: React.FC<BudgetOverviewCardsProps> = ({
  targetBudget = 300000000n,
  projectedCost = 265000000n,
  netPaid = 120000000n,
  remainingDue = 145000000n,
  missingPricesCount = 1,
}) => {
  const { isOwner } = useRole();

  // Family View STRICTLY receives null (UXT16)
  if (!isOwner) return null;

  const isProvisional = missingPricesCount > 0;

  return h(
    'div',
    {
      className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6',
      'aria-label': 'Chỉ số ngân sách và tiến độ thanh toán',
    },
    // Target Budget
    h(StatCard, {
      label: 'Ngân sách dự kiến',
      value: targetBudget ? formatVND(targetBudget) : null,
      status: targetBudget ? 'ready' : 'empty',
      scopeDescription: 'Mục tiêu tài chính trần',
      icon: h(Wallet, { className: 'w-4 h-4 text-primary' }),
      className: 'h-full min-h-[120px]',
    }),

    // Projected Obligation (with provisional warning if missing price)
    h(StatCard, {
      label: 'Tổng chi dự báo',
      value: formatVND(projectedCost),
      status: isProvisional ? 'provisional' : 'ready',
      provisionalNote: `Tạm tính — còn ${missingPricesCount} khoản thiếu giá`,
      scopeDescription: 'Giá chốt & ước tính hợp đồng',
      icon: h(DollarSign, { className: 'w-4 h-4 text-primary' }),
      className: 'h-full min-h-[120px]',
    }),

    // Net Paid
    h(StatCard, {
      label: 'Đã thanh toán (thực tế)',
      value: formatVND(netPaid),
      scopeDescription: 'Tổng chi trừ các khoản hoàn tiền',
      icon: h(CheckCircle2, { className: 'w-4 h-4 text-[#2E7D32]' }),
      className: 'h-full min-h-[120px]',
    }),

    // Remaining Due
    h(StatCard, {
      label: 'Còn phải thanh toán',
      value: formatVND(remainingDue),
      scopeDescription: 'Nghĩa vụ các đợt tới',
      icon: h(Clock, { className: 'w-4 h-4 text-[#D97706]' }),
      className: 'h-full min-h-[120px]',
    })
  );
};
