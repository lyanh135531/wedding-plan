'use client';

import * as React from 'react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { TextInput } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { api, jsonBody } from '@/lib/api/request';
import type { WeddingConfigurationDto, WeddingEventDto } from './settingsHelpers';

export interface CoupleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WeddingConfigurationDto;
  events: WeddingEventDto[];
  onSaved: (updated: WeddingConfigurationDto, message: string) => Promise<void>;
}

const selectClass =
  'w-full min-h-11 rounded-control border border-border-control bg-surface px-3.5 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50';

export const CoupleSettingsModal: React.FC<CoupleSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  events,
  onSaved,
}) => {
  const [groomName, setGroomName] = React.useState('');
  const [brideName, setBrideName] = React.useState('');
  const [representativeEventId, setRepresentativeEventId] = React.useState('');
  const [tentativeDateNote, setTentativeDateNote] = React.useState('');
  const [budgetTarget, setBudgetTarget] = React.useState<bigint | null>(null);
  const [contingencyBudget, setContingencyBudget] = React.useState<bigint | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lock = React.useRef(false);
  const repSelectId = React.useId();

  React.useEffect(() => {
    if (!isOpen) return;
    setError(null);
    lock.current = false;
    setGroomName(config.groomName || '');
    setBrideName(config.brideName || '');
    setRepresentativeEventId(config.representativeEventId || '');
    setTentativeDateNote(config.tentativeDateNote || '');
    setBudgetTarget(config.budgetTarget ? BigInt(config.budgetTarget) : null);
    setContingencyBudget(config.contingencyBudget ? BigInt(config.contingencyBudget) : null);
  }, [isOpen, config]);

  const activeEvents = React.useMemo(
    () => events.filter((ev) => ev.status !== 'cancelled'),
    [events]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current || saving) return;

    const cleanGroom = groomName.trim();
    const cleanBride = brideName.trim();
    if (!cleanGroom || !cleanBride) {
      setError('Vui lòng nhập đầy đủ họ và tên chú rể, cô dâu.');
      return;
    }

    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await api<{ data: WeddingConfigurationDto }>('/api/v1/configuration', {
        method: 'PATCH',
        body: jsonBody({
          groomName: cleanGroom,
          brideName: cleanBride,
          tentativeDateNote: tentativeDateNote.trim() || null,
          representativeEventId: representativeEventId || null,
          budgetTarget: budgetTarget !== null ? budgetTarget.toString() : null,
          contingencyBudget: contingencyBudget !== null ? contingencyBudget.toString() : null,
          version: config.version,
        }),
      });
      await onSaved(response.data, 'Đã cập nhật hồ sơ đôi uyên ương & ngân sách.');
      onClose();
    } catch (failure) {
      setError((failure as Error).message || 'Không thể lưu hồ sơ đám cưới.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title="Chỉnh sửa hồ sơ đám cưới"
      description="Cập nhật tên đôi uyên ương, buổi lễ đại diện và hạn mức ngân sách mục tiêu."
      maxWidth="md"
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="submit"
            form="couple-settings-form"
            variant="primary"
            loading={saving}
          >
            Lưu hồ sơ
          </Button>
        </>
      }
    >
      <form id="couple-settings-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <TextInput
            label="Họ và tên chú rể"
            required
            value={groomName}
            disabled={saving}
            onChange={(e) => {
              setGroomName(e.target.value);
              setError(null);
            }}
          />
          <TextInput
            label="Họ và tên cô dâu"
            required
            value={brideName}
            disabled={saving}
            onChange={(e) => {
              setBrideName(e.target.value);
              setError(null);
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={repSelectId} className="text-sm font-medium text-text-main">
            Buổi lễ đại diện (dùng để đếm ngược trên Trang chủ)
          </label>
          <select
            id={repSelectId}
            className={selectClass}
            value={representativeEventId}
            disabled={saving}
            onChange={(e) => {
              setRepresentativeEventId(e.target.value);
              setError(null);
            }}
          >
            <option value="">Chưa chọn buổi lễ đại diện</option>
            {activeEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>

        <TextInput
          label="Ghi chú thời gian dự kiến"
          placeholder="Ví dụ: Dự kiến tháng 11 năm 2026"
          helperText="Hiển thị khi ngày cưới chính thức chưa được ấn định."
          value={tentativeDateNote}
          disabled={saving}
          onChange={(e) => {
            setTentativeDateNote(e.target.value);
            setError(null);
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-border-subtle">
          <CurrencyInput
            label="Ngân sách mục tiêu (VND)"
            placeholder="Để trống nếu chưa chốt"
            value={budgetTarget}
            disabled={saving}
            onChange={(val) => {
              setBudgetTarget(val);
              setError(null);
            }}
          />
          <CurrencyInput
            label="Ngân sách dự phòng (VND)"
            placeholder="0"
            value={contingencyBudget}
            disabled={saving}
            onChange={(val) => {
              setContingencyBudget(val);
              setError(null);
            }}
          />
        </div>
      </form>
    </ModalDialog>
  );
};
