'use client';

import * as React from 'react';
import { api } from '@/lib/api/request';
import { weddingDateKey } from '@/lib/dates';
import { TextInput } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/components/common/usePagination';
import { AppointmentsWorkspace } from './AppointmentsWorkspace';
import { CalendarDays } from 'lucide-react';

const h = React.createElement;
interface CalendarItem { id: string; title: string; dateTime: string; location?: string; itemType: string }
export function LiveCalendarView() {
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [items, setItems] = React.useState<CalendarItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  const pagination = usePagination(items, { defaultPageSize: 20, resetKey: `${start}:${end}` });
  React.useEffect(() => {
    const today = new Date();
    setStart(weddingDateKey(new Date(today.getTime() - 7 * 86400000)));
    setEnd(weddingDateKey(new Date(today.getTime() + 30 * 86400000)));
  }, []);
  React.useEffect(() => {
    if (!start || !end) return;
    if (end < start) { setError('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.'); return; }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({ startDate: `${start}T00:00:00+07:00`, endDate: `${end}T23:59:59.999+07:00` });
    api<{ data: CalendarItem[] }>(`/api/v1/calendar?${query}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setItems(result.data); })
      .catch((failure) => { if (!controller.signal.aborted) setError((failure as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [start, end, revision]);
  return h('div', { className: 'space-y-5' },
    h('div', null, h('p', { className: 'eyebrow mb-3' }, 'Những cột mốc cùng nhau'), h('h1', { className: 'text-[28px] sm:text-[32px] font-medium' }, 'Lịch hẹn & ngày quan trọng')),
    h('div', { className: 'surface-card p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl' },
      h(TextInput, { label: 'Từ ngày', type: 'date', value: start, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setStart(event.target.value) }),
      h(TextInput, { label: 'Đến ngày', type: 'date', value: end, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setEnd(event.target.value) }),
    ),
    h(AppointmentsWorkspace, { onChanged: () => setRevision(value=>value+1) }),
    h('a', { href: '/api/v1/export/calendar.ics', className: 'inline-flex min-h-[44px] items-center text-primary underline' }, 'Tải lịch .ics'),
    error && h(Alert, { variant: 'danger', action: { label: 'Thử lại', onClick: () => setRevision((value) => value + 1) } }, error),
    !error && (loading ? h('p', { role: 'status' }, 'Đang tải lịch...') : items.length ?
      h(React.Fragment, null,
        h('ul', { className: 'space-y-3' }, pagination.pagedItems.map((item) => h('li', { key: item.id, className: 'bg-surface border rounded-card p-4 space-y-1' },
          h('h2', { className: 'font-semibold break-words' }, h('a', { className: 'underline', href: item.itemType === 'task' ? '/tasks' : item.itemType === 'payment_schedule' ? '/payments' : '/calendar' }, item.title)),
          h('p', { className: 'text-sm text-text-muted' }, new Date(item.dateTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })),
          item.location && h('p', { className: 'text-sm' }, item.location),
        ))),
        h(Pagination, { currentPage: pagination.currentPage, pageSize: pagination.pageSize, totalItems: pagination.totalItems, onPageChange: pagination.setCurrentPage, onPageSizeChange: pagination.setPageSize, pageSizeOptions: [10, 20, 50], unitLabel: 'sự kiện' }),
      ) : h(EmptyState, { title: 'Chưa có lịch trong khoảng ngày này', description: 'Các cuộc hẹn, buổi lễ và hạn công việc sẽ được tập hợp tại đây. Bạn có thể chọn một khoảng thời gian khác để xem.', icon: h(CalendarDays, { className: 'w-7 h-7 text-accent', strokeWidth: 1.4 }) })),
  );
}
