'use client';

import * as React from 'react';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { useRole } from '@/context/RoleContext';
import {
  ReadinessDomainItem,
  R2Snapshot,
  DeltaChange,
  CreateSnapshotFormData,
} from './types';
import {
  INITIAL_READINESS_DOMAINS,
  INITIAL_R2_SNAPSHOTS,
  INITIAL_DELTA_CHANGES,
} from './fixtures';
import { ReadinessMatrix } from './ReadinessMatrix';
import { CreateSnapshotModal } from './CreateSnapshotModal';
import {
  Award,
  Printer,
  Camera,
  History,
  GitCompare,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  FileText,
  User,
  ShieldCheck,
} from 'lucide-react';

const h = React.createElement;

export interface R2SignoffDashboardProps {
  initialState?: PrototypeState;
  initialDomains?: ReadinessDomainItem[];
  initialSnapshots?: R2Snapshot[];
  initialDeltaChanges?: DeltaChange[];
  className?: string;
}

export const R2SignoffDashboard: React.FC<R2SignoffDashboardProps> = ({
  initialState = 'populated',
  initialDomains = INITIAL_READINESS_DOMAINS,
  initialSnapshots = INITIAL_R2_SNAPSHOTS,
  initialDeltaChanges = INITIAL_DELTA_CHANGES,
  className = '',
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default in isolation
  }
  const { isOwner, isFamily, canMutate } = roleContext;

  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [domains, setDomains] = React.useState<ReadinessDomainItem[]>(initialDomains);
  const [snapshots, setSnapshots] = React.useState<R2Snapshot[]>(initialSnapshots);
  const [deltaChanges, setDeltaChanges] = React.useState<DeltaChange[]>(initialDeltaChanges);

  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleCreateSnapshot = (data: CreateSnapshotFormData) => {
    if (!canMutate) return;
    const newSnapshot: R2Snapshot = {
      id: `snap_${Date.now()}`,
      version: data.version,
      createdAt: new Date().toISOString(),
      createdBy: isOwner ? 'Chủ sở hữu đám cưới' : 'Người điều phối',
      overallReadiness: 98,
      notes: data.notes,
      guestCount: 180,
      seatingCount: 180,
      mealCount: 180,
      handedOverAt: data.handedOverTo ? new Date().toISOString() : undefined,
      handedOverTo: data.handedOverTo,
      handoverChannel: data.handoverChannel,
    };
    setSnapshots([newSnapshot, ...snapshots]);
    // Clear delta changes as we just snapped
    setDeltaChanges([]);
    showToast(`Đã tạo bản chốt ${data.version} thành công!`);
  };

  const handleRecordHandover = (snapshotId: string) => {
    if (!canMutate) return;
    const recipient = prompt('Nhập tên người đại diện nhận bàn giao (Nhà hàng / MC / Ekip):');
    if (!recipient) return;

    setSnapshots((prev) =>
      prev.map((s) =>
        s.id === snapshotId
          ? {
              ...s,
              handedOverAt: new Date().toISOString(),
              handedOverTo: recipient,
              handoverChannel: 'Ghi nhận trực tiếp tại sảnh',
            }
          : s
      )
    );
    showToast('Đã ghi nhận bàn giao thành công');
  };

  const handlePrintA4Pack = () => {
    window.print();
  };

  // Average score
  const totalScore = domains.reduce((acc, d) => acc + d.score, 0);
  const avgScore = Math.round(totalScore / domains.length);

  return h(
    StateWrapper,
    {
      state,
      emptyDescription: 'Chưa có dữ liệu nghiệm thu cột mốc R2.',
      onRetry: () => setState('populated'),
    },
    h(
      'div',
      { className: `space-y-8 ${className}` },
      // Toast message
      toastMessage &&
        h(
          'div',
          {
            className:
              'fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2',
          },
          h(CheckCircle2, { className: 'w-4 h-4 text-emerald-400' }),
          toastMessage
        ),
      // Top Milestone R2 Hero Card
      h(
        'div',
        {
          className:
            'bg-gradient-to-r from-emerald-900 to-teal-800 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden',
        },
        h(
          'div',
          { className: 'space-y-2 max-w-xl' },
          h(
            'div',
            { className: 'flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider' },
            h(Award, { className: 'w-4 h-4' }),
            'Nghiệm thu Cột mốc R2 — Chuẩn Bị Toàn Diện'
          ),
          h(
            'h1',
            { className: 'text-2xl font-bold tracking-tight text-white' },
            'Bảng Tổng Hợp Bản Chốt & Bàn Giao Vận Hành'
          ),
          h(
            'p',
            { className: 'text-xs text-emerald-100 leading-relaxed' },
            'Hệ thống rà soát 8 trụ cột chuẩn bị đám cưới, đối chiếu cân đối giữa khách mời, sơ đồ bàn, thực đơn, xe cộ, đồ dùng thuê và đội ngũ hỗ trợ. Bản chốt snapshot được lưu bất biến.'
          )
        ),
        // Big readiness badge & actions
        h(
          'div',
          { className: 'flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-3 shrink-0' },
          h(
            'div',
            {
              className:
                'px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 flex items-center gap-3',
            },
            h(
              'div',
              { className: 'text-right' },
              h('div', { className: 'text-[11px] text-emerald-200' }, 'Chỉ số sẵn sàng R2'),
              h('div', { className: 'text-2xl font-black text-white font-mono' }, `${avgScore}%`)
            ),
            h(CheckCircle2, { className: 'w-8 h-8 text-emerald-400' })
          ),
          h(
            'div',
            { className: 'flex items-center gap-2' },
            h(
              'button',
              {
                type: 'button',
                onClick: handlePrintA4Pack,
                className:
                  'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-950 bg-emerald-100 hover:bg-white rounded-lg transition shadow-xs',
              },
              h(Printer, { className: 'w-3.5 h-3.5' }),
              'Xuất bộ tài liệu in A4'
            ),
            canMutate &&
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => setIsSnapshotModalOpen(true),
                  className:
                    'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition shadow-xs',
                },
                h(Camera, { className: 'w-3.5 h-3.5' }),
                'Tạo bản chốt R2 (Snapshot)'
              )
          )
        )
      ),
      // Section 1: 8 Readiness Domain Cards
      h(ReadinessMatrix, { domains }),
      // Section 2: Delta Changes (Chênh lệch so với bản chốt gần nhất)
      h(
        'div',
        {
          className:
            'bg-surface rounded-xl border border-gray-200 p-5 shadow-2xs space-y-3.5 print:hidden',
        },
        h(
          'div',
          { className: 'flex items-center justify-between pb-2 border-b border-gray-100' },
          h(
            'div',
            { className: 'flex items-center gap-2 text-gray-900 font-bold text-sm' },
            h(GitCompare, { className: 'w-4 h-4 text-primary' }),
            'Chênh Lệch Dữ Liệu So Với Bản Chốt Gần Nhất (Delta)'
          ),
          h(
            'span',
            { className: 'text-xs text-gray-500' },
            `Phiên bản gốc: ${snapshots[0]?.version || 'Chưa có'}`
          )
        ),
        deltaChanges.length === 0
          ? h(
              'div',
              { className: 'py-4 text-center text-xs text-emerald-700 bg-emerald-50 rounded-lg' },
              'Dữ liệu hiện tại hoàn toàn khớp với bản chốt gần nhất, không có chênh lệch phát sinh.'
            )
          : h(
              'div',
              { className: 'space-y-2' },
              deltaChanges.map((delta, idx) =>
                h(
                  'div',
                  {
                    key: idx,
                    className:
                      'p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 flex items-start gap-2.5 text-xs text-amber-900',
                  },
                  h(AlertTriangle, { className: 'w-4 h-4 text-amber-600 shrink-0 mt-0.5' }),
                  h(
                    'div',
                    {},
                    h('span', { className: 'font-bold mr-1' }, `[${delta.domain}]:`),
                    h('span', {}, delta.description)
                  )
                )
              )
            )
      ),
      // Section 3: Immutable Snapshots History Table
      h(
        'div',
        { className: 'bg-surface rounded-xl border border-gray-200 overflow-hidden shadow-2xs space-y-0' },
        h(
          'div',
          {
            className:
              'px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60',
          },
          h(
            'div',
            { className: 'flex items-center gap-2 font-bold text-sm text-gray-900' },
            h(History, { className: 'w-4 h-4 text-primary' }),
            'Lịch Sử Các Bản Chốt Bất Biến (Immutable Snapshots)'
          ),
          h(
            'span',
            { className: 'text-xs text-gray-500' },
            `${snapshots.length} bản snapshot đã lưu`
          )
        ),
        // Snapshots list / table
        h(
          'div',
          { className: 'divide-y divide-gray-100' },
          snapshots.map((snap) =>
            h(
              'div',
              {
                key: snap.id,
                className: 'p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/40 transition',
                'data-testid': `snapshot-row-${snap.id}`,
              },
              // Left: Info & metrics
              h(
                'div',
                { className: 'space-y-1.5 flex-1' },
                h(
                  'div',
                  { className: 'flex items-center gap-2 flex-wrap' },
                  h(
                    'span',
                    {
                      className:
                        'px-2 py-0.5 rounded text-xs font-mono font-bold bg-primary/10 text-primary',
                    },
                    snap.version
                  ),
                  h(
                    'span',
                    { className: 'text-xs text-gray-500' },
                    `Tạo lúc: ${new Date(snap.createdAt).toLocaleString('vi-VN')}`
                  ),
                  h(
                    'span',
                    { className: 'text-xs text-gray-500' },
                    `bởi ${snap.createdBy}`
                  )
                ),
                snap.notes &&
                  h('p', { className: 'text-xs text-gray-600 line-clamp-1 italic' }, snap.notes),
                // Quantities balance
                h(
                  'div',
                  { className: 'flex items-center gap-4 text-xs font-medium text-gray-700 pt-1' },
                  h('span', {}, `Khách: ${snap.guestCount}`),
                  h('span', { className: 'text-gray-300' }, '|'),
                  h('span', {}, `Ghế ngồi: ${snap.seatingCount}`),
                  h('span', { className: 'text-gray-300' }, '|'),
                  h('span', {}, `Suất ăn: ${snap.mealCount}`),
                  h('span', { className: 'text-gray-300' }, '|'),
                  h(
                    'span',
                    { className: 'text-emerald-700 font-semibold' },
                    `Độ sẵn sàng: ${snap.overallReadiness}%`
                  )
                )
              ),
              // Right: Handover status & button
              h(
                'div',
                { className: 'flex items-center gap-3 shrink-0 self-start md:self-center' },
                snap.handedOverAt
                  ? h(
                      'div',
                      {
                        className:
                          'p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-0.5',
                      },
                      h(
                        'div',
                        { className: 'flex items-center gap-1 font-bold' },
                        h(CheckCircle2, { className: 'w-3.5 h-3.5 text-emerald-600' }),
                        `Đã bàn giao cho: ${snap.handedOverTo}`
                      ),
                      h(
                        'div',
                        { className: 'text-[11px] text-emerald-700' },
                        `Lúc ${new Date(snap.handedOverAt).toLocaleString('vi-VN')} (${snap.handoverChannel || 'Trực tiếp'})`
                      )
                    )
                  : h(
                      'div',
                      { className: 'flex items-center gap-2' },
                      h(
                        'span',
                        { className: 'text-xs text-gray-400 italic' },
                        'Chưa ghi nhận bàn giao'
                      ),
                      canMutate &&
                        h(
                          'button',
                          {
                            type: 'button',
                            onClick: () => handleRecordHandover(snap.id),
                            className:
                              'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition font-medium',
                          },
                          h(Send, { className: 'w-3 h-3 text-emerald-600' }),
                          'Ghi nhận bàn giao'
                        )
                    )
              )
            )
          )
        )
      ),
      // Printable A4 section (rendered in print mode)
      h(
        'div',
        { className: 'hidden print:block p-4 space-y-6' },
        h(
          'div',
          { className: 'border-b pb-4' },
          h('h1', { className: 'text-xl font-bold' }, 'BỘ TÀI LIỆU BÀN GIAO CỘT MỐC R2'),
          h(
            'p',
            { className: 'text-xs text-gray-600 mt-1' },
            `Phiên bản: ${snapshots[0]?.version || 'R2-v1.0'} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`
          )
        ),
        h(
          'div',
          { className: 'space-y-2 text-sm' },
          h('h3', { className: 'font-bold' }, '1. TỔNG HỢP CÂN ĐỐI VẬN HÀNH:'),
          h('p', {}, `• Khách mời xác nhận: 180 khách`),
          h('p', {}, `• Sơ đồ bàn: 18 bàn tròn (180 ghế ngồi, khớp 100%)`),
          h('p', {}, `• Thực đơn: 180 suất chính + 5 suất ăn chay riêng`),
          h('p', {}, `• Lưu trú & Xe: 10 phòng KS Grand Plaza, 2 xe đón 29 chỗ`),
          h('p', {}, `• Đồ thuê: 2 hạng mục cần hoàn trả đúng hạn`)
        )
      ),
      // Snapshot creation modal
      h(CreateSnapshotModal, {
        isOpen: isSnapshotModalOpen,
        onClose: () => setIsSnapshotModalOpen(false),
        onSubmit: handleCreateSnapshot,
        nextVersionSuggestion: `R2-v1.${snapshots.length}`,
        guestCount: 180,
        seatingCount: 180,
        mealCount: 180,
      })
    )
  );
};
