'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
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

  // Fetch live pack data and snapshots
  const fetchData = React.useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [liveRes, snapRes] = await Promise.all([
        fetch(`/api/v1/handovers/packet?eventId=${eventId}`),
        fetch(`/api/v1/handovers/snapshots?eventId=${eventId}`),
      ]);

      if (liveRes.ok) {
        const json = await liveRes.json();
        setLiveData(json.data);
      }
      if (snapRes.ok) {
        const json = await snapRes.json();
        setSnapshots(json.data || []);
        if (json.data?.length > 0 && !selectedSnapshotId) {
          setSelectedSnapshotId(json.data[0].id);
        }
      }
    } catch (err) {
      console.error('Lỗi tải bộ bàn giao:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId, selectedSnapshotId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch delta diff when snapshot changes (FL13)
  React.useEffect(() => {
    if (selectedSnapshotId) {
      fetch(`/api/v1/handovers/snapshots/${selectedSnapshotId}/diff`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.data) {
            setDiffInfo(json.data);
          }
        })
        .catch(() => {});
    }
  }, [selectedSnapshotId]);

  // Create snapshot
  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/handovers/packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          title: snapshotTitle.trim() || `Bản chốt vận hành ${new Date().toLocaleDateString('vi-VN')}`,
        }),
      });

      if (res.ok) {
        setIsSnapshotModalOpen(false);
        setSnapshotTitle('');
        fetchData();
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.message || 'Lỗi tạo bản chốt');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    }
  };

  // Deliver handover
  const handleDeliver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSnapshotId) return;

    try {
      const res = await fetch(`/api/v1/handovers/snapshots/${selectedSnapshotId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handedOverTo: recipientName.trim(),
          handedOverChannel: deliverChannel.trim(),
        }),
      });

      if (res.ok) {
        setIsDeliverModalOpen(false);
        setRecipientName('');
        fetchData();
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.message || 'Lỗi ghi nhận bàn giao');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ');
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return h(
    'div',
    { className: 'space-y-6 max-w-7xl mx-auto p-4 sm:p-6 print:p-0 print:m-0' },
    // Header (hidden on print)
    h(
      'div',
      { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-4 print:hidden' },
      h(
        'div',
        null,
        h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Bộ Bàn Giao Ngày Cưới (Handover Pack)'),
        h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Tài liệu chuẩn A4 bàn giao cho nhà hàng, điều phối tiệc và ekip hỗ trợ')
      ),
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h(
          Button,
          {
            variant: 'secondary',
            leftIcon: h(Printer, { className: 'w-4 h-4' }),
            onClick: handlePrint,
          },
          'In bộ tài liệu A4'
        ),
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

    // Error alert
    errorMsg &&
      h(
        'div',
        { className: 'p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-control flex items-center justify-between print:hidden' },
        h('span', null, errorMsg),
        h('button', { type: 'button', onClick: () => setErrorMsg(null), className: 'font-bold' }, '✕')
      ),

    // Delta diff alert banner (FL13) (hidden on print)
    diffInfo &&
      diffInfo.hasChanges &&
      h(
        'div',
        { className: 'p-4 bg-amber-50 border-2 border-amber-300 rounded-card flex items-start gap-3 shadow-sm print:hidden' },
        h(AlertTriangle, { className: 'w-5 h-5 text-amber-600 shrink-0 mt-0.5' }),
        h(
          'div',
          { className: 'flex-1' },
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
              onClick: () => setIsDeliverModalOpen(true),
            },
            'Bàn giao lại'
          )
      ),

    // Version switcher (print:hidden)
    snapshots.length > 0 &&
      h(
        'div',
        { className: 'flex items-center gap-2 overflow-x-auto pb-1 text-xs print:hidden' },
        h('span', { className: 'font-semibold text-text-muted shrink-0' }, 'Lịch sử bản chốt:'),
        snapshots.map((s) =>
          h(
            'button',
            {
              key: s.id,
              type: 'button',
              onClick: () => setSelectedSnapshotId(s.id),
              className: `px-3 py-1.5 rounded-full border font-medium ${
                selectedSnapshotId === s.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-main border-border-control'
              }`,
            },
            `Bản v${s.version}: ${s.title}${s.handoverStatus === 'handed_over' ? ' (Đã giao)' : ''}`
          )
        )
      ),

    // A4 Printable Document Body
    h(
      'div',
      { className: 'bg-white border border-border-subtle rounded-card shadow-sm p-6 sm:p-10 space-y-8 print:border-none print:shadow-none print:p-0' },
      // Document header with event info & export timestamp
      h(
        'div',
        { className: 'border-b-2 border-primary pb-4 flex justify-between items-start' },
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
      liveData?.timeline &&
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
            liveData.timeline.map((t) =>
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
            h('p', { className: 'text-xl font-bold text-text-main mt-1' }, `${liveData?.seating?.tablesCount || 0} bàn`)
          ),
          h(
            'div',
            { className: 'p-3 bg-gray-50 border border-border-subtle rounded' },
            h('p', { className: 'font-semibold text-text-muted' }, 'Suất ăn phục vụ xác nhận'),
            h('p', { className: 'text-xl font-bold text-primary mt-1' }, `${liveData?.catering?.totalMealsNeeded || 0} phần ăn`)
          )
        )
      ),

      // Section 3: Key Support Personnel Directory
      liveData?.support &&
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
            liveData.support.map((s) =>
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
        'div',
        { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm' },
        h(
          'form',
          {
            onSubmit: handleCreateSnapshot,
            className: 'bg-surface w-full max-w-sm rounded-card border border-border-control p-6 space-y-4',
          },
          h('h3', { className: 'text-base font-bold text-text-main' }, 'Chốt Bản Bàn Giao Mới (Snapshot)'),
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Tên bản chốt *'),
              h('input', {
                type: 'text',
                required: true,
                value: snapshotTitle,
                onChange: (e) => setSnapshotTitle(e.target.value),
                placeholder: 'Ví dụ: Bản chốt giao nhà hàng White Palace v1',
                className: 'w-full mt-1 p-2 border border-border-control rounded',
              })
            )
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsSnapshotModalOpen(false) }, 'Hủy'),
            h(Button, { variant: 'primary', type: 'submit' }, 'Tạo bản chốt')
          )
        )
      ),

    // Modal: Deliver Handover
    isDeliverModalOpen &&
      h(
        'div',
        { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm' },
        h(
          'form',
          {
            onSubmit: handleDeliver,
            className: 'bg-surface w-full max-w-sm rounded-card border border-border-control p-6 space-y-4',
          },
          h('h3', { className: 'text-base font-bold text-text-main' }, 'Ghi Nhận Đã Bàn Giao'),
          h(
            'div',
            { className: 'space-y-3 text-xs' },
            h(
              'div',
              null,
              h('label', { className: 'font-semibold text-text-main' }, 'Người / Đơn vị nhận bàn giao *'),
              h('input', {
                type: 'text',
                required: true,
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
                onChange: (e) => setDeliverChannel(e.target.value),
                className: 'w-full mt-1 p-2 border border-border-control rounded',
              })
            )
          ),
          h(
            'div',
            { className: 'flex justify-end gap-2 pt-3 border-t border-border-subtle' },
            h(Button, { variant: 'secondary', type: 'button', onClick: () => setIsDeliverModalOpen(false) }, 'Đóng'),
            h(Button, { variant: 'primary', type: 'submit' }, 'Xác nhận đã bàn giao')
          )
        )
      )
  );
};
