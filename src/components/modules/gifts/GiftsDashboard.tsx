'use client';
import { useMutationFetch } from '@/components/common/useMutationFetch';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/ui/dialog';
import { useRole } from '@/context/RoleContext';
import { PermissionDeniedView } from '@/components/layout/PermissionDeniedView';
import {
  Gift,
  Plus,
  RotateCcw,
  Ban,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  DollarSign,
  Package,
  Layers,
  Scale,
  Copy,
  Check,
} from 'lucide-react';

const h = React.createElement;

export interface GiftItem {
  id: string;
  eventId: string;
  giftType: 'cash' | 'physical';
  amount: string | null;
  description: string | null;
  receivedByUserId: string | null;
  receivedByProxy: string | null;
  envelopeCode: string | null;
  isSenderIdentified: boolean;
  unidentifiedNotes: string | null;
  reconciliationStatus: string;
  isThanked: boolean;
  thankedAt: string | null;
  thankYouChannel: string | null;
  isVoided: boolean;
  voidedReason: string | null;
  notes: string | null;
  version: number;
  contributors: Array<{
    id: string;
    contributorName: string;
    relationship: string | null;
  }>;
  returns: Array<{
    id: string;
    amount: string;
    returnReason: string;
    returnedAt: string;
  }>;
  netAmount: string;
  receivedAt?: string;
}

export interface GiftSummary {
  totalReceivedCash: string;
  totalReturnedCash: string;
  netReceivedCash: string;
  totalGiftsCount: number;
  cashGiftsCount: number;
  physicalGiftsCount: number;
  unthankedCount: number;
  unidentifiedCount: number;
  needsReconciliationCount: number;
}

export interface GiftsDashboardProps {
  eventId?: string;
}

