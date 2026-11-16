'use client';

import * as React from 'react';
import { MealSummary } from './types';
import { Utensils, Baby, Leaf, AlertCircle, ShieldPlus, Users } from 'lucide-react';

const h = React.createElement;

export interface MealBreakdownDashboardProps {
  summary: MealSummary;
  className?: string;
}

export const MealBreakdownDashboard: React.FC<MealBreakdownDashboardProps> = ({
  summary,
  className = '',
}) => {
  const bufferDelta = summary.totalMeals - summary.confirmedGuests;

  return h(
    'div',
    { className: `space-y-4 ${className}`, 'data-testid': 'meal-breakdown-dashboard' },

    // Top summary banner
    h(
      'div',
      {
        className:
          'p-4 bg-surface border border-border-subtle rounded-card shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4',
      },
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h(
          'div',
          { className: 'w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0' },
          h(Utensils, { className: 'w-5 h-5' })
        ),
        h(
          'div',
          null,
          h('h2', { className: 'text-sm font-bold text-text-main' }, 'Thống Kê Suất Ăn & Đối Chiếu RSVP'),
          h(
            'p',
            { className: 'text-xs text-text-muted mt-0.5' },
            `Tổng ${summary.totalMeals} suất đặt nhà hàng phục vụ ${summary.confirmedGuests} khách mời đã xác nhận tham dự.`
          )
        )
      ),

      // Buffer delta badge
      h(
        'div',
        { className: 'flex items-center gap-2 self-start md:self-auto' },
        h(
          'div',
          {
            className: `px-3 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 ${
              bufferDelta >= 0
                ? 'bg-[#F0FDF4] text-[#15803D] border border-[#86EFAC]'
                : 'bg-danger-bg text-danger border border-danger/40'
            }`,
          },
          h(ShieldPlus, { className: 'w-4 h-4' }),
          bufferDelta >= 0
            ? `Dự phòng an toàn +${bufferDelta} suất (+${Math.round(
                (bufferDelta / (summary.confirmedGuests || 1)) * 100
              )}%)`
            : `Thiếu hụt ${Math.abs(bufferDelta)} suất so với khách dự!`
        )
      )
    ),

    // Grid of breakdown cards
    h(
      'div',
      { className: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3' },

      // 1. Adult Meals
      h(
        'div',
        { className: 'p-3 bg-surface border border-border-subtle rounded-card' },
        h(
          'div',
          { className: 'flex items-center justify-between text-text-muted text-xs' },
          h('span', null, 'Người lớn'),
          h(Users, { className: 'w-3.5 h-3.5 text-text-muted' })
        ),
        h('p', { className: 'text-xl font-bold text-text-main mt-1' }, summary.adultMeals),
        h('p', { className: 'text-[11px] text-text-muted mt-0.5' }, 'suất tiêu chuẩn')
      ),

      // 2. Child Meals
      h(
        'div',
        { className: 'p-3 bg-surface border border-border-subtle rounded-card' },
        h(
          'div',
          { className: 'flex items-center justify-between text-text-muted text-xs' },
          h('span', null, 'Trẻ em'),
          h(Baby, { className: 'w-3.5 h-3.5 text-[#2563EB]' })
        ),
        h('p', { className: 'text-xl font-bold text-[#1D4ED8] mt-1' }, summary.childMeals),
        h('p', { className: 'text-[11px] text-text-muted mt-0.5' }, 'suất riêng em bé')
      ),

      // 3. Vegetarian Meals
      h(
        'div',
        { className: 'p-3 bg-surface border border-border-subtle rounded-card' },
        h(
          'div',
          { className: 'flex items-center justify-between text-text-muted text-xs' },
          h('span', null, 'Ăn chay'),
          h(Leaf, { className: 'w-3.5 h-3.5 text-[#059669]' })
        ),
        h('p', { className: 'text-xl font-bold text-[#059669] mt-1' }, summary.vegetarianMeals),
        h('p', { className: 'text-[11px] text-text-muted mt-0.5' }, 'thuần thực vật')
      ),

      // 4. Special / Allergy Meals
      h(
        'div',
        { className: 'p-3 bg-surface border border-border-subtle rounded-card' },
        h(
          'div',
          { className: 'flex items-center justify-between text-text-muted text-xs' },
          h('span', null, 'Dị ứng/Kiêng'),
          h(AlertCircle, { className: 'w-3.5 h-3.5 text-[#D97706]' })
        ),
        h('p', { className: 'text-xl font-bold text-[#B45309] mt-1' }, summary.specialMeals),
        h('p', { className: 'text-[11px] text-text-muted mt-0.5' }, 'kiêng hải sản/mè...')
      ),

      // 5. Buffer Meals
      h(
        'div',
        { className: 'p-3 bg-surface border border-border-subtle rounded-card' },
        h(
          'div',
          { className: 'flex items-center justify-between text-text-muted text-xs' },
          h('span', null, 'Dự phòng'),
          h(ShieldPlus, { className: 'w-3.5 h-3.5 text-primary' })
        ),
        h('p', { className: 'text-xl font-bold text-primary mt-1' }, summary.bufferMeals),
        h('p', { className: 'text-[11px] text-text-muted mt-0.5' }, 'bàn/suất phòng hờ')
      ),

      // 6. Total Confirmed Guests
      h(
        'div',
        { className: 'p-3 bg-[#FAF9F5] border border-primary/30 rounded-card' },
        h(
          'div',
          { className: 'flex items-center justify-between text-primary text-xs font-semibold' },
          h('span', null, 'RSVP xác nhận'),
          h(Users, { className: 'w-3.5 h-3.5 text-primary' })
        ),
        h('p', { className: 'text-xl font-bold text-text-main mt-1' }, summary.confirmedGuests),
        h('p', { className: 'text-[11px] text-text-muted mt-0.5' }, 'khách tham dự')
      )
    )
  );
};
