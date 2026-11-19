'use client';

import * as React from 'react';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { Calendar as CalendarIcon, Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

const h = React.createElement;

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // e.g. "2026-11-15"
  time: string;
  location?: string;
  type: 'appointment' | 'ceremony' | 'deadline';
}

export const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [
  { id: 'ev-1', title: 'Thử trang phục cưới & đo vest', date: '2026-11-06', time: '18:30', location: 'Áo cưới Hoàng Gia', type: 'appointment' },
  { id: 'ev-2', title: 'Họp thống nhất kịch bản MC & Ban nhạc', date: '2026-11-07', time: '09:00', location: 'The Daily Cafe', type: 'appointment' },
  { id: 'ev-3', title: 'Hạn thanh toán cọc đợt 2 sảnh tiệc', date: '2026-11-09', time: '17:00', type: 'deadline' },
  { id: 'ev-4', title: 'Lễ Ăn Hỏi & Trao Duyên', date: '2026-11-20', time: '08:00', location: 'Tư gia Nhà Gái', type: 'ceremony' },
  { id: 'ev-5', title: 'Tiệc Cưới Chính thức', date: '2026-11-29', time: '17:30', location: 'White Palace', type: 'ceremony' },
];

export interface CalendarAgendaViewProps {
  initialState?: PrototypeState;
}

export const CalendarAgendaView: React.FC<CalendarAgendaViewProps> = ({
  initialState = 'populated',
}) => {
  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [events, setEvents] = React.useState<CalendarEvent[]>(INITIAL_CALENDAR_EVENTS);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const loadingSkeleton = h(
    'div',
    { className: 'space-y-4 animate-pulse', role: 'status', 'aria-label': 'Đang tải lịch' },
    h('div', { className: 'h-12 bg-border-subtle rounded-control' }),
    h('div', { className: 'h-96 bg-border-subtle rounded-card' })
  );

  return h(
    StateWrapper,
    {
      state,
      loadingSkeleton,
      emptyTitle: 'Chưa có sự kiện hoặc lịch hẹn nào',
      emptyDescription: 'Lên lịch các buổi thử váy cưới, gặp gỡ nhà cung cấp hoặc các mốc quan trọng.',
      emptyActionLabel: '+ Thêm lịch hẹn',
      onEmptyAction: () => {
        setEvents(INITIAL_CALENDAR_EVENTS);
        setState('populated');
      },
      errorTitle: 'Không thể tải lịch trình',
      errorMessage: 'Lỗi truy xuất lịch hẹn từ hệ thống.',
      errorRequestId: 'REQ-20261106-CAL-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không có sự kiện nào trong tháng này',
      filteredDescription: 'Hãy chuyển sang tháng khác để xem lịch trình.',
      onClearFilter: () => setState('populated'),
      permissionDeniedMessage: 'Bạn không có quyền truy cập vào lịch hẹn nội bộ.',
    },
    h(
      'div',
      { className: 'space-y-6 max-w-7xl mx-auto' },
      // Header
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Lịch Hẹn & Tiến Độ'),
          h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Theo dõi dòng thời gian và các cuộc hẹn nhà cung cấp')
        ),
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(
            'button',
            { className: 'p-2 border border-border-control rounded-control hover:bg-page', 'aria-label': 'Tháng trước' },
            h(ChevronLeft, { className: 'w-4 h-4 text-text-main' })
          ),
          h('span', { className: 'text-sm font-semibold px-2' }, 'Tháng 11, 2026'),
          h(
            'button',
            { className: 'p-2 border border-border-control rounded-control hover:bg-page', 'aria-label': 'Tháng sau' },
            h(ChevronRight, { className: 'w-4 h-4 text-text-main' })
          )
        )
      ),

      // Desktop Calendar Month View (Hidden on mobile)
      h(
        'div',
        { className: 'hidden md:block bg-surface border border-border-subtle rounded-card shadow-sm p-4' },
        h(
          'div',
          { className: 'grid grid-cols-7 gap-px bg-border-subtle rounded overflow-hidden text-center text-xs' },
          ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'].map((d) =>
            h('div', { key: d, className: 'bg-page p-2.5 font-bold text-text-muted uppercase' }, d)
          ),
          // Days grid mock
          Array.from({ length: 35 }).map((_, idx) => {
            const dayNum = idx - 1; // start offset
            const isCurrentMonth = dayNum >= 1 && dayNum <= 30;
            const dayEvents = isCurrentMonth
              ? events.filter((e) => e.date.endsWith(`-${String(dayNum).padStart(2, '0')}`))
              : [];

            return h(
              'div',
              {
                key: idx,
                className: `bg-surface p-2 min-h-[90px] text-left flex flex-col justify-between ${
                  !isCurrentMonth ? 'bg-page/40 text-text-muted/40' : ''
                }`,
              },
              h('span', { className: 'font-semibold text-xs tabular-nums' }, isCurrentMonth ? dayNum : ''),
              dayEvents.length > 0 &&
                h(
                  'div',
                  { className: 'space-y-1 mt-1' },
                  dayEvents.map((ev) =>
                    h(
                      'div',
                      {
                        key: ev.id,
                        className: `px-1.5 py-0.5 rounded text-[11px] truncate font-medium ${
                          ev.type === 'ceremony'
                            ? 'bg-[#2E7D32]/10 text-[#2E7D32]'
                            : ev.type === 'deadline'
                            ? 'bg-danger-bg text-danger'
                            : 'bg-primary/10 text-primary'
                        }`,
                        title: `${ev.time} - ${ev.title}`,
                      },
                      `${ev.time} ${ev.title}`
                    )
                  )
                )
            );
          })
        )
      ),

      // Mobile Agenda List View (Reflow for <= 768px)
      h(
        'div',
        { className: 'md:hidden space-y-3' },
        h('h2', { className: 'text-sm font-bold text-text-main' }, 'Lịch trình sắp tới:'),
        events.map((ev) =>
          h(
            'div',
            {
              key: ev.id,
              className: 'p-3.5 bg-surface border border-border-subtle rounded-card shadow-sm space-y-1.5',
            },
            h(
              'div',
              { className: 'flex items-center justify-between' },
              h(
                'span',
                { className: 'text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary' },
                ev.date
              ),
              h(
                'span',
                { className: 'text-xs font-mono text-text-muted flex items-center gap-1' },
                h(Clock, { className: 'w-3 h-3' }),
                ev.time
              )
            ),
            h('p', { className: 'font-semibold text-sm text-text-main' }, ev.title),
            ev.location &&
              h(
                'p',
                { className: 'text-xs text-text-muted flex items-center gap-1' },
                h(MapPin, { className: 'w-3 h-3 text-primary' }),
                ev.location
              )
          )
        )
      )
    )
  );
};