export const GiftsDashboard: React.FC<GiftsDashboardProps> = ({ eventId = '' }) => {
  const { isOwner } = useRole();

  // Strict Privacy Boundary (AT03, AT25)
  if (!isOwner) {
    return h(PermissionDeniedView, {
      title: 'Sổ quà mừng & Đối soát tài chính',
      message: 'Người nhà (family_view) không có quyền xem thông tin quà mừng và đối soát tài chính của đám cưới.',
    });
  }

  const [gifts, setGifts] = React.useState<GiftItem[]>([]);
  const [summary, setSummary] = React.useState<GiftSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'all' | 'cash' | 'physical' | 'unthanked' | 'unidentified'>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = React.useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = React.useState(false);
  const [isThankModalOpen, setIsThankModalOpen] = React.useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = React.useState(false);
  const [selectedGift, setSelectedGift] = React.useState<GiftItem | null>(null);

  // Form states
  const mutationFetch = useMutationFetch();
  const writeLock = React.useRef(false);
  const [giftType, setGiftType] = React.useState<'cash' | 'physical'>('cash');
  const [receivedAt, setReceivedAt] = React.useState('');
  const [amountInput, setAmountInput] = React.useState('');
  const [descriptionInput, setDescriptionInput] = React.useState('');
  const [proxyInput, setProxyInput] = React.useState('');
  const [envelopeCodeInput, setEnvelopeCodeInput] = React.useState('');
  const [isSenderIdentified, setIsSenderIdentified] = React.useState(true);
  const [contributors, setContributors] = React.useState<Array<{ contributorName: string; relationship: string }>>([
    { contributorName: '', relationship: '' },
  ]);
  const [notesInput, setNotesInput] = React.useState('');

  // Return form
  const [returnAmount, setReturnAmount] = React.useState('');
  const [returnReason, setReturnReason] = React.useState('');

  // Void form
  const [voidReason, setVoidReason] = React.useState('');

  // Thank form
  const [thankChannel, setThankChannel] = React.useState<'in_person' | 'call' | 'sms' | 'zalo' | 'card' | 'other'>('in_person');
  const [thankNotes, setThankNotes] = React.useState('');
  const [copiedTemplate, setCopiedTemplate] = React.useState(false);

  // Reconcile form
  const [countedCash, setCountedCash] = React.useState('');
  const [reconcileResult, setReconcileResult] = React.useState<{ variance: string; isBalanced: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const fetchGifts = React.useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await mutationFetch(`/api/v1/gifts?eventId=${eventId}`);
      if (res.ok) {
        const json = await res.json();
        setGifts(json.data || []);
        setSummary(json.summary || null);
      } else { const failure = await res.json(); setErrorMsg(failure.message || 'Không thể tải sổ quà mừng.'); }
    } catch {
      setErrorMsg('Không thể tải sổ quà mừng. Kiểm tra kết nối và thử lại.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  React.useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  // Add contributor row (AT25: multi-contributor joint envelope)
  const addContributorRow = () => {
    setContributors([...contributors, { contributorName: '', relationship: '' }]);
  };

  const removeContributorRow = (index: number) => {
    setContributors(contributors.filter((_, i) => i !== index));
  };

  const updateContributor = (index: number, field: 'contributorName' | 'relationship', value: string) => {
    const updated = [...contributors];
    updated[index][field] = value;
    setContributors(updated);
  };

  // Submit create gift
  const handleCreateGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (writeLock.current) return;
    writeLock.current = true;
    try {
      const payload: any = {
        eventId,
        giftType,
        receivedAt: receivedAt ? new Date(`${receivedAt}:00+07:00`).toISOString() : undefined,
        receivedByProxy: proxyInput.trim() || undefined,
        envelopeCode: envelopeCodeInput.trim() || undefined,
        isSenderIdentified,
        notes: notesInput.trim() || undefined,
      };

      if (giftType === 'cash') {
        payload.amount = amountInput.trim();
      } else {
        payload.description = descriptionInput.trim();
      }

      if (isSenderIdentified) {
        payload.contributors = contributors
          .filter((c) => c.contributorName.trim().length > 0)
          .map((c) => ({
            contributorName: c.contributorName.trim(),
            relationship: c.relationship.trim() || undefined,
          }));
      }

      const res = await mutationFetch('/api/v1/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsAddModalOpen(false);
        setAmountInput('');
        setDescriptionInput('');
        setProxyInput('');
        setEnvelopeCodeInput('');
        setContributors([{ contributorName: '', relationship: '' }]);
        setNotesInput('');
        fetchGifts();
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.message || 'Lỗi khi ghi nhận quà mừng');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally { writeLock.current = false; }
  };

  // Submit return
  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGift) return;

    if (writeLock.current) return;
    writeLock.current = true;
    try {
      const res = await mutationFetch(`/api/v1/gifts/${selectedGift.id}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: returnAmount.trim(),
          returnReason: returnReason.trim(),
        }),
      });

      if (res.ok) {
        setIsReturnModalOpen(false);
        setSelectedGift(null);
        setReturnAmount('');
        setReturnReason('');
        fetchGifts();
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.message || 'Lỗi khi ghi nhận trả quà');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally { writeLock.current = false; }
  };

  // Submit void
  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGift) return;

    if (writeLock.current) return;
    writeLock.current = true;
    try {
      const res = await mutationFetch(`/api/v1/gifts/${selectedGift.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voidedReason: voidReason.trim(),
          version: selectedGift.version,
        }),
      });

      if (res.ok) {
        setIsVoidModalOpen(false);
        setSelectedGift(null);
        setVoidReason('');
        fetchGifts();
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.message || 'Lỗi khi hủy quà');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally { writeLock.current = false; }
  };

  // Submit thank
  const handleThank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGift) return;

    if (writeLock.current) return;
    writeLock.current = true;
    try {
      const res = await mutationFetch(`/api/v1/gifts/${selectedGift.id}/thank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isThanked: true,
          channel: thankChannel,
          notes: thankNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        setIsThankModalOpen(false);
        setSelectedGift(null);
        setThankNotes('');
        fetchGifts();
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.message || 'Lỗi ghi nhận cảm ơn');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally { writeLock.current = false; }
  };

  // Submit reconcile
  const handleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (writeLock.current) return;
    writeLock.current = true;
    try {
      const res = await mutationFetch('/api/v1/gifts/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          countedCashAmount: countedCash.trim(),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setReconcileResult(json.data);
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.message || 'Lỗi đối soát két tiền');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally { writeLock.current = false; }
  };

  // Filtered gifts
  const filteredGifts = gifts.filter((g) => {
    if (activeTab === 'cash') return g.giftType === 'cash' && !g.isVoided;
    if (activeTab === 'physical') return g.giftType === 'physical' && !g.isVoided;
    if (activeTab === 'unthanked') return !g.isThanked && !g.isVoided;
    if (activeTab === 'unidentified') return !g.isSenderIdentified && !g.isVoided;
    return true;
  });

  const etiquetteTemplate = selectedGift
    ? `Vợ chồng chúng con/em xin chân thành cảm ơn ${
        selectedGift.contributors.map((c) => c.contributorName).join(' & ') || 'Quý khách'
      } đã đến chung vui và gửi món quà ý nghĩa chúc phúc cho ngày cưới của chúng con/em!`
    : '';

  const copyTemplate = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(etiquetteTemplate);
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2000);
    }
  };

  return h(
    'div',
    { className: 'space-y-6 max-w-7xl mx-auto', 'aria-busy': loading },
    // Header
    h(
      'div',
      { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-4' },
      h(
        'div',
        null,
        h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Sổ Quà Mừng & Đối Soát Tài Chính'),
        h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Ghi chép tiền mừng, phong bì chung, quản lý hoàn trả và đối soát két')
      ),
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h(
          Button,
          {
            variant: 'secondary',
            leftIcon: h(Scale, { className: 'w-4 h-4 text-primary' }),
            onClick: () => setIsReconcileModalOpen(true),
          },
          'Đối soát két tiền'
        ),
        h(
          Button,
          {
            variant: 'primary',
            leftIcon: h(Plus, { className: 'w-4 h-4' }),
            onClick: () => setIsAddModalOpen(true),
          },
          '+ Ghi nhận quà mừng'
        )
      )
    ),

    // Error alert
    errorMsg &&
      h(
        'div',
        { className: 'p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-control flex items-center justify-between' },
        h('span', null, errorMsg),
        h('button', { type: 'button', onClick: () => setErrorMsg(null), className: 'font-bold' }, '✕')
      ),

    // Summary Metric Cards
    summary &&
      h(
        'div',
        { className: 'grid grid-cols-2 lg:grid-cols-4 gap-3' },
        h(
          'div',
          { className: 'p-4 bg-surface border border-border-subtle rounded-card' },
          h('p', { className: 'text-xs text-text-muted font-medium' }, 'Tổng tiền mừng nhận'),
          h('p', { className: 'text-xl font-bold text-text-main mt-1' }, `${BigInt(summary.totalReceivedCash).toLocaleString('vi-VN')} ₫`)
        ),
        h(
          'div',
          { className: 'p-4 bg-amber-50 border border-amber-200 rounded-card' },
          h('p', { className: 'text-xs text-amber-800 font-medium' }, 'Tiền đã hoàn trả'),
          h('p', { className: 'text-xl font-bold text-amber-800 mt-1' }, `${BigInt(summary.totalReturnedCash).toLocaleString('vi-VN')} ₫`)
        ),
        h(
          'div',
          { className: 'p-4 bg-emerald-50 border border-emerald-200 rounded-card' },
          h('p', { className: 'text-xs text-emerald-800 font-medium' }, 'Thực nhận (Đang giữ)'),
          h('p', { className: 'text-xl font-bold text-emerald-800 mt-1' }, `${BigInt(summary.netReceivedCash).toLocaleString('vi-VN')} ₫`)
        ),
        h(
          'div',
          { className: 'p-4 bg-surface border border-border-subtle rounded-card' },
          h('p', { className: 'text-xs text-text-muted font-medium' }, 'Hiện vật & Chưa cảm ơn'),
          h(
            'p',
            { className: 'text-sm font-semibold text-text-main mt-1' },
            `${summary.physicalGiftsCount} hiện vật • ${summary.unthankedCount} chưa cảm ơn`
          )
        )
      ),

    // Tab switcher
    h(
      'div',
      { className: 'flex gap-2 border-b border-border-subtle overflow-x-auto pb-1 text-xs' },
      [
        { key: 'all', label: 'Tất cả quà' },
        { key: 'cash', label: 'Quà tiền mặt' },
        { key: 'physical', label: 'Hiện vật' },
        { key: 'unthanked', label: 'Chưa cảm ơn' },
        { key: 'unidentified', label: 'Chưa rõ người gửi' },
      ].map((t) =>
        h(
          'button',
          {
            key: t.key,
            type: 'button',
            onClick: () => setActiveTab(t.key as any),
            className: `px-3.5 py-2 font-semibold whitespace-nowrap rounded-t ${
              activeTab === t.key
                ? 'border-b-2 border-primary text-primary bg-primary/5'
                : 'text-text-muted hover:text-text-main'
            }`,
          },
          t.label
        )
      )
    ),

    // Gifts table / list
    h(
      'div',
      { className: 'bg-surface border border-border-subtle rounded-card shadow-sm overflow-hidden' },
      filteredGifts.length === 0
        ? h(
            'div',
            { className: 'p-8 text-center text-text-muted text-sm' },
            loading ? 'Đang tải danh sách...' : 'Không có quà mừng nào trong danh mục này.'
          )
        : h(
            'div',
            { className: 'divide-y divide-border-subtle' },
            filteredGifts.map((g) =>
              h(
                'div',
                {
                  key: g.id,
                  className: `p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    g.isVoided ? 'bg-gray-100/70 opacity-60' : 'hover:bg-gray-50'
                  }`,
                },
                // Gift Info
                h(
                  'div',
                  { className: 'space-y-1 min-w-0' },
                  h(
                    'div',
                    { className: 'flex items-center gap-2 flex-wrap' },
                    g.giftType === 'cash'
                      ? h(
                          'span',
                          { className: 'font-mono font-bold text-base text-emerald-700' },
                          `${BigInt(g.amount || '0').toLocaleString('vi-VN')} ₫`
                        )
                      : h('span', { className: 'font-bold text-base text-primary' }, g.description),
                    g.isVoided &&
                      h('span', { className: 'text-[11px] bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded' }, 'ĐÃ HỦY'),
                    !g.isSenderIdentified &&
                      h('span', { className: 'text-[11px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded' }, 'CHƯA RÕ NGƯỜI GỬI'),
                    g.envelopeCode &&
                      h('span', { className: 'text-[11px] bg-gray-100 text-gray-700 font-mono px-2 py-0.5 rounded' }, `Mã: ${g.envelopeCode}`)
                  ),
                  g.receivedAt && h('p', { className: 'text-xs text-text-muted' }, `Nhận lúc ${new Date(g.receivedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`),
                  // Contributors list (AT25)
                  h(
                    'div',
                    { className: 'flex items-center gap-1.5 flex-wrap text-xs text-text-muted' },
                    h('span', { className: 'font-medium text-text-main' }, 'Người gửi:'),
                    g.contributors.length > 0
                      ? g.contributors.map((c, idx) =>
                          h(
                            'span',
                            { key: c.id, className: 'bg-surface border border-border-control px-2 py-0.5 rounded text-text-main' },
                            `${c.contributorName}${c.relationship ? ` (${c.relationship})` : ''}`
                          )
                        )
                      : h('span', { className: 'italic text-amber-700' }, 'Chưa xác định')
                  ),
                  g.returns.length > 0 &&
                    h(
                      'div',
                      { className: 'text-xs text-amber-700 font-medium' },
                      `Đã trả lại: ${g.returns.reduce((s, r) => s + BigInt(r.amount), 0n).toLocaleString('vi-VN')} ₫ • Còn giữ: ${BigInt(g.netAmount).toLocaleString('vi-VN')} ₫`
                    )
                ),

                // Actions
                h(
                  'div',
                  { className: 'flex items-center gap-2 shrink-0' },
                  !g.isVoided &&
                    h(
                      'div',
                      { className: 'flex items-center gap-2' },
                      g.isThanked
                        ? h(
                            'span',
                            { className: 'inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded' },
                            h(CheckCircle2, { className: 'w-3.5 h-3.5' }),
                            'Đã cảm ơn'
                          )
                        : h(
                            Button,
                            {
                              variant: 'ghost',
                              size: 'sm',
                              onClick: () => {
                                setSelectedGift(g);
                                setIsThankModalOpen(true);
                              },
                            },
                            'Ghi nhận cảm ơn'
                          ),
                      g.giftType === 'cash' &&
                        BigInt(g.netAmount) > 0n &&
                        h(
                          Button,
                          {
                            variant: 'secondary',
                            size: 'sm',
                            onClick: () => {
                              setSelectedGift(g);
                              setIsReturnModalOpen(true);
                            },
                          },
                          'Trả lại quà'
                        ),
                      h(
                        Button,
                        {
                          variant: 'ghost',
                          size: 'sm',
                          onClick: () => {
                            setSelectedGift(g);
                            setIsVoidModalOpen(true);
                          },
                        },
                        'Hủy'
                      )
                    )
                )
              )
            )
          )
    ),

    // Modal: Add Gift (with multi-contributor AT25)
    isAddModalOpen &&
      h(
        ModalDialog,
        { isOpen: true, title: 'Ghi Nhận Quà Mừng Mới', onClose: () => setIsAddModalOpen(false) },
        h(
          'form',
          {
            onSubmit: handleCreateGift,
            className: 'space-y-4',
          },
          h('label', { className: 'block text-sm space-y-1' }, 'Thời điểm nhận (giờ Việt Nam, để trống = hiện tại)', h('input', { type: 'datetime-local', value: receivedAt, className: 'w-full min-h-11 border rounded p-2', onChange: (e: React.ChangeEvent<HTMLInputElement>) => setReceivedAt(e.target.value) })),
          h(
            'div',
            { className: 'flex gap-2 border-b border-border-subtle pb-2' },
            h(
              'button',
              {
                type: 'button',
                onClick: () => setGiftType('cash'),
                className: `px-3 py-1.5 text-xs font-semibold rounded ${
                  giftType === 'cash' ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted'
                }`,
              },
              'Tiền mừng (VND)'
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setGiftType('physical'),
                className: `px-3 py-1.5 text-xs font-semibold rounded ${
                  giftType === 'physical' ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted'
                }`,
              },
              'Hiện vật'
            )
          ),
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            giftType === 'cash'
              ? h(
                  'div',
                  null,
                  h('label', { className: 'font-semibold text-text-main' }, 'Số tiền mừng (VND) *'),
                  h('input', {
                    type: 'text',
                    required: true,
                    value: amountInput, inputMode: 'numeric', pattern: '[0-9]+', title: 'Nhập số tiền nguyên bằng chữ số, ví dụ 500000', 'aria-label': 'Số tiền mừng (VND)',
                    onChange: (e) => setAmountInput(e.target.value),
                    placeholder: 'Ví dụ: 1000000',
                    className: 'w-full mt-1 p-2 font-mono border border-border-control rounded focus:ring-1 focus:ring-primary',
                  })
                )
              : h(
                  'div',
                  null,
                  h('label', { className: 'font-semibold text-text-main' }, 'Mô tả quà hiện vật *'),
                  h('input', {
                    type: 'text',
                    required: true,
                    value: descriptionInput, 'aria-label': 'Mô tả quà',
                    onChange: (e) => setDescriptionInput(e.target.value),
                    placeholder: 'Ví dụ: Bộ ấm chén gốm Bát Tràng',
                    className: 'w-full mt-1 p-2 border border-border-control rounded focus:ring-1 focus:ring-primary',
                  })
                ),
            h(
              'div',
              { className: 'grid grid-cols-2 gap-2' },
              h(
                'div',
                null,
                h('label', { className: 'font-semibold text-text-main' }, 'Mã phong bì (nếu có)'),
                h('input', {
                  type: 'text',
                  value: envelopeCodeInput,
                  onChange: (e) => setEnvelopeCodeInput(e.target.value),
                  placeholder: 'PB-012',
                  className: 'w-full mt-1 p-2 border border-border-control rounded',
                })
              ),
              h(
                'div',
                null,
                h('label', { className: 'font-semibold text-text-main' }, 'Người gửi hộ / đi thay'),
                h('input', {
                  type: 'text',
                  value: proxyInput,
                  onChange: (e) => setProxyInput(e.target.value),
                  placeholder: 'Gửi qua Anh Tuấn...',
                  className: 'w-full mt-1 p-2 border border-border-control rounded',
                })
              )
            ),

            // Multi-contributor joint envelope section (AT25)
            h(
              'div',
              { className: 'space-y-2 border-t border-border-subtle pt-3' },
              h(
                'div',
                { className: 'flex items-center justify-between' },
                h('label', { className: 'font-semibold text-text-main' }, 'Người gửi chung phong bì'),
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: addContributorRow,
                    className: 'text-xs text-primary font-bold hover:underline',
                  },
                  '+ Thêm người chung phong bì'
                )
              ),
              contributors.map((c, idx) =>
                h(
                  'div',
                  { key: idx, className: 'flex items-center gap-2' },
                  h('input', {
                    type: 'text',
                    required: true,
                    value: c.contributorName, 'aria-label': 'Tên người gửi',
                    onChange: (e) => updateContributor(idx, 'contributorName', e.target.value),
                    placeholder: `Tên người gửi ${idx + 1} *`,
                    className: 'flex-1 p-2 border border-border-control rounded',
                  }),
                  h('input', {
                    type: 'text',
                    value: c.relationship,
                    onChange: (e) => updateContributor(idx, 'relationship', e.target.value),
                    placeholder: 'Quan hệ',
                    className: 'w-28 p-2 border border-border-control rounded',
                  }),
                  contributors.length > 1 &&
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => removeContributorRow(idx),
                        className: 'text-red-500 font-bold px-1',
                      },
                      '✕'
                    )
                )
              )
            )
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsAddModalOpen(false) }, 'Đóng'),
            h(Button, { variant: 'primary', type: 'submit' }, 'Lưu quà mừng')
          )
        )
      ),

    // Modal: Return Gift
    isReturnModalOpen &&
      selectedGift &&
      h(
        ModalDialog,
        { isOpen: true, title: 'Ghi Nhận Trả Lại Tiền Mừng', onClose: () => setIsReturnModalOpen(false), maxWidth: 'sm' },
        h(
          'form',
          {
            onSubmit: handleReturn,
            className: 'space-y-4',
          },
          h(
            'p',
            { className: 'text-xs text-text-muted' },
            `Số tiền tối đa có thể trả lại: ${BigInt(selectedGift.netAmount).toLocaleString('vi-VN')} ₫`
          ),
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Số tiền trả lại (VND) *'),
              h('input', {
                type: 'text',
                required: true,
                value: returnAmount, inputMode: 'numeric', pattern: '[0-9]+', title: 'Nhập số tiền nguyên bằng chữ số, ví dụ 500000', 'aria-label': 'Số tiền trả lại',
                onChange: (e) => setReturnAmount(e.target.value),
                placeholder: 'Số tiền...',
                className: 'w-full mt-1 p-2 font-mono border border-border-control rounded',
              })
            ),
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Lý do trả lại *'),
              h('textarea', {
                rows: 2,
                required: true,
                value: returnReason, 'aria-label': 'Lý do trả lại',
                onChange: (e: any) => setReturnReason(e.target.value),
                placeholder: 'Ví dụ: Không nhận tiền mừng từ họ hàng gần...',
                className: 'w-full mt-1 p-2 border border-border-control rounded',
              })
            )
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsReturnModalOpen(false) }, 'Hủy'),
            h(Button, { variant: 'primary', type: 'submit' }, 'Xác nhận trả lại')
          )
        )
      ),

    // Modal: Void Gift
    isVoidModalOpen &&
      selectedGift &&
      h(
        ModalDialog,
        { isOpen: true, title: 'Hủy Bỏ Quà Mừng', onClose: () => setIsVoidModalOpen(false), maxWidth: 'sm' },
        h(
          'form',
          {
            onSubmit: handleVoid,
            className: 'space-y-4',
          },
          h(
            'p',
            { className: 'text-xs text-text-muted' },
            'Quà bị hủy sẽ được gắn nhãn và loại trừ hoàn toàn khỏi tổng kết tài chính.'
          ),
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Lý do hủy quà *'),
              h('textarea', {
                rows: 3,
                required: true,
                value: voidReason, 'aria-label': 'Lý do hủy quà',
                onChange: (e: any) => setVoidReason(e.target.value),
                placeholder: 'Ví dụ: Nhập trùng phong bì, sai thông tin khách...',
                className: 'w-full mt-1 p-2 border border-border-control rounded',
              })
            )
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsVoidModalOpen(false) }, 'Đóng'),
            h(Button, { variant: 'primary', type: 'submit' }, 'Xác nhận hủy')
          )
        )
      ),

    // Modal: Thank-You
    isThankModalOpen &&
      selectedGift &&
      h(
        ModalDialog,
        { isOpen: true, title: 'Ghi Nhận Lời Cảm Ơn', onClose: () => setIsThankModalOpen(false) },
        h(
          'form',
          {
            onSubmit: handleThank,
            className: 'space-y-4',
          },
          h(
            'div',
            { className: 'p-3 bg-gray-50 border border-border-control rounded text-xs space-y-2' },
            h('p', { className: 'font-semibold text-text-main' }, 'Mẫu tin nhắn cảm ơn (Copy-ready):'),
            h('p', { className: 'italic text-text-muted' }, etiquetteTemplate),
            h(
              Button,
              {
                type: 'button',
                variant: 'secondary',
                size: 'sm',
                leftIcon: h(copiedTemplate ? Check : Copy, { className: 'w-3.5 h-3.5' }),
                onClick: copyTemplate,
              },
              copiedTemplate ? 'Đã sao chép!' : 'Sao chép mẫu tin nhắn'
            )
          ),
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Kênh cảm ơn *'),
              h(
                'select',
                {
                  value: thankChannel,
                  onChange: (e: any) => setThankChannel(e.target.value as any),
                  className: 'w-full mt-1 p-2 border border-border-control rounded',
                },
                h('option', { value: 'in_person' }, 'Trực tiếp tại tiệc'),
                h('option', { value: 'call' }, 'Gọi điện thoại'),
                h('option', { value: 'zalo' }, 'Nhắn tin qua Zalo'),
                h('option', { value: 'sms' }, 'Nhắn tin SMS'),
                h('option', { value: 'card' }, 'Gửi thiệp cảm ơn')
              )
            )
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsThankModalOpen(false) }, 'Đóng'),
            h(Button, { variant: 'primary', type: 'submit' }, 'Ghi nhận đã cảm ơn')
          )
        )
      ),

    // Modal: Safe Cash Reconciliation
    isReconcileModalOpen &&
      h(
        ModalDialog,
        { isOpen: true, title: 'Đối Soát Két Tiền Thực Tế', onClose: () => setIsReconcileModalOpen(false), maxWidth: 'sm' },
        h(
          'form',
          {
            onSubmit: handleReconcile,
            className: 'space-y-4',
          },
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Số tiền đếm được trong két (VND) *'),
              h('input', {
                type: 'text',
                required: true,
                value: countedCash, inputMode: 'numeric', pattern: '[0-9]+', title: 'Nhập số tiền nguyên bằng chữ số, ví dụ 500000', 'aria-label': 'Tiền thực đếm',
                onChange: (e) => setCountedCash(e.target.value),
                placeholder: 'Nhập số tiền đếm thực tế...',
                className: 'w-full mt-1 p-2 font-mono border border-border-control rounded',
              })
            ),
            reconcileResult &&
              h(
                'div',
                {
                  className: `p-3 rounded text-xs font-semibold ${
                    reconcileResult.isBalanced
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`,
                },
                reconcileResult.isBalanced
                  ? '✓ Khớp hoàn toàn 100% với số dư sổ quà!'
                  : `⚠️ Chênh lệch: ${BigInt(reconcileResult.variance).toLocaleString('vi-VN')} ₫ so với sổ quà.`
              )
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsReconcileModalOpen(false) }, 'Đóng'),
            h(Button, { variant: 'primary', type: 'submit' }, 'Kiểm tra đối soát')
          )
        )
      )
  );
};
