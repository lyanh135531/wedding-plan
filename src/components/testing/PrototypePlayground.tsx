'use client';

import { useState } from 'react';
import { RoleProvider, useRole } from '@/context/RoleContext';
import { EventScopeProvider } from '@/context/EventScopeContext';
import { PageShell } from '@/components/layout/PageShell';
import { OverviewDashboard } from '@/components/modules/overview/OverviewDashboard';
import { GuestsDirectory } from '@/components/modules/guests/GuestsDirectory';
import { BudgetScreen } from '@/components/modules/finance/BudgetScreen';
import { PaymentsLedgerScreen } from '@/components/modules/finance/PaymentsLedgerScreen';
import { TasksManager } from '@/components/modules/tasks/TasksManager';
import { SeatingManager } from '@/components/modules/seating/SeatingManager';
import { TimelineManager } from '@/components/modules/timeline/TimelineManager';
import type { PrototypeState } from './PrototypeToolbar';

const screens = [
  { path: '/overview', label: 'Tổng quan', Component: OverviewDashboard, finance: false },
  { path: '/guests', label: 'Khách mời / RSVP', Component: GuestsDirectory, finance: false },
  { path: '/budget', label: 'Ngân sách', Component: BudgetScreen, finance: true },
  { path: '/payments', label: 'Thanh toán', Component: PaymentsLedgerScreen, finance: true },
  { path: '/tasks', label: 'Công việc', Component: TasksManager, finance: false },
  { path: '/seating', label: 'Xếp bàn', Component: SeatingManager, finance: false },
  { path: '/timeline', label: 'Ngày cưới', Component: TimelineManager, finance: false },
];

function Playground() {
  const [path, setPath] = useState('/overview');
  const [state, setState] = useState<PrototypeState>('populated');
  const [reset, setReset] = useState(0);
  const { role, setRoleForPreview, isOwner } = useRole();
  const screen = screens.find((item) => item.path === path) || screens[0];
  const Component = screen.Component;

  return <div onClickCapture={(event) => {
    const link = (event.target as HTMLElement).closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (href?.startsWith('/') && !href.startsWith('//')) {
      event.preventDefault(); event.stopPropagation();
      if (screens.some((item) => item.path === href)) setPath(href);
    }
  }}>
    <PageShell title={`Bản dùng thử · ${screen.label}`}>
      <div className="mb-6 rounded-card border border-amber-300 bg-amber-50 p-4 space-y-3">
        <p className="font-semibold">Prototype — dữ liệu minh họa, không cần đăng nhập</p>
        <p className="text-sm">Bạn có thể thử các nút và biểu mẫu. Thay đổi chỉ nằm trong phiên xem; tải lại trang sẽ đặt lại dữ liệu. Các liên kết ngoài danh sách màn hình thử chưa mở tại đây.</p>
        <nav aria-label="Màn hình dùng thử" className="flex flex-wrap gap-2">
          {screens.map((item) => <button key={item.path} onClick={() => setPath(item.path)} aria-pressed={item.path === path}
            className={`min-h-11 px-3 py-2 rounded-control border ${item.path === path ? 'bg-primary text-white' : 'bg-surface'}`}>{item.label}</button>)}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <label>Vai trò <select className="border rounded p-2 min-h-11" value={role} onChange={(e) => setRoleForPreview(e.target.value as 'owner' | 'family_view')}>
            <option value="owner">Chủ tiệc</option><option value="family_view">Người nhà (chỉ xem)</option>
          </select></label>
          <label>Trạng thái <select className="border rounded p-2 min-h-11" value={state} onChange={(e) => setState(e.target.value as PrototypeState)}>
            <option value="populated">Có dữ liệu</option><option value="empty">Chưa có dữ liệu</option>
            <option value="loading">Đang tải</option><option value="error">Lỗi tải</option>
          </select></label>
          <button className="min-h-11 border rounded px-3 bg-surface" onClick={() => setReset((value) => value + 1)}>Đặt lại màn hình</button>
        </div>
      </div>
      {!isOwner && screen.finance ? <p>Người nhà không được xem tài chính.</p> : <Component key={`${path}:${state}:${reset}`} initialState={state} />}
    </PageShell>
  </div>;
}

export function PrototypePlayground() {
  return <RoleProvider><EventScopeProvider initialEvents={[
    { id: 'engagement', name: 'Lễ đính hôn' },
    { id: 'wedding', name: 'Tiệc cưới', isRepresentative: true },
  ]}><Playground /></EventScopeProvider></RoleProvider>;
}
