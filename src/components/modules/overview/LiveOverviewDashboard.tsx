'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/context/RoleContext';
import { api } from '@/lib/api/request';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ExecutiveHeader } from './ExecutiveHeader';
import { StatCardsRow } from './StatCardsRow';
import { ActionRequiredList, type ActionItem } from './ActionRequiredList';
import { SevenDayAgenda } from './SevenDayAgenda';
import { TaskProgressSummary } from './TaskProgressSummary';
import { TopExpenseList, type ExpenseItem } from './TopExpenseList';

const h = React.createElement;
interface Overview {
  guests: { confirmedCount: number; totalAttendanceInstances: number; totalUniqueGuests: number };
  tasks: { totalTasks: number; completedTasks: number; overdueTasks: number };
  finance: null | {
    budgetSummary: { totalProjectedCost: string; totalNetPaid: string; totalProjectedRemaining: string; missingPricesCount: number };
    overduePaymentsCount: number;
    topExpenses: Array<Omit<ExpenseItem, 'amount'> & { amount: string }>;
  };
  agenda7Days: Array<{ id: string; title: string; dateTime: string; location?: string | null }>;
  events: Array<{ id: string; startTime: string | null }>;
}
interface Settings {
  shortTitle: string | null; groomName: string; brideName: string;
  isDateConfirmed: boolean; tentativeDateNote: string; representativeEventId: string | null;
}

export function LiveOverviewDashboard() {
  const router = useRouter();
  const { isOwner } = useRole();
  const [data, setData] = React.useState<Overview | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    const controller = new AbortController();
    setError(null);
    Promise.all([
      api<{ data: Overview }>('/api/v1/overview', { signal: controller.signal }),
      api<{ data: Settings | null }>('/api/v1/settings', { signal: controller.signal }),
    ]).then(([overview, configuration]) => {
      if (!controller.signal.aborted) { setData(overview.data); setSettings(configuration.data); }
    }).catch((failure) => { if (!controller.signal.aborted) setError((failure as Error).message); });
    return () => controller.abort();
  }, [revision]);

  if (error) return h(Alert, { variant: 'danger', action: { label: 'Thử lại', onClick: () => setRevision((value) => value + 1) } }, error);
  if (!data) return h('p', { role: 'status' }, 'Đang tải tổng quan...');
  const representative = data.events.find((event) => event.id === settings?.representativeEventId);
  const dateNote = settings?.isDateConfirmed && representative?.startTime
    ? new Date(representative.startTime).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : settings?.tentativeDateNote || 'Chưa chốt ngày cưới';
  const actions: ActionItem[] = [];
  if (data.tasks.overdueTasks) actions.push({
    id: 'overdue-tasks', type: 'overdue_task', title: `${data.tasks.overdueTasks} công việc quá hạn`,
    subtitle: 'Kiểm tra và cập nhật tiến độ công việc.', badgeText: 'Quá hạn', badgeStatus: 'danger', href: '/tasks',
  });
  if (isOwner && data.finance?.budgetSummary.missingPricesCount) actions.push({
    id: 'missing-prices', type: 'missing_price', title: `${data.finance.budgetSummary.missingPricesCount} khoản chưa có giá`,
    subtitle: 'Cập nhật giá để hoàn thiện dự báo ngân sách.', badgeText: 'Thiếu giá', badgeStatus: 'warning', href: '/budget', isFinancial: true,
  });
  return h('div', { className: 'space-y-6 max-w-7xl mx-auto' },
    h(ExecutiveHeader, {
      coupleNames: settings ? settings.shortTitle || `${settings.groomName} & ${settings.brideName}` : 'Sổ quản lý đám cưới',
      weddingDateNote: dateNote,
      onQuickAddGuest: () => router.push('/guests'),
      onQuickAddCost: () => router.push('/budget'),
      onQuickAddTask: () => router.push('/tasks'),
    }),
    !settings && isOwner && h(Button, { onClick: () => router.push('/setup') }, 'Thiết lập thông tin đám cưới'),
    isOwner && data.finance && h(StatCardsRow, {
      projectedCost: BigInt(data.finance.budgetSummary.totalProjectedCost),
      netPaid: BigInt(data.finance.budgetSummary.totalNetPaid),
      remainingDue: BigInt(data.finance.budgetSummary.totalProjectedRemaining),
      missingPricesCount: data.finance.budgetSummary.missingPricesCount,
      confirmedGuests: data.guests.confirmedCount, totalInvited: data.guests.totalAttendanceInstances,
      attendanceInstancesCount: data.guests.totalAttendanceInstances,
    }),
    h('p', { className: 'text-sm text-text-muted' }, `Tổng ${data.guests.totalUniqueGuests} khách mời • ${data.events.length} buổi lễ`),
    h('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-6' },
      h(ActionRequiredList, { items: actions }),
      h(SevenDayAgenda, { items: data.agenda7Days.map((item) => ({
        id: item.id, title: item.title, location: item.location || undefined,
        dayLabel: new Date(item.dateTime).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        time: new Date(item.dateTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }),
      })) }),
      h(TaskProgressSummary, { completedCount: data.tasks.completedTasks, totalCount: data.tasks.totalTasks }),
      isOwner && data.finance && h(TopExpenseList, { items: data.finance.topExpenses.map((item) => ({ ...item, amount: BigInt(item.amount) })) }),
    ),
  );
}
