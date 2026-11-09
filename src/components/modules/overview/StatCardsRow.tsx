'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { StatCard } from '@/components/ui/stat-card';
import { formatVND } from '@/lib/utils';
import { DollarSign, CheckCircle2, Clock, Users } from 'lucide-react';

const h = React.createElement;

export interface StatCardsRowProps {
  projectedCost?: bigint;
  netPaid?: bigint;
  remainingDue?: bigint;
  missingPricesCount?: number;
  confirmedGuests?: number;
  totalInvited?: number;
  attendanceInstancesCount?: number;
}

export const StatCardsRow: React.FC<StatCardsRowProps> = ({
  projectedCost = 265000000n,
  netPaid = 120000000n,
  remainingDue = 145000000n,
  missingPricesCount = 1,
  confirmedGuests = 142,
  totalInvited = 180,
  attendanceInstancesCount = 210,
}) => {
  const { isOwner } = useRole();

  // Financial metrics are STRICTLY 100% removed from DOM for Family View
  if (!isOwner) {
    return null;
  }

  const isProvisional = missingPricesCount > 0;

  return h(
    'div',
    {
      className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6',
      'aria-label': 'Chỉ số tài chính và khách mời tổng quan',
    },
    // Card 1: Chi dự báo (với nhãn tạm tính nếu có khoản thiếu giá)
    h(StatCard, {
      label: 'Chi dự báo',
      value: formatVND(projectedCost),
      status: isProvisional ? 'provisional' : 'ready',
      provisionalNote: `Tạm tính — còn ${missingPricesCount} khoản thiếu giá`,
      scopeDescription: 'Tổng toàn bộ đám cưới',
      icon: h(DollarSign, { className: 'w-4 h-4 text-primary' }),
      href: '/budget',
      className: 'h-full min-h-[120px]',
    }),

    // Card 2: Đã thanh toán
    h(StatCard, {
      label: 'Đã thanh toán',
      value: formatVND(netPaid),
      scopeDescription: 'Tiền mặt & Chuyển khoản',
      icon: h(CheckCircle2, { className: 'w-4 h-4 text-[#2E7D32]' }),
      href: '/payments',
      className: 'h-full min-h-[120px]',
    }),

    // Card 3: Còn phải chi
    h(StatCard, {
      label: 'Còn phải chi',
      value: formatVND(remainingDue),
      scopeDescription: 'Các đợt thanh toán tới',
      icon: h(Clock, { className: 'w-4 h-4 text-[#D97706]' }),
      href: '/budget',
      className: 'h-full min-h-[120px]',
    }),

    // Card 4: Khách xác nhận
    h(StatCard, {
      label: 'Khách xác nhận',
      value: `${confirmedGuests} / ${totalInvited}`,
      unit: 'người',
      scopeDescription: `Tổng ${attendanceInstancesCount} lượt tham dự các buổi`,
      icon: h(Users, { className: 'w-4 h-4 text-primary' }),
      href: '/guests',
      className: 'h-full min-h-[120px]',
    })
  );
};
