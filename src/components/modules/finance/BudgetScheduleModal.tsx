'use client';

import * as React from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { TextInput } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { CalendarInput } from '@/components/ui/calendar-input';
import { StatusBadge } from '@/components/ui/status-badge';
import { api, jsonBody } from '@/lib/api/request';
import { formatVND } from '@/lib/utils';
import type { BudgetCost } from './budgetHelpers';

interface ScheduleRecord {
  id: string;
  installmentNumber: number;
  title: string;
  amountDue: string;
  dueDate: string;
  status: 'estimated' | 'agreed' | 'cancelled';
  notes: string | null;
  version: number;
}

export interface BudgetScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  cost: BudgetCost | null;
  onSaved: (message: string) => Promise<void>;
}

const SCHEDULE_STATUS_MAP = {
  estimated: { variant: 'warning' as const, label: 'Dự kiến' },
  agreed: { variant: 'info' as const, label: 'Đã chốt' },
  cancelled: { variant: 'danger' as const, label: 'Đã hủy' },
};

export const BudgetScheduleModal: React.FC<BudgetScheduleModalProps> = ({
  isOpen,
  onClose,
  cost,
  onSaved,
}) => {
  const [schedules, setSchedules] = React.useState<ScheduleRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<ScheduleRecord | 'new' | null>(null);
  const [title, setTitle] = React.useState('');
  const [installmentNumber, setInstallmentNumber] = React.useState('1');
  const [amountDue, setAmountDue] = React.useState<bigint | null>(null);
  const [dueDate, setDueDate] = React.useState('');
  const [status, setStatus] = React.useState<'estimated' | 'agreed' | 'cancelled'>('estimated');
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const loadSchedules = React.useCallback(async () => {
    if (!cost) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: ScheduleRecord[] }>(
        `/api/v1/finance/schedules?costItemId=${cost.id}`
      );
      setSchedules(res.data || []);
    } catch (failure) {
      setError((failure as Error).message || 'Không thể tải lịch thanh toán.');
    } finally {
      setLoading(false);
    }
  }, [cost]);

  React.useEffect(() => {
    if (!isOpen || !cost) return;
    setEditing(null);
    void loadSchedules();
  }, [isOpen, cost, loadSchedules]);

  const openEditor = (target: ScheduleRecord | 'new') => {
    setError(null);
    setEditing(target);
    if (target === 'new') {
      const nextNum = schedules.length + 1;
      setTitle(`Đợt ${nextNum}`);
      setInstallmentNumber(String(nextNum));
      setAmountDue(null);
      setDueDate('');
      setStatus('estimated');
      setNotes('');
    } else {
      setTitle(target.title);
      setInstallmentNumber(String(target.installmentNumber));
      setAmountDue(BigInt(target.amountDue));
      setDueDate(String(target.dueDate).slice(0, 10));
      setStatus(target.status);
      setNotes(target.notes || '');
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cost || !editing || saving) return;

    if (!title.trim()) {
      setError('Vui lòng nhập tên đợt thanh toán.');
      return;
    }
    if (!amountDue || amountDue <= 0n) {
      setError('Số tiền đợt trả phải lớn hơn 0.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setError('Vui lòng chọn ngày đến hạn hợp lệ.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/finance/schedules', {
        method: editing === 'new' ? 'POST' : 'PATCH',
        body: jsonBody({
          ...(editing === 'new' ? {} : { id: editing.id, version: editing.version }),
          cost_item_id: cost.id,
          installment_number: Math.max(1, parseInt(installmentNumber, 10) || 1),
          title: title.trim(),
          amount_due: amountDue.toString(),
          due_date: dueDate,
          status,
          notes: notes.trim() || null,
        }),
      });
      setEditing(null);
      await loadSchedules();
      await onSaved(`Đã cập nhật lịch thanh toán cho "${cost.name}".`);
    } catch (failure) {
      setError((failure as Error).message || 'Không thể lưu đợt thanh toán.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen && Boolean(cost)}
      onClose={() => !saving && onClose()}
      title="Lịch các đợt thanh toán"
      description={cost ? `Khoản chi: ${cost.name}` : undefined}
      maxWidth="md"
      footer={
        editing ? (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Quay lại danh sách
            </Button>
            <Button type="submit" form="schedule-form" variant="primary" loading={saving}>
              Lưu đợt trả
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Đóng
            </Button>
            <Button
              type="button"
              variant="primary"
              leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={() => openEditor('new')}
            >
              Thêm đợt trả
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {editing ? (
          <form id="schedule-form" onSubmit={handleSaveSchedule} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <TextInput
                  label="Tên đợt trả *"
                  value={title}
                  disabled={saving}
                  required
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <TextInput
                label="Số thứ tự *"
                type="number"
                min={1}
                disabled={saving}
                required
                value={installmentNumber}
                onChange={(e) => setInstallmentNumber(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CurrencyInput
                label="Số tiền đến hạn (VND) *"
                value={amountDue}
                disabled={saving}
                required
                onChange={setAmountDue}
              />

              <div className="space-y-1.5 text-sm">
                <label htmlFor="schedule-due-date" className="font-medium text-text-main block">
                  Ngày đến hạn *
                </label>
                <CalendarInput
                  id="schedule-due-date"
                  label="Ngày đến hạn"
                  value={dueDate}
                  disabled={saving}
                  required
                  onValueChange={setDueDate}
                  className="w-full min-h-11 rounded-control border border-border-control bg-surface px-3.5 py-2 text-sm"
                />
              </div>
            </div>

            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-text-main block">Trạng thái đợt trả</span>
              <select
                className="w-full min-h-11 rounded-control border border-border-control bg-surface px-3 text-sm"
                value={status}
                disabled={saving}
                onChange={(e) => setStatus(e.target.value as 'estimated' | 'agreed' | 'cancelled')}
              >
                <option value="estimated">Dự kiến</option>
                <option value="agreed">Đã thống nhất</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </label>

            <div className="space-y-1.5 text-sm">
              <label htmlFor="schedule-notes" className="font-medium text-text-main block">
                Ghi chú
              </label>
              <textarea
                id="schedule-notes"
                rows={2}
                disabled={saving}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-control border border-border-control bg-surface px-3 py-2 text-sm"
              />
            </div>
          </form>
        ) : loading ? (
          <p role="status" className="text-sm text-text-muted py-4 text-center">
            Đang tải các đợt thanh toán…
          </p>
        ) : schedules.length === 0 ? (
          <div className="text-center py-6 space-y-2 border border-dashed border-border-subtle rounded-card bg-[#FAF8F4]">
            <CalendarClock className="w-7 h-7 text-accent mx-auto" strokeWidth={1.4} />
            <p className="text-sm font-medium text-text-main">Chưa chia đợt thanh toán</p>
            <p className="text-xs text-text-muted max-w-xs mx-auto">
              Thêm các mốc đặt cọc và tất toán để hệ thống nhắc lịch thanh toán đúng hạn.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle border border-border-subtle rounded-card bg-surface overflow-hidden">
            {schedules.map((s) => {
              const badge = SCHEDULE_STATUS_MAP[s.status] || SCHEDULE_STATUS_MAP.estimated;
              return (
                <li
                  key={s.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#FAF8F4]/70"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-primary-luxury">{s.title}</span>
                      <StatusBadge variant={badge.variant} text={badge.label} size="sm" />
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 tabular-nums">
                      Hạn {String(s.dueDate).slice(0, 10).split('-').reverse().join('/')} ·{' '}
                      <strong className="text-text-main">
                        {formatVND(BigInt(s.amountDue))}
                      </strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditor(s)}
                    className="text-xs font-medium text-text-main border border-border-subtle px-2.5 py-1.5 rounded-control hover:bg-page shrink-0"
                  >
                    Sửa
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ModalDialog>
  );
};
