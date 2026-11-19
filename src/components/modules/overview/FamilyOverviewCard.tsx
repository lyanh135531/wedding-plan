'use client';

import * as React from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Calendar, MapPin, Users, HeartHandshake } from 'lucide-react';

const h = React.createElement;

export interface FamilyOverviewCardProps {
  weddingDateNote?: string;
  venues?: Array<{ name: string; address: string; time: string }>;
  sharedTasksCount?: number;
}

export const FamilyOverviewCard: React.FC<FamilyOverviewCardProps> = ({
  weddingDateNote = 'Dự kiến sau Tết âm lịch 2028',
  venues = [
    { name: 'Lễ Gia Tiên & Rước Dâu', address: 'Tư gia Nhà Gái & Nhà Trai', time: '08:00 — 11:30' },
    { name: 'Tiệc Cưới Chính', address: 'Trung tâm Hội nghị Tiệc cưới White Palace, Q. Phú Nhuận', time: '17:30 — 21:30' },
  ],
  sharedTasksCount = 5,
}) => {
  return h(
    'div',
    {
      className:
        'bg-surface border border-border-subtle rounded-card shadow-sm p-6 mb-6 text-text-main',
      'aria-label': 'Thông tin lịch trình và địa điểm dành cho người nhà',
    },
    h(
      'div',
      { className: 'flex items-center justify-between border-b border-border-subtle pb-4 mb-5' },
      h(
        'div',
        null,
        h('h2', { className: 'text-lg font-bold text-text-main' }, 'Lịch trình & Địa điểm tổ chức'),
        h('p', { className: 'text-xs text-text-muted mt-0.5' }, 'Thông tin chính thức dành cho gia đình hai bên')
      ),
      h(StatusBadge, { variant: 'warning', text: 'Chỉ xem' })
    ),

    h(
      'div',
      { className: 'grid grid-cols-1 md:grid-cols-3 gap-4 mb-6' },
      // Date card
      h(
        'div',
        { className: 'p-4 bg-page border border-border-subtle rounded-control flex items-start gap-3' },
        h(Calendar, { className: 'w-5 h-5 text-primary shrink-0 mt-0.5' }),
        h(
          'div',
          null,
          h('span', { className: 'text-xs text-text-muted block' }, 'Thời gian tổ chức:'),
          h('span', { className: 'font-semibold text-sm text-text-main block mt-0.5' }, weddingDateNote)
        )
      ),
      // Shared Tasks card
      h(
        'div',
        { className: 'p-4 bg-page border border-border-subtle rounded-control flex items-start gap-3' },
        h(HeartHandshake, { className: 'w-5 h-5 text-primary shrink-0 mt-0.5' }),
        h(
          'div',
          null,
          h('span', { className: 'text-xs text-text-muted block' }, 'Việc phân công người nhà:'),
          h('span', { className: 'font-semibold text-sm text-text-main block mt-0.5' }, `${sharedTasksCount} công việc`)
        )
      ),
      // Contacts card
      h(
        'div',
        { className: 'p-4 bg-page border border-border-subtle rounded-control flex items-start gap-3' },
        h(Users, { className: 'w-5 h-5 text-primary shrink-0 mt-0.5' }),
        h(
          'div',
          null,
          h('span', { className: 'text-xs text-text-muted block' }, 'Đội ngũ hỗ trợ:'),
          h('span', { className: 'font-semibold text-sm text-text-main block mt-0.5' }, 'Đã chỉ định trưởng đoàn')
        )
      )
    ),

    // Venues list
    h(
      'div',
      { className: 'space-y-3' },
      h('h3', { className: 'text-xs font-semibold uppercase text-text-muted tracking-wider' }, 'Địa điểm & Buổi lễ'),
      venues.map((venue, idx) =>
        h(
          'div',
          {
            key: idx,
            className: 'p-3 bg-surface border border-border-control/60 rounded-control flex items-start gap-3',
          },
          h(MapPin, { className: 'w-4 h-4 text-primary shrink-0 mt-1' }),
          h(
            'div',
            { className: 'flex-1' },
            h(
              'div',
              { className: 'flex justify-between items-baseline gap-2' },
              h('span', { className: 'font-semibold text-sm text-text-main' }, venue.name),
              h('span', { className: 'text-xs font-mono text-primary font-medium' }, venue.time)
            ),
            h('p', { className: 'text-xs text-text-muted mt-0.5' }, venue.address)
          )
        )
      )
    )
  );
};
