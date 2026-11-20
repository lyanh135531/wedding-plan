'use client';

import * as React from 'react';
import { api } from '@/lib/api/request';
import { useSaveAction } from '@/components/common/useSaveAction';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/ui/dialog';
import { useRole } from '@/context/RoleContext';
import {
  FileText,
  Printer,
  Camera,
  Send,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Users,
  Utensils,
  Phone,
  CheckSquare,
} from 'lucide-react';

const h = React.createElement;

export interface HandoverPacketData {
  timeline?: Array<{
    id: string;
    title: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    locationName?: string | null;
    personInCharge?: string | null;
    status: string;
  }>;
  seating?: {
    tablesCount: number;
    assignedSeatsCount: number;
    tables: Array<{
      id: string;
      name: string;
      tableNumber?: string | null;
      capacity: number;
    }>;
  };
  catering?: {
    menusCount: number;
    totalMealsNeeded: number;
  };
  support?: Array<{
    id: string;
    name: string;
    phone: string;
    roles: string[];
    arrivalTime?: string | null;
  }>;
  checklist?: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    isRental: boolean;
  }>;
}

export interface HandoverSnapshotItem {
  snapshotData?: HandoverPacketData;
  id: string;
  version: number;
  title: string;
  handoverStatus: string;
  handedOverTo: string | null;
  handedOverAt: string | null;
  handedOverChannel: string | null;
  isSharedWithFamily: boolean;
  createdAt: string;
}

export interface HandoversDashboardProps {
  eventId: string;
}

