'use client';

import * as React from 'react';
import { api, allPages, jsonBody } from '@/lib/api/request';
import { useRole } from '@/context/RoleContext';
import { useEventScope } from '@/context/EventScopeContext';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskActions } from './TaskActions';
import { CheckSquare } from 'lucide-react';

const h = React.createElement;
interface Task {
  id: string; title: string; status: string; version: number;
  eventId?: string | null; event_id?: string | null;
  computed_due_date: string | null; is_waiting_official_date: boolean;
}
const statuses = { not_started: 'Chưa bắt đầu', in_progress: 'Đang thực hiện', blocked: 'Đang vướng', completed: 'Đã hoàn thành', cancelled: 'Đã hủy' };
const selectClass = 'w-full min-h-[44px] border border-border-control rounded-control bg-surface px-3 py-2';

export function LiveTasksManager() {
  const { isOwner } = useRole();
  const { currentScope, availableEvents } = useEventScope();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const busy = React.useRef(false);
  const [title, setTitle] = React.useState('');
  const [eventId, setEventId] = React.useState('');
  const [date, setDate] = React.useState('');
  const [relative, setRelative] = React.useState(false);
  const [offset, setOffset] = React.useState('7');
  const [shared, setShared] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    allPages<Task>('/api/v1/tasks').then((data) => { if (!cancelled) setTasks(data); })
      .catch((failure) => { if (!cancelled) setError((failure as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);
  const visible = tasks.filter((task) => currentScope === 'all' || (currentScope === 'common'
    ? !(task.eventId || task.event_id) : (task.eventId || task.event_id) === currentScope));
  const mutate = async (operation: () => Promise<unknown>) => {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    setError(null);
    try { await operation(); setRevision((value) => value + 1); return true; }
    catch (failure) { setError((failure as Error).message); return false; }
    finally { busy.current = false; setSaving(false); }
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const saved = await mutate(() => api('/api/v1/tasks', { method: 'POST', body: jsonBody({
      title, event_id: eventId || null, deadline_type: relative ? 'relative_to_event' : 'fixed_date',
      fixed_date: relative ? null : date, relative_event_id: relative ? eventId : null,
      relative_offset_days: relative ? Number(offset) : null, relative_direction: 'before',
      shared_with_family: shared, shared_public_title: shared ? title : null,
    }) }));
    if (saved) { setCreating(false); setTitle(''); setDate(''); }
  };
  return h('div', { className: 'space-y-5' },
    h('div', { className: 'flex justify-between items-center gap-3' },
      h('div', null, h('p', { className: 'eyebrow mb-3' }, 'Từng bước, cùng nhau'), h('h1', { className: 'text-[28px] sm:text-[32px] font-medium' }, 'Danh sách công việc')),
      isOwner && h(Button, { disabled: loading || saving, onClick: () => setCreating((value) => !value) }, creating ? 'Đóng biểu mẫu' : 'Thêm công việc'),
    ),
    error && h(Alert, { variant: 'danger', action: { label: 'Tải lại', onClick: () => { setError(null); setRevision((value) => value + 1); } } }, error),
    creating && isOwner && h('form', { onSubmit: create, className: 'bg-surface rounded-card border p-5 space-y-4' },
      h(TextInput, { label: 'Tiêu đề công việc', required: true, value: title, maxLength: 200, disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setTitle(event.target.value) }),
      h('label', { className: 'block space-y-1' }, 'Buổi lễ liên quan', h('select', { className: selectClass, value: eventId, required: relative, disabled: saving, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => setEventId(event.target.value) },
        h('option', { value: '' }, 'Công việc chung'), ...availableEvents.filter((item) => !item.isCancelled).map((item) => h('option', { key: item.id, value: item.id }, item.name)))),
      h('label', { className: 'flex gap-2 items-center min-h-[44px]' }, h('input', { type: 'checkbox', checked: relative, disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setRelative(event.target.checked) }), 'Tính hạn theo ngày buổi lễ'),
      relative ? h(TextInput, { label: 'Số ngày trước buổi lễ', type: 'number', min: 0, max: 3650, required: true, value: offset, disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setOffset(event.target.value) }) :
        h(TextInput, { label: 'Hạn hoàn thành', type: 'date', required: true, value: date, disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDate(event.target.value) }),
      h('label', { className: 'flex gap-2 items-center min-h-[44px]' }, h('input', { type: 'checkbox', checked: shared, disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setShared(event.target.checked) }), 'Chia sẻ công việc này với người nhà'),
      h(Button, { type: 'submit', loading: saving }, 'Lưu công việc'),
    ),
    loading ? h('p', { role: 'status' }, 'Đang tải công việc...') : visible.length ? h('ul', { className: 'space-y-3' }, visible.map((task) => h('li', { key: task.id, 'data-testid': `task-${task.id}`, className: 'bg-surface border rounded-card p-4 space-y-2' },
      h('h3', { className: 'font-semibold break-words' }, task.title),
      isOwner && h(TaskActions, { id: task.id, choices: tasks, reload: () => setRevision(v=>v+1) }),
      h('p', { className: 'text-sm text-text-muted' }, task.is_waiting_official_date ? 'Hạn sẽ được tính khi chốt ngày buổi lễ' : task.computed_due_date ? `Hạn: ${new Date(task.computed_due_date).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Chưa có hạn'),
      isOwner ? h('select', { className: selectClass, 'aria-label': `Trạng thái ${task.title}`, value: task.status, disabled: saving, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
        void mutate(() => api(`/api/v1/tasks/${task.id}/status`, { method: 'PATCH', body: jsonBody({ status: event.target.value, version: task.version }) }));
      } }, Object.entries(statuses).map(([value, label]) => h('option', { key: value, value }, label))) : h('p', null, statuses[task.status as keyof typeof statuses] || task.status),
    ))) : h(EmptyState, { title: 'Chăm chút từng việc, thong thả đón ngày vui', description: 'Tạo công việc, chọn hạn hoàn thành và cùng gia đình theo dõi từng bước chuẩn bị.', icon: h(CheckSquare, { className: 'w-7 h-7 text-accent', strokeWidth: 1.4 }), action: isOwner ? { label: 'Tạo công việc đầu tiên', onClick: () => setCreating(true) } : undefined }),
  );
}
