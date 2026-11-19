'use client';

import * as React from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { TextInput } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useRole } from '@/context/RoleContext';
import { api, jsonBody } from '@/lib/api/request';
import { formatVND } from '@/lib/utils';
import { FundingEntriesWorkspace } from '@/components/modules/finance/FundingEntriesWorkspace';
import { useSaveAction } from '@/components/common/useSaveAction';

const h = React.createElement;
interface Settings { initialBalance: string; openingAsOf: string | null; fundScopeConfirmed: boolean; version: number; notes: string | null }
interface Ledger { isConfigured: boolean; availableCash: string | null; disbursedPostOpening: string; directThirdPartyDisbursements: string }
interface Contribution { id: string; contributorName: string | null; entryType: string; amount: string; isVoided: boolean }
export default function FundPage() {
  const { isOwner } = useRole();
  const [ledger, setLedger] = React.useState<Ledger | null>(null);
  const [entries, setEntries] = React.useState<Contribution[]>([]);
  const [balance, setBalance] = React.useState('');
  const [opening, setOpening] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);
  const [version, setVersion] = React.useState(1);
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  const { saving, saveError, runSave } = useSaveAction();
  React.useEffect(() => {
    if (!isOwner) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: Settings | null }>('/api/v1/finance/fund-settings', { signal: controller.signal }),
      api<{ data: { cashLedger: Ledger } }>('/api/v1/finance/overview', { signal: controller.signal }),
      api<{ data: Contribution[] }>('/api/v1/finance/funding-entries', { signal: controller.signal }),
    ]).then(([settings, overview, contributions]) => {
      if (controller.signal.aborted) return;
      setBalance(settings.data?.initialBalance ?? '');
      setOpening(settings.data?.openingAsOf ? new Date(new Date(settings.data.openingAsOf).getTime() + 7 * 3600000).toISOString().slice(0, 16) : '');
      setVersion(settings.data?.version ?? 1);
      setConfirmed(settings.data?.fundScopeConfirmed ?? false);
      setNotes(settings.data?.notes ?? '');
      setLedger(overview.data.cashLedger);
      setEntries(contributions.data);
    }).catch((failure) => { if (!controller.signal.aborted) setError((failure as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isOwner, revision]);
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    void runSave(async () => {
      await api('/api/v1/finance/fund-settings', { method: 'PUT', body: jsonBody({
        initial_balance: balance, opening_as_of: opening ? new Date(`${opening}:00+07:00`).toISOString() : null,
        fund_scope_confirmed: confirmed, version, notes,
      }) });
      setRevision((value) => value + 1);
    });
  };
  return h(PageShell, { title: 'Sổ quỹ & Nguồn tiền', showScopeSelector: false },
    h('div', { className: 'space-y-5 max-w-3xl' },
      (error || saveError) && h(Alert, { variant: 'danger', action: { label: 'Tải lại', onClick: () => setRevision((value) => value + 1) } }, error || saveError),
      loading ? h('p', { role: 'status' }, 'Đang tải sổ quỹ...') : !error && h(React.Fragment, null,
        h('section', { className: 'bg-surface border rounded-card p-5 space-y-2' },
          h('h2', { className: 'font-semibold text-lg' }, 'Số dư quỹ hiện có'),
          h('p', { className: 'text-2xl font-semibold tabular-nums' }, ledger?.isConfigured && ledger.availableCash !== null ? formatVND(BigInt(ledger.availableCash)) : 'Chưa xác nhận mốc mở sổ'),
          h('p', { className: 'text-sm text-text-muted' }, 'Khoản người thân trả trực tiếp nhà cung cấp được theo dõi riêng, không cộng vào tiền mặt trong quỹ.'),
        ),
        h('form', { onSubmit: save, className: 'bg-surface border rounded-card p-5 space-y-4' },
          h('h2', { className: 'font-semibold' }, 'Mốc mở sổ quỹ'),
          h(TextInput, { label: 'Số dư ban đầu (VND)', inputMode: 'numeric', pattern: '[0-9]+', required: true, value: balance, disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setBalance(event.target.value) }),
          h(TextInput, { label: 'Thời điểm mở sổ (giờ Việt Nam)', type: 'datetime-local', required: confirmed, value: opening, disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setOpening(event.target.value) }),
          h('label', { className: 'flex items-center gap-2 min-h-[44px]' }, h('input', { type: 'checkbox', checked: confirmed, disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setConfirmed(event.target.checked) }), 'Đã đối chiếu số dư và phạm vi quỹ'),
          h(TextInput, { label: 'Ghi chú sổ quỹ', value: notes, disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setNotes(event.target.value) }),
          h(Button, { type: 'submit', loading: saving }, 'Lưu mốc mở sổ'),
        ),
        h(FundingEntriesWorkspace, { onChanged: () => setRevision((value) => value + 1) }),
      ),
    ));
}
