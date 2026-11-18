'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, allPages, jsonBody } from '@/lib/api/request';
import { useEventScope } from '@/context/EventScopeContext';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/dialog';
import { useSaveAction } from '@/components/common/useSaveAction';
import { formatVND } from '@/lib/utils';

interface Category { id: string; name: string; allocatedAmount: string | null }
interface Cost { id: string; name: string; categoryId: string; eventId: string | null; contractedAmount: string | null; estimatedAmount: string | null; finalSettlementAmount: string | null; status: string }
interface Payment { id: string; costItemId: string; costItemName: string; paymentType: 'outflow' | 'refund'; amount: string; transactionTime: string; paymentMethod: string; parentPaymentId: string | null; isVoided: boolean; voidedReason: string | null; version: number }
type Editor = { type: 'category' | 'cost' | 'payment' } | { type: 'refund' | 'void'; payment: Payment };
const control = 'w-full min-h-11 border border-border-control rounded-control px-3 bg-surface';

function localTime() {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (name: string) => parts.find((part) => part.type === name)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function FinanceEditor({ editor, categories, costs, eventId, close, saved }: {
  editor: Editor; categories: Category[]; costs: Cost[]; eventId: string | null; close: () => void; saved: () => Promise<void>;
}) {
  const { saving, saveError, runSave } = useSaveAction();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]?.id || '');
  const [cost, setCost] = useState('payment' in editor ? editor.payment.costItemId : costs[0]?.id || '');
  const [time, setTime] = useState(localTime);
  const [method, setMethod] = useState('bank_transfer');
  const [reason, setReason] = useState('');
  const requestKey = useRef({ body: '', key: '' });
  const titles = { category: 'Thêm danh mục ngân sách', cost: 'Thêm khoản chi', payment: 'Ghi nhận chi tiền', refund: 'Ghi nhận hoàn tiền', void: 'Hủy giao dịch đã ghi' };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void runSave(async () => {
      let url: string;
      let payload: unknown;
      if (editor.type === 'category') {
        url = '/api/v1/finance/categories';
        payload = { name, allocated_budget: amount || '0' };
      } else if (editor.type === 'cost') {
        url = '/api/v1/finance/costs';
        payload = { name, category_id: category, event_id: eventId, contracted_amount: amount || null, status: amount ? 'contracted' : 'draft' };
      } else if (editor.type === 'void') {
        url = `/api/v1/finance/payments/${editor.payment.id}/void`;
        payload = { voided_reason: reason, version: editor.payment.version };
      } else {
        url = '/api/v1/finance/payments';
        payload = { cost_item_id: cost, payment_type: editor.type === 'refund' ? 'refund' : 'outflow', amount,
          transaction_time: `${time}:00+07:00`, payment_method: method, notes: reason || null,
          ...(editor.type === 'refund' ? { parent_payment_id: editor.payment.id } : {}),
        };
      }
      const body = jsonBody(payload);
      if (requestKey.current.body !== body) requestKey.current = { body, key: crypto.randomUUID() };
      await api(url, { method: 'POST', body, headers: { 'Idempotency-Key': requestKey.current.key } });
      await saved();
      close();
    });
  };
  return <ModalDialog isOpen title={titles[editor.type]} onClose={close}>
    <form className="space-y-4" onSubmit={submit}>
      {saveError && <p role="alert" className="text-danger">{saveError}</p>}
      {(editor.type === 'category' || editor.type === 'cost') && <TextInput label={editor.type === 'cost' ? 'Tên khoản chi' : 'Tên danh mục'} required value={name} onChange={(e) => setName(e.target.value)} />}
      {editor.type === 'cost' && <label className="block">Danh mục chi tiêu<select required className={control} value={category} onChange={(e) => setCategory(e.target.value)}>
        {categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select></label>}
      {editor.type === 'payment' && <label className="block">Khoản chi liên kết<select required className={control} value={cost} onChange={(e) => setCost(e.target.value)}>
        {costs.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select></label>}
      {editor.type === 'refund' && <p>Khoản chi: {editor.payment.costItemName} · Đã chi: {formatVND(BigInt(editor.payment.amount))}</p>}
      {editor.type !== 'void' && <TextInput label={editor.type === 'category' ? 'Ngân sách phân bổ (VND)' : 'Số tiền (VND)'} inputMode="numeric" pattern="[0-9]+" required={editor.type === 'payment' || editor.type === 'refund'}
        helperText={editor.type === 'cost' ? 'Để trống nếu chưa có giá.' : undefined} value={amount} onChange={(e) => setAmount(e.target.value)} />}
      {(editor.type === 'payment' || editor.type === 'refund') && <>
        <TextInput label="Thời điểm giao dịch (giờ Việt Nam)" type="datetime-local" required value={time} onChange={(e) => setTime(e.target.value)} />
        <label className="block">Phương thức<select className={control} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="bank_transfer">Chuyển khoản</option><option value="cash">Tiền mặt</option><option value="other">Khác</option>
        </select></label>
      </>}
      {(editor.type === 'void' || editor.type === 'refund') && <TextInput label="Lý do" required value={reason} onChange={(e) => setReason(e.target.value)} />}
      {editor.type === 'void' && <p>Giao dịch {formatVND(BigInt(editor.payment.amount))} sẽ được đánh dấu hủy và giữ lại lịch sử.</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={close}>Đóng</Button><Button type="submit" disabled={saving}>Lưu</Button></div>
    </form>
  </ModalDialog>;
}

export function LiveFinanceWorkspace({ view }: { view: 'budget' | 'payments' }) {
  const { isOwner } = useRole();
  const { currentScope, availableEvents } = useEventScope();
  const eventId = availableEvents.some((event) => event.id === currentScope) ? currentScope : null;
  const [categories, setCategories] = useState<Category[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      const [groups, items, ledger] = await Promise.all([
        api<{ data: Category[] }>('/api/v1/finance/categories'),
        allPages<Cost>('/api/v1/finance/costs'), allPages<Payment>('/api/v1/finance/payments'),
      ]);
      if (request === generation.current) { setCategories(groups.data); setCosts(items); setPayments(ledger); }
    } catch (failure) { if (request === generation.current) setError((failure as Error).message); }
    finally { if (request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { if (isOwner) void load(); return () => { generation.current++; }; }, [load, isOwner]);
  if (!isOwner) return <p>Bạn không có quyền xem tài chính.</p>;
  const shownCosts = costs.filter((cost) => currentScope === 'common' ? cost.eventId === null : !eventId || cost.eventId === eventId);
  const ids = new Set(shownCosts.map((cost) => cost.id));
  const shownPayments = payments.filter((payment) => ids.has(payment.costItemId));
  const net = shownPayments.filter((payment) => !payment.isVoided).reduce((sum, payment) => sum + (payment.paymentType === 'outflow' ? 1n : -1n) * BigInt(payment.amount), 0n);
  return <section className="space-y-5">
    <h1 className="text-2xl font-bold">{view === 'budget' ? 'Ngân Sách & Khoản Chi' : 'Sổ Chi Tiền & Nhật Ký Giao Dịch'}</h1>
    {error && <p role="alert" className="text-danger">{error} <button className="underline min-h-11" onClick={() => void load()}>Tải lại</button></p>}
    {loading && <p role="status">Đang tải tài chính…</p>}
    <p>Đã chi ròng trong phạm vi đang xem: <strong data-testid="net-paid">{formatVND(net)}</strong></p>
    <div className="flex gap-2 flex-wrap">
      {view === 'budget' ? <><Button onClick={() => setEditor({ type: 'category' })}>Thêm danh mục</Button><Button disabled={!categories.length} onClick={() => setEditor({ type: 'cost' })}>Thêm khoản chi</Button></> :
        <Button disabled={!shownCosts.length} onClick={() => setEditor({ type: 'payment' })}>Ghi nhận chi tiền</Button>}
    </div>
    {view === 'budget' && <>
      <h2 className="font-bold">Danh mục ngân sách</h2>
      <ul>{categories.map((category) => <li key={category.id}>{category.name} · {formatVND(BigInt(category.allocatedAmount || '0'))}</li>)}</ul>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{shownCosts.map((cost) => <article key={cost.id} className="rounded-card border border-border-subtle p-4 bg-surface">
        <h2 className="font-bold">{cost.name}</h2><p>{cost.contractedAmount === null ? 'Chưa có giá hợp đồng' : formatVND(BigInt(cost.contractedAmount))}</p>
      </article>)}</div>
      {!loading && !shownCosts.length && <p>Chưa có khoản chi trong phạm vi này.</p>}
    </>}
    {view === 'payments' && <div className="space-y-3">{shownPayments.map((payment) => <article key={payment.id} data-testid={`payment-${payment.id}`} className="rounded-card border border-border-subtle bg-surface p-4 space-y-2">
      <h2 className="font-semibold">{payment.costItemName}</h2>
      <p>{payment.paymentType === 'refund' ? 'Hoàn tiền' : 'Chi tiền'} · {formatVND(BigInt(payment.amount))}</p>
      <p>{new Date(payment.transactionTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
      {payment.isVoided ? <p>Đã hủy: {payment.voidedReason}</p> : <div className="flex gap-2">
        {payment.paymentType === 'outflow' && <Button variant="secondary" onClick={() => setEditor({ type: 'refund', payment })}>Hoàn tiền</Button>}
        <Button variant="secondary" onClick={() => setEditor({ type: 'void', payment })}>Hủy giao dịch</Button>
      </div>}
    </article>)}{!loading && !shownPayments.length && <p>Chưa có giao dịch trong phạm vi này.</p>}</div>}
    {editor && <FinanceEditor editor={editor} categories={categories} costs={shownCosts} eventId={eventId} close={() => setEditor(null)} saved={load} />}
  </section>;
}
