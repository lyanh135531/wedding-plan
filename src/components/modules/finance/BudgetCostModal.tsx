'use client';

import * as React from 'react';
import { Ban, Trash2 } from 'lucide-react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { TextInput } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { api, jsonBody } from '@/lib/api/request';
import type { CostStatus } from '@/schemas/finance';
import type { BudgetCategory, BudgetCost } from './budgetHelpers';

export interface BudgetCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  cost: BudgetCost | null;
  categories: BudgetCategory[];
  events: Array<{ id: string; name: string }>;
  defaultCategoryId?: string;
  defaultEventId: string | null;
  hasPayments?: boolean;
  onSaved: (message: string) => Promise<void>;
}

const STATUS_CHOICES: ReadonlyArray<{ value: CostStatus; label: string }> = [
  { value: 'draft', label: 'Dự toán' },
  { value: 'contracted', label: 'Đã ký HĐ' },
  { value: 'completed', label: 'Hoàn tất' },
];

export const BudgetCostModal: React.FC<BudgetCostModalProps> = ({
  isOpen,
  onClose,
  cost,
  categories,
  events,
  defaultCategoryId,
  defaultEventId,
  hasPayments = false,
  onSaved,
}) => {
  const isEdit = Boolean(cost);
  const [mode, setMode] = React.useState<'form' | 'cancel'>('form');

  const [name, setName] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [eventId, setEventId] = React.useState<string>('');
  const [status, setStatus] = React.useState<CostStatus>('draft');
  const [statusTouched, setStatusTouched] = React.useState(false);

  const [estimatedAmount, setEstimatedAmount] = React.useState<bigint | null>(null);
  const [contractedAmount, setContractedAmount] = React.useState<bigint | null>(null);
  const [finalSettlementAmount, setFinalSettlementAmount] = React.useState<bigint | null>(null);

  const [vendorName, setVendorName] = React.useState('');
  const [vendorPhone, setVendorPhone] = React.useState('');
  const [notes, setNotes] = React.useState('');

  // Cancellation fields
  const [cancellationFee, setCancellationFee] = React.useState<bigint | null>(0n);
  const [cancellationNotes, setCancellationNotes] = React.useState('');

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestKey = React.useRef({ body: '', key: '' });
  const lock = React.useRef(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setMode('form');
    setError(null);
    lock.current = false;
    requestKey.current = { body: '', key: '' };

    if (cost) {
      setName(cost.name);
      setCategoryId(cost.categoryId);
      setEventId(cost.eventId || '');
      setStatus((cost.status as CostStatus) || 'draft');
      setStatusTouched(true);
      setEstimatedAmount(cost.estimatedAmount !== null ? BigInt(cost.estimatedAmount) : null);
      setContractedAmount(cost.contractedAmount !== null ? BigInt(cost.contractedAmount) : null);
      setFinalSettlementAmount(
        cost.finalSettlementAmount !== null ? BigInt(cost.finalSettlementAmount) : null
      );
      setVendorName(cost.vendorName || '');
      setVendorPhone(cost.vendorPhone || '');
      setNotes(cost.notes || '');
    } else {
      const initialCat =
        defaultCategoryId && defaultCategoryId !== 'all'
          ? defaultCategoryId
          : categories[0]?.id || '';
      setName('');
      setCategoryId(initialCat);
      setEventId(defaultEventId || '');
      setStatus('draft');
      setStatusTouched(false);
      setEstimatedAmount(null);
      setContractedAmount(null);
      setFinalSettlementAmount(null);
      setVendorName('');
      setVendorPhone('');
      setNotes('');
    }
    setCancellationFee(0n);
    setCancellationNotes('');
  }, [isOpen, cost, categories, defaultCategoryId, defaultEventId]);

  const handleContractedChange = (val: bigint | null) => {
    setContractedAmount(val);
    if (!isEdit && !statusTouched) {
      setStatus(val !== null ? 'contracted' : 'draft');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current || saving) return;

    if (mode === 'cancel') {
      if (!cost) return;
      if (cancellationFee === null || cancellationFee < 0n) {
        setError('Phí hủy phải từ 0 trở lên.');
        return;
      }
      if (!cancellationNotes.trim()) {
        setError('Vui lòng nhập lý do hủy dịch vụ.');
        return;
      }
      lock.current = true;
      setSaving(true);
      setError(null);
      try {
        await api(`/api/v1/finance/costs/${cost.id}/cancel`, {
          method: 'POST',
          body: jsonBody({
            cancellation_fee: cancellationFee.toString(),
            cancellation_notes: cancellationNotes.trim(),
            version: cost.version,
          }),
        });
        await onSaved(`Đã hủy dịch vụ "${cost.name}".`);
        onClose();
      } catch (failure) {
        setError((failure as Error).message || 'Không thể hủy khoản chi.');
      } finally {
        lock.current = false;
        setSaving(false);
      }
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Vui lòng nhập tên khoản chi.');
      return;
    }
    if (!categoryId) {
      setError('Vui lòng chọn danh mục chi tiêu.');
      return;
    }

    const payload = {
      name: trimmedName,
      category_id: categoryId,
      event_id: eventId || null,
      vendor_name: vendorName.trim() || null,
      vendor_phone: vendorPhone.trim() || null,
      vendor_contact: cost?.vendorContact || null,
      estimated_amount: estimatedAmount !== null ? estimatedAmount.toString() : null,
      contracted_amount: contractedAmount !== null ? contractedAmount.toString() : null,
      final_settlement_amount:
        finalSettlementAmount !== null ? finalSettlementAmount.toString() : null,
      status,
      notes: notes.trim() || null,
      ...(cost ? { version: cost.version } : {}),
    };

    const body = jsonBody(payload);
    if (!cost && requestKey.current.body !== body) {
      requestKey.current = { body, key: crypto.randomUUID() };
    }

    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      if (cost) {
        await api(`/api/v1/finance/costs/${cost.id}`, {
          method: 'PATCH',
          body,
        });
        await onSaved(`Đã cập nhật khoản chi "${trimmedName}".`);
      } else {
        await api('/api/v1/finance/costs', {
          method: 'POST',
          body,
          headers: { 'Idempotency-Key': requestKey.current.key },
        });
        requestKey.current = { body: '', key: '' };
        await onSaved(`Đã thêm khoản chi "${trimmedName}".`);
      }
      onClose();
    } catch (failure) {
      setError((failure as Error).message || 'Không thể lưu khoản chi.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!cost || lock.current || saving) return;
    if (!window.confirm(`Xóa vĩnh viễn khoản chi "${cost.name}"?`)) return;
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/v1/finance/costs/${cost.id}?version=${cost.version}`, {
        method: 'DELETE',
      });
      await onSaved(`Đã xóa khoản chi "${cost.name}".`);
      onClose();
    } catch (failure) {
      setError((failure as Error).message || 'Không thể xóa khoản chi.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const controlClass =
    'w-full min-h-11 rounded-control border border-border-control bg-surface px-3.5 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={
        mode === 'cancel'
          ? 'Hủy dịch vụ / khoản chi'
          : isEdit
          ? 'Sửa khoản chi'
          : 'Thêm khoản chi mới'
      }
      description={
        mode === 'cancel'
          ? 'Ghi nhận phí hủy hoặc tiền cọc mất (nếu có) để ngân sách đối soát chính xác.'
          : 'Để trống các mức giá nếu vẫn đang thương lượng với nhà cung cấp.'
      }
      maxWidth="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2">
            {isEdit && mode === 'form' && cost?.status !== 'cancelled' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setError(null);
                  setMode('cancel');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-warning hover:underline px-2 py-1.5 rounded"
              >
                <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                Hủy dịch vụ
              </button>
            )}
            {isEdit && mode === 'form' && !hasPayments && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline px-2 py-1.5 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Xóa
              </button>
            )}
            {mode === 'cancel' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setError(null);
                  setMode('form');
                }}
                className="text-xs font-medium text-text-muted hover:text-text-main underline px-2 py-1.5"
              >
                Quay lại sửa thông tin
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
              Đóng
            </Button>
            <Button
              type="submit"
              form="budget-cost-form"
              variant={mode === 'cancel' ? 'danger' : 'primary'}
              loading={saving}
            >
              {mode === 'cancel' ? 'Xác nhận hủy dịch vụ' : 'Lưu'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="budget-cost-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {mode === 'cancel' ? (
          <div className="space-y-4">
            <CurrencyInput
              label="Phí hủy / tiền cọc mất (VND) *"
              value={cancellationFee}
              disabled={saving}
              required
              onChange={setCancellationFee}
              helperText="Nhập 0 nếu nhà cung cấp hoàn trả toàn bộ và không mất phí."
            />
            <div className="space-y-1.5 text-sm">
              <label htmlFor="cost-cancel-notes" className="font-medium text-text-main block">
                Lý do và thỏa thuận hủy *
              </label>
              <textarea
                id="cost-cancel-notes"
                rows={3}
                required
                disabled={saving}
                value={cancellationNotes}
                onChange={(e) => setCancellationNotes(e.target.value)}
                placeholder="Ghi lại lý do đổi phương án hoặc thỏa thuận hoàn cọc..."
                className="w-full rounded-control border border-border-control bg-surface px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput
                label="Tên khoản chi *"
                placeholder="Ví dụ: Sảnh tiệc cưới, Váy cô dâu..."
                value={name}
                disabled={saving}
                required
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />

              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-text-main block">Danh mục *</span>
                <select
                  className={controlClass}
                  value={categoryId}
                  disabled={saving}
                  required
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-text-main block">Phạm vi buổi lễ</span>
                <select
                  className={controlClass}
                  value={eventId}
                  disabled={saving}
                  onChange={(e) => setEventId(e.target.value)}
                >
                  <option value="">Chi phí chung</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1.5 text-sm">
                <span className="font-medium text-text-main block">Trạng thái</span>
                {cost?.status === 'cancelled' || cost?.status === 'cancelling' ? (
                  <div className="min-h-11 px-3.5 py-2 rounded-control border border-danger/30 bg-danger-bg text-danger text-sm flex items-center">
                    {cost.status === 'cancelled' ? 'Đã hủy dịch vụ' : 'Đang hủy dịch vụ'}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {STATUS_CHOICES.map((choice) => {
                      const active = status === choice.value;
                      return (
                        <button
                          key={choice.value}
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setStatusTouched(true);
                            setStatus(choice.value);
                          }}
                          className={`min-h-11 px-2 rounded-control border text-xs font-medium transition-colors ${
                            active
                              ? 'bg-[#173C33] text-[#F6F3E9] border-[#173C33]'
                              : 'bg-surface text-text-muted border-border-control hover:text-text-main hover:bg-[#FAF8F4]'
                          }`}
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1 border-t border-border-subtle/70">
              <CurrencyInput
                label="Dự toán (VND)"
                value={estimatedAmount}
                disabled={saving}
                onChange={setEstimatedAmount}
                placeholder="Ước tính"
              />
              <CurrencyInput
                label="Giá hợp đồng (VND)"
                value={contractedAmount}
                disabled={saving}
                onChange={handleContractedChange}
                placeholder="Đã chốt"
              />
              <CurrencyInput
                label="Giá quyết toán (VND)"
                value={finalSettlementAmount}
                disabled={saving}
                onChange={setFinalSettlementAmount}
                placeholder="Sau cùng (0 nếu miễn phí)"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput
                label="Nhà cung cấp"
                value={vendorName}
                disabled={saving}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Tên đơn vị cung cấp"
              />
              <TextInput
                label="Số điện thoại"
                type="tel"
                value={vendorPhone}
                disabled={saving}
                onChange={(e) => setVendorPhone(e.target.value)}
                placeholder="09xx..."
              />
            </div>

            <div className="space-y-1.5 text-sm">
              <label htmlFor="cost-notes" className="font-medium text-text-main block">
                Ghi chú
              </label>
              <textarea
                id="cost-notes"
                rows={2}
                disabled={saving}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Điều khoản cọc, hạng mục bao gồm..."
                className="w-full rounded-control border border-border-control bg-surface px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </>
        )}
      </form>
    </ModalDialog>
  );
};
