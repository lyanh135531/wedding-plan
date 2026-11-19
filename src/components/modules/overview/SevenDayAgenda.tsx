'use client';

import * as React from 'react';
import Link from 'next/link.js';
import { Calendar as CalendarIcon, Clock, ArrowRight } from 'lucide-react';

const h = React.createElement;

export interface AgendaItem {
  id: string;
  dayLabel: string;
  time: string;
  title: string;
  location?: string;
}

export const DEFAULT_AGENDA_ITEMS: AgendaItem[] = [
  {
    id: 'ag-1',
    dayLabel: 'Hôm nay',
    time: '18:30',
    title: 'Thử váy cưới & đo vest chú rể',
    location: 'Áo cưới Hoàng Gia, Q.3',
  },
  {
    id: 'ag-2',
    dayLabel: 'Ngày mai',
    time: '09:00',
    title: 'Họp thống nhất kịch bản MC & Ban nhạc',
    location: 'Quán Cafe The Daily',
  },
  {
    id: 'ag-3',
    dayLabel: 'Chủ nhật',
    time: '14:00',
    title: 'Duyệt mẫu thiệp in & phong bì lần cuối',
    location: 'Xưởng in Tân Phú',
  },
];

export interface SevenDayAgendaProps {
  items?: AgendaItem[];
}

export const SevenDayAgenda: React.FC<SevenDayAgendaProps> = ({
  items = DEFAULT_AGENDA_ITEMS,
}) => {
  return h(
    'div',
    {
      className:
        'bg-surface border border-border-subtle rounded-card shadow-sm p-5 flex flex-col justify-between h-full',
    },
    h(
      'div',
      null,
      h(
        'div',
        { className: 'flex items-center justify-between border-b border-border-subtle pb-3 mb-4' },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(CalendarIcon, { className: 'w-5 h-5 text-primary' }),
          h('h2', { className: 'text-base font-bold text-text-main' }, 'Lịch trình 7 ngày tới')
        ),
        h(
          Link,
          {
            href: '/calendar',
            className: 'text-xs text-primary hover:underline font-medium flex items-center gap-1',
          },
          'Xem lịch',
          h(ArrowRight, { className: 'w-3 h-3' })
        )
      ),

      items.length === 0
        ? h(
            'div',
            { className: 'py-8 text-center text-sm text-text-muted' },
            'Không có lịch hẹn hoặc sự kiện nào trong 7 ngày tới.'
          )
        : h(
            'div',
            { className: 'space-y-3' },
            items.map((item) =>
              h(
                'div',
                {
                  key: item.id,
                  className: 'p-3 rounded-control border border-border-subtle bg-surface text-left',
                },
                h(
                  'div',
                  { className: 'flex items-center justify-between gap-2 mb-1' },
                  h(
                    'span',
                    {
                      className: `text-xs font-semibold px-2 py-0.5 rounded ${
                        item.dayLabel === 'Hôm nay'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-page text-text-muted border border-border-subtle'
                      }`,
                    },
                    item.dayLabel
                  ),
                  h(
                    'span',
                    { className: 'text-xs font-mono text-text-muted flex items-center gap-1' },
                    h(Clock, { className: 'w-3 h-3' }),
                    item.time
                  )
                ),
                h('p', { className: 'text-sm font-semibold text-text-main mt-1' }, item.title),
                item.location &&
                  h('p', { className: 'text-xs text-text-muted mt-0.5 truncate' }, `📍 ${item.location}`)
              )
            )
          )
    )
  );
};