export const HandoversDashboard: React.FC<HandoversDashboardProps> = ({ eventId }) => {
  const { isOwner } = useRole();
  const { saving, saveError, runSave } = useSaveAction();
  const generation = React.useRef(0);
  const [refresh, setRefresh] = React.useState(0);
  const [shared, setShared] = React.useState(false);
  const [liveData, setLiveData] = React.useState<HandoverPacketData | null>(null);
  const [snapshots, setSnapshots] = React.useState<HandoverSnapshotItem[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = React.useState<string | null>(null);
  const [diffInfo, setDiffInfo] = React.useState<{ hasChanges: boolean; diffSummary: string } | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Modals state
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = React.useState(false);
  const [snapshotTitle, setSnapshotTitle] = React.useState('');
  const [isDeliverModalOpen, setIsDeliverModalOpen] = React.useState(false);
  const [recipientName, setRecipientName] = React.useState('');
  const [deliverChannel, setDeliverChannel] = React.useState('Trực tiếp tại sảnh tiệc');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setErrorMsg(null);
    try {
      if (!eventId) { setLiveData(null); setSnapshots([]); return; }
      const [live, snapshots] = await Promise.all([
        api<{ data: HandoverPacketData }>(`/api/v1/handovers/packet?eventId=${eventId}`),
        api<{ data: HandoverSnapshotItem[] }>(`/api/v1/handovers/snapshots?eventId=${eventId}`),
      ]);
      if (request !== generation.current) return;
      setLiveData(live.data); setSnapshots(snapshots.data);
      setSelectedSnapshotId((current) => snapshots.data.some((snapshot) => snapshot.id === current) ? current : snapshots.data[0]?.id || null);
      setRefresh((value) => value + 1);
    } catch (error) { if (request === generation.current) setErrorMsg((error as Error).message); }
    finally { if (request === generation.current) setLoading(false); }
  }, [eventId]);

  React.useEffect(() => {
    setSelectedSnapshotId(null); setDiffInfo(null); setLiveData(null); setSnapshots([]);
    void fetchData();
    return () => { generation.current++; };
  }, [fetchData]);

  // Fetch delta diff when snapshot changes (FL13)
  React.useEffect(() => {
    let cancelled = false;
    setDiffInfo(null);
    if (selectedSnapshotId) {
      fetch(`/api/v1/handovers/snapshots/${selectedSnapshotId}/diff`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (!cancelled && json?.data) {
            setDiffInfo(json.data);
          }
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [selectedSnapshotId, refresh]);

  const handleCreateSnapshot = (event: React.FormEvent) => {
    event.preventDefault();
    void runSave(async () => {
      const response = await api<{ data: HandoverSnapshotItem }>('/api/v1/handovers/packet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, title: snapshotTitle.trim() || `Bản chốt vận hành ${new Date().toLocaleDateString('vi-VN')}`, isSharedWithFamily: shared }),
      });
      setSelectedSnapshotId(response.data.id);
      setIsSnapshotModalOpen(false); setSnapshotTitle('');
      await fetchData();
    });
  };
  const handleDeliver = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSnapshotId) return;
    void runSave(async () => {
      await api(`/api/v1/handovers/snapshots/${selectedSnapshotId}/deliver`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handedOverTo: recipientName.trim(), handedOverChannel: deliverChannel.trim() }),
      });
      setIsDeliverModalOpen(false); setRecipientName('');
      await fetchData();
    });
  };
  const selectedSnapshot = snapshots.find((snapshot) => snapshot.id === selectedSnapshotId);
  const displayData = selectedSnapshot ? selectedSnapshot.snapshotData : liveData;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return h(
    'div',
    { className: 'space-y-6 w-full min-w-0 max-w-7xl mx-auto p-4 sm:p-6 print:p-0 print:m-0' },
    // Header (hidden on print)
    h(
      'div',
      { className: 'flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-border-subtle pb-4 print:hidden' },
      h(
        'div',
        null,
        h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Bộ Bàn Giao Ngày Cưới (Handover Pack)'),
        h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Tài liệu chuẩn A4 bàn giao cho nhà hàng, điều phối tiệc và ekip hỗ trợ')
      ),
      h(
        'div',
        { className: 'flex flex-wrap items-center gap-3' },
        h(
          Button,
          {
            variant: 'secondary',
            leftIcon: h(Printer, { className: 'w-4 h-4' }),
            onClick: handlePrint,
          },
          'In bộ tài liệu A4'
        ),
        isOwner && selectedSnapshotId && h(Button, {
          variant: 'secondary', disabled: saving || !diffInfo || diffInfo.hasChanges,
          onClick: () => setIsDeliverModalOpen(true),
        }, 'Ghi nhận bàn giao'),
        isOwner &&
          h(
            Button,
            {
              variant: 'primary',
              leftIcon: h(Camera, { className: 'w-4 h-4' }),
              onClick: () => setIsSnapshotModalOpen(true),
            },
            '+ Chốt bản bàn giao'
          )
      )
    ),

    loading && h('p', { role: 'status' }, 'Đang tải bộ bàn giao…'),
    saveError && h('p', { role: 'alert', className: 'text-danger' }, saveError),
    selectedSnapshot && h('p', { className: 'font-semibold' }, `Đang xem bản chốt v${selectedSnapshot.version}: ${selectedSnapshot.title}`),
    // Error alert
    errorMsg &&
      h(
        'div',
        { role: 'alert', className: 'p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-control flex items-center justify-between print:hidden' },
        h('span', null, errorMsg),
        h('button', { type: 'button', onClick: () => setErrorMsg(null), className: 'font-bold' }, '✕')
      ),

    // Delta diff alert banner (FL13) (hidden on print)
    diffInfo &&
      diffInfo.hasChanges &&
      h(
        'div',
        { className: 'p-4 bg-amber-50 border-2 border-amber-300 rounded-card flex flex-col md:flex-row items-start gap-3 shadow-sm print:hidden' },
        h(AlertTriangle, { className: 'w-5 h-5 text-amber-600 shrink-0 mt-0.5' }),
        h(
          'div',
          { className: 'flex-1 min-w-0' },
          h('p', { className: 'font-bold text-sm text-amber-900' }, 'Phát hiện thay đổi sau bản chốt bàn giao!'),
          h('p', { className: 'text-xs text-amber-800 mt-0.5' }, diffInfo.diffSummary),
          h(
            'p',
            { className: 'text-[11px] text-amber-700 mt-1 italic' },
            'Vui lòng xuất bản chốt mới hoặc thông báo cho quản lý nhà hàng để cập nhật số lượng chỗ ngồi & suất ăn.'
          )
        ),
        isOwner &&
          h(
            Button,
            {
              variant: 'secondary',
              size: 'sm',
              leftIcon: h(Send, { className: 'w-3.5 h-3.5' }),
              onClick: () => setIsSnapshotModalOpen(true),
            },
            'Tạo bản chốt cập nhật'
          )
      ),

    // Version switcher (print:hidden)
    snapshots.length > 0 &&
      h(
        'div',
        { className: 'flex min-w-0 items-center gap-2 overflow-x-auto pb-1 text-xs print:hidden' },
        h('span', { className: 'font-semibold text-text-muted shrink-0' }, 'Lịch sử bản chốt:'),
        snapshots.map((s) =>
          h(
            'button',
            {
              key: s.id,
              type: 'button',
              onClick: () => setSelectedSnapshotId(s.id),
              className: `shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full border font-medium ${
                selectedSnapshotId === s.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-text-main border-border-control'
              }`,
            },
            `Bản v${s.version}: ${s.title}${s.handoverStatus === 'handed_over' ? ' (Đã giao)' : ''}`
          )
        )
      ),

    // A4 Printable Document Body
    h(
      'div',
      { className: 'bg-surface border border-border-subtle rounded-card shadow-sm p-6 sm:p-10 space-y-8 print:border-none print:shadow-none print:p-0' },
      // Document header with event info & export timestamp
      h(
        'div',
        { className: 'border-b-2 border-primary pb-4 flex flex-col md:flex-row print:flex-row justify-between items-start gap-3' },
        h(
          'div',
          null,
          h('h2', { className: 'text-xl font-bold text-primary uppercase tracking-wide' }, 'BỘ TÀI LIỆU BÀN GIAO NGÀY CƯỚI'),
          h('p', { className: 'text-xs text-text-muted mt-0.5' }, `Ngày in: ${new Date().toLocaleString('vi-VN')} • Bản chốt vận hành chính thức`)
        ),
        h(
          'div',
          { className: 'text-right' },
          h('span', { className: 'text-xs font-mono font-bold px-2.5 py-1 bg-primary/10 text-primary rounded' }, 'A4 OFF-LINE READY'),
          h('p', { className: 'text-[11px] text-text-muted mt-1' }, 'Bảo mật: Phân quyền đã lọc')
        )
      ),

      // Section 1: Timeline
      displayData?.timeline &&
        h(
          'div',
          { className: 'space-y-3' },
          h(
            'div',
            { className: 'flex items-center gap-2 border-b border-border-subtle pb-1.5' },
            h(Clock, { className: 'w-4 h-4 text-primary' }),
            h('h3', { className: 'text-sm font-bold text-text-main uppercase tracking-wider' }, '1. Lịch Trình Chi Tiết Các Mốc Nghi Lễ')
          ),
          h(
            'div',
            { className: 'divide-y divide-border-subtle text-xs' },
            displayData.timeline.map((t) =>
              h(
                'div',
                { key: t.id, className: 'py-2 flex items-start justify-between gap-4' },
                h(
                  'div',
                  null,
                  h('p', { className: 'font-bold text-text-main' }, t.title),
                  h('p', { className: 'text-text-muted mt-0.5' }, `📍 ${t.locationName || 'Tại sảnh'} • Phụ trách: ${t.personInCharge || 'Ban tổ chức'}`)
                ),
                h(
                  'span',
                  { className: 'font-mono font-semibold text-text-main shrink-0' },
                  `${new Date(t.scheduledStartTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — ${new Date(t.scheduledEndTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                )
              )
            )
          )
        ),

      // Section 2: Seating & Catering Headcount
      h(
        'div',
        { className: 'space-y-3' },
        h(
          'div',
          { className: 'flex items-center gap-2 border-b border-border-subtle pb-1.5' },
          h(Utensils, { className: 'w-4 h-4 text-primary' }),
          h('h3', { className: 'text-sm font-bold text-text-main uppercase tracking-wider' }, '2. Bàn Tiệc & Suất Ăn Phục Vụ')
        ),
        h(
          'div',
          { className: 'grid grid-cols-2 gap-4 text-xs' },
          h(
            'div',
            { className: 'p-3 bg-gray-50 border border-border-subtle rounded' },
            h('p', { className: 'font-semibold text-text-muted' }, 'Tổng số bàn tiệc đã xếp'),
            h('p', { className: 'text-xl font-bold text-text-main mt-1' }, `${displayData?.seating?.tablesCount || 0} bàn`)
          ),
          h(
            'div',
            { className: 'p-3 bg-gray-50 border border-border-subtle rounded' },
            h('p', { className: 'font-semibold text-text-muted' }, 'Suất ăn phục vụ xác nhận'),
            h('p', { className: 'text-xl font-bold text-primary mt-1' }, `${displayData?.catering?.totalMealsNeeded || 0} phần ăn`)
          )
        )
      ),

      // Section 3: Key Support Personnel Directory
      displayData?.support &&
        h(
          'div',
          { className: 'space-y-3' },
          h(
            'div',
            { className: 'flex items-center gap-2 border-b border-border-subtle pb-1.5' },
            h(Phone, { className: 'w-4 h-4 text-primary' }),
            h('h3', { className: 'text-sm font-bold text-text-main uppercase tracking-wider' }, '3. Danh Bạ Đầu Mối Hỗ Trợ Khẩn Cấp')
          ),
          h(
            'div',
            { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs' },
            displayData.support.map((s) =>
              h(
                'div',
                { key: s.id, className: 'p-2.5 bg-gray-50 border border-border-subtle rounded flex justify-between items-center' },
                h(
                  'div',
                  null,
                  h('p', { className: 'font-bold text-text-main' }, s.name),
                  h('p', { className: 'text-text-muted text-[11px]' }, s.roles.join(', '))
                ),
                h('span', { className: 'font-mono font-bold text-primary' }, `📞 ${s.phone}`)
              )
            )
          )
        ),

      // Section 4: Acknowledgment Signature Block (A4 standard)
      h(
        'div',
        { className: 'pt-8 border-t border-border-subtle grid grid-cols-2 gap-8 text-center text-xs' },
        h(
          'div',
          { className: 'space-y-12' },
          h('p', { className: 'font-bold text-text-main' }, 'ĐẠI DIỆN GIA ĐÌNH / ĐIỀU PHỐI'),
          h('p', { className: 'text-text-muted italic' }, '(Ký và ghi rõ họ tên)')
        ),
        h(
          'div',
          { className: 'space-y-12' },
          h('p', { className: 'font-bold text-text-main' }, 'ĐẠI DIỆN TRUNG TÂM TIỆC CƯỚI / ĐỐI TÁC'),
          h('p', { className: 'text-text-muted italic' }, '(Ký xác nhận nhận đủ bàn giao)')
        )
      )
    ),

    // Modal: Create Snapshot
    isSnapshotModalOpen &&
      h(
        ModalDialog,
        { isOpen: true, title: 'Chốt bản bàn giao mới', onClose: () => setIsSnapshotModalOpen(false), maxWidth: 'sm' },
        h(
          'form',
          {
            onSubmit: handleCreateSnapshot,
            className: 'space-y-4',
          },
          saveError && h('p', { role: 'alert', className: 'text-danger' }, saveError),
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { htmlFor: 'handover-title-input', className: 'font-semibold text-text-main' }, 'Tên bản chốt *'),
              h('input', {
                type: 'text',
                required: true,
                id: 'handover-title-input',
                value: snapshotTitle,
                onChange: (e) => setSnapshotTitle(e.target.value),
                placeholder: 'Ví dụ: Bản chốt giao nhà hàng White Palace v1',
                className: 'w-full mt-1 p-2 border border-border-control rounded',
              })
            )
          ),
          h(
            'div',
            { className: 'flex flex-wrap justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsSnapshotModalOpen(false) }, 'Hủy'),
            h('label', { className: 'flex items-center gap-2' }, h('input', { type: 'checkbox', checked: shared, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setShared(e.target.checked) }), 'Chia sẻ bản chốt với người nhà'),
            h(Button, { variant: 'primary', type: 'submit', disabled: saving }, 'Tạo bản chốt')
          )
        )
      ),

    // Modal: Deliver Handover
    isDeliverModalOpen &&
      h(
        ModalDialog,
        { isOpen: true, title: 'Ghi nhận đã bàn giao', onClose: () => setIsDeliverModalOpen(false), maxWidth: 'sm' },
        h(
          'form',
          {
            onSubmit: handleDeliver,
            className: 'space-y-4',
          },
          saveError && h('p', { role: 'alert', className: 'text-danger' }, saveError),
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { htmlFor: 'handover-recipient-input', className: 'font-semibold text-text-main' }, 'Người / Đơn vị nhận bàn giao *'),
              h('input', {
                type: 'text',
                required: true,
                id: 'handover-recipient-input',
                value: recipientName,
                onChange: (e) => setRecipientName(e.target.value),
                placeholder: 'Ví dụ: Quản lý sảnh tiệc - Anh Hoàng',
                className: 'w-full mt-1 p-2 border border-border-control rounded',
              })
            ),
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Kênh bàn giao'),
              h('input', {
                type: 'text',
                value: deliverChannel,
                'aria-label': 'Kênh bàn giao',
                onChange: (e) => setDeliverChannel(e.target.value),
                className: 'w-full mt-1 p-2 border border-border-control rounded',
              })
            )
          ),
          h(
            'div',
            { className: 'flex flex-wrap justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsDeliverModalOpen(false) }, 'Đóng'),
            h(Button, { variant: 'primary', type: 'submit', disabled: saving }, 'Xác nhận đã bàn giao')
          )
        )
      )
  );
};
