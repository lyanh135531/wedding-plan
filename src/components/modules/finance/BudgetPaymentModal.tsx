'use client';

import * as React from 'react';
import { Banknote, CheckCircle2, Wallet } from 'lucide-react';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { TextInput } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { api, jsonBody } from '@/lib/api/request';
import { formatVND } from '@/lib/utils';
import {
  localVietnamDateTime,
  type BudgetCost,
  type CostRowMetrics,
} from './budgetHelpers';

export interface BudgetPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cost: BudgetCost | null;
  metrics: CostRowMetrics | null;
  onSaved: (message: string) => Promise<void>;
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Chuyển khoản' },
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'other', label: 'Khác' },
] as const;

export const BudgetPaymentModal: React.FC<BudgetPaymentModalProps> = ({
  isOpen,
  onClose,
  cost,
  metrics,
  onSaved,
}) => {
  const [amount, setAmount] = React.useState<bigint | null>(null);
  const [transactionTime, setTransactionTime] = React.useState(localVietnamDateTime);
  const [paymentMethod, setPaymentMethod] = React.useState<'bank_transfer' | 'cash' | 'other'>(
    'bank_transfer'
  );
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestKey = React.useRef({ body: '', key: '' });
  const lock = React.useRef(false);

  React.useEffect(() => {
    if (!isOpen || !cost) return;
    setError(null);
    lock.current = false;
    requestKey.current = { body: '', key: '' };
    setTransactionTime(localVietnamDateTime());
    setPaymentMethod('bank_transfer');
    setNotes('');
    setAmount(metrics?.remaining && metrics.remaining > 0n ? metrics.remaining : null);
  }, [isOpen, cost, metrics?.remaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cost || lock.current || saving) return;

    if (!amount || amount <= 0n) {
      setError('Số tiền chi phải lớn hơn 0.');
      return;
    }

    const body = jsonBody({
      cost_item_id: cost.id,
      payment_type: 'outflow',
      amount: amount.toString(),
      transaction_time: `${transactionTime}:00+07:00`,
      payment_method: paymentMethod,
      notes: notes.trim() || null,
    });

    if (requestKey.current.body !== body) {
      requestKey.current = { body, key: crypto.randomUUID() };
    }

    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/finance/payments', {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': requestKey.current.key },
      });
      requestKey.current = { body: '', key: '' };
      await onSaved(`Đã ghi nhận chi ${formatVND(amount)} cho "${cost.name}".`);
      onClose();
    } catch (failure) {
      setError((failure as Error).message || 'Không thể ghi nhận giao dịch.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const remaining = metrics?.remaining ?? null;

  return (
    <ModalDialog
      isOpen={isOpen && Boolean(cost)}
      onClose={() => !saving && onClose()}
      title="Ghi nhận chi tiền"
      description={cost ? `Khoản chi: ${cost.name}` : undefined}
      maxWidth="sm"
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="submit"
            form="budget-payment-form"
            variant="primary"
            loading={saving}
            leftIcon={<Banknote className="w-4 h-4" aria-hidden="true" />}
          >
            Lưu giao dịch
          </Button>
        </>
      }
    >
      <form id="budget-payment-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {metrics && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-control bg-[#FAF8F4] border border-border-subtle text-xs">
            <div className="flex items-center gap-3 flex-wrap tabular-nums">
              <span className="text-text-muted">
                Đã chi: <strong className="text-text-main">{formatVND(metrics.netPaid)}</strong>
              </span>
              {remaining !== null && (
                <span className="text-text-muted">
                  Còn lại:{' '}
                  <strong className="text-primary">{formatVND(remaining)}</strong>
                </span>
              )}
            </div>
            {remaining !== null && remaining > 0n && amount !== remaining && (
              <button
                type="button"
                onClick={() => setAmount(remaining)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                Điền số còn lại
              </button>
            )}
          </div>
        )}

        <CurrencyInput
          label="Số tiền chi (VND) *"
          value={amount}
          disabled={saving}
          required
          onChange={(val) => {
            setAmount(val);
            setError(null);
          }}
          placeholder="Nhập số tiền (VD: 10.000.000)"
        />

        <TextInput
          label="Thời điểm giao dịch *"
          type="datetime-local"
          required
          disabled={saving}
          value={transactionTime}
          onChange={(e) => setTransactionTime(e.target.value)}
        />

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-text-main block">Phương thức</span>
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_METHODS.map((m) => {
              const active = paymentMethod === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  disabled={saving}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`py-2 px-2 rounded-control border text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#173C33] text-[#F6F3E9] border-[#173C33]'
                      : 'bg-surface text-text-muted border-border-control hover:text-text-main hover:bg-[#FAF8F4]'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          <label htmlFor="budget-payment-notes" className="font-medium text-text-main block">
            Ghi chú
          </label>
          <textarea
            id="budget-payment-notes"
            rows={2}
            disabled={saving}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Đặt cọc đợt 1, thanh toán tất toán..."
            className="w-full rounded-control border border-border-control bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <Wallet className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
          Giao dịch sẽ được đồng bộ sang trang Thanh Toán & Chi và Sổ Quỹ.
        </p>
      </form>
    </ModalDialog>
  );
};
