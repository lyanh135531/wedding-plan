export interface OverviewPayload {
  guests: {
    confirmedCount: number;
    declinedCount?: number;
    uncertainCount?: number;
    confirmedSeats?: number;
    totalAttendanceInstances: number;
    totalUniqueGuests: number;
  };
  tasks: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks?: number;
    overdueTasks: number;
    completionRate?: number;
  };
  invitations?: {
    totalCards: number;
    sentCards: number;
    preparingCards: number;
    saveTheDateCards: number;
  };
  seating?: {
    totalTables: number;
    totalCapacity: number;
    seatedCount: number;
  };
  finance: null | {
    budgetSummary: {
      totalProjectedCost: string;
      totalNetPaid: string;
      totalProjectedRemaining: string;
      missingPricesCount: number;
      targetBudget?: string | null;
    };
    cashLedger?: {
      isConfigured?: boolean;
      availableCash?: string | null;
    } | null;
    overduePaymentsCount: number;
    topExpenses: Array<{
      id: string;
      name: string;
      category?: string;
      amount: string;
      status: string;
    }>;
  };
  agenda7Days: Array<{
    id: string;
    title: string;
    dateTime: string;
    location?: string | null;
  }>;
  events: Array<{
    id: string;
    title: string;
    startTime: string | null;
    solarDate?: string | null;
    isDateConfirmed?: boolean;
  }>;
}

export interface OverviewSettings {
  shortTitle: string | null;
  groomName: string;
  brideName: string;
  isDateConfirmed: boolean;
  tentativeDateNote: string;
  representativeEventId: string | null;
}

export interface UrgentAction {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  tone: 'danger' | 'warning';
  href: string;
}

export interface CountdownInfo {
  label: string;
  daysRemaining: number | null;
  isToday: boolean;
}

function vietnamDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Computes crisp countdown badge for confirmed wedding solar date in Asia/Ho_Chi_Minh. */
export function computeWeddingCountdown(
  solarDate: string | null | undefined,
  isConfirmed: boolean,
  now: Date = new Date()
): CountdownInfo {
  if (!isConfirmed || !solarDate) {
    return { label: '', daysRemaining: null, isToday: false };
  }

  const match = solarDate.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { label: '', daysRemaining: null, isToday: false };

  const todayStr = vietnamDateKey(now);
  const targetUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const diffDays = Math.round((targetUtc - todayUtc) / 86_400_000);

  if (diffDays === 0) {
    return { label: 'Hôm nay là ngày trọng đại', daysRemaining: 0, isToday: true };
  }
  if (diffDays > 0) {
    return { label: `Còn ${diffDays} ngày`, daysRemaining: diffDays, isToday: false };
  }
  return { label: `Đã kỷ niệm ${Math.abs(diffDays)} ngày`, daysRemaining: diffDays, isToday: false };
}

/** Formats an agenda ISO timestamp to a natural Vietnamese relative day label + HH:mm time. */
export function formatAgendaSlot(
  isoDateTime: string,
  now: Date = new Date()
): { dayLabel: string; timeLabel: string; isToday: boolean } {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return { dayLabel: '', timeLabel: '', isToday: false };
  }

  const targetKey = vietnamDateKey(date);
  const todayKey = vietnamDateKey(now);
  const tomorrowKey = vietnamDateKey(new Date(now.getTime() + 86_400_000));

  const timeLabel = date.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (targetKey === todayKey) {
    return { dayLabel: 'Hôm nay', timeLabel, isToday: true };
  }
  if (targetKey === tomorrowKey) {
    return { dayLabel: 'Ngày mai', timeLabel, isToday: false };
  }

  const dayLabel = date.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  return { dayLabel, timeLabel, isToday: false };
}

function clampPercent(numerator: number, denominator: number): number {
  if (denominator <= 0 || numerator <= 0) return 0;
  return Math.min(100, Math.round((numerator / denominator) * 100));
}

/** Derives bounded progress rates for the 4 overview pillars + tasks. */
export function computeOverviewRates(data: OverviewPayload) {
  const guestBase = data.guests.totalAttendanceInstances || data.guests.totalUniqueGuests;
  const guestPercent = clampPercent(data.guests.confirmedCount, guestBase);

  const totalCards = data.invitations?.totalCards ?? 0;
  const sentCards = data.invitations?.sentCards ?? 0;
  const invitationPercent = clampPercent(sentCards, totalCards);

  const seatTarget = data.guests.confirmedSeats ?? data.guests.confirmedCount;
  const seatedCount = data.seating?.seatedCount ?? 0;
  const seatingPercent = clampPercent(seatedCount, Math.max(seatTarget, seatedCount));

  const projected = BigInt(data.finance?.budgetSummary.totalProjectedCost || '0');
  const netPaid = BigInt(data.finance?.budgetSummary.totalNetPaid || '0');
  const budgetPaidPercent =
    projected > 0n ? Math.min(100, Number((netPaid * 100n) / projected)) : 0;

  const taskPercent = clampPercent(data.tasks.completedTasks, data.tasks.totalTasks);

  return {
    guestPercent,
    invitationPercent,
    seatingPercent,
    budgetPaidPercent,
    taskPercent,
  };
}

/** Builds compact prioritized urgent actions for overdue tasks, payments, and missing prices. */
export function buildUrgentActions(data: OverviewPayload): UrgentAction[] {
  const items: UrgentAction[] = [];

  if (data.tasks.overdueTasks > 0) {
    items.push({
      id: 'overdue-tasks',
      title: `${data.tasks.overdueTasks} công việc đã quá hạn`,
      subtitle: 'Kiểm tra và cập nhật lại hạn hoặc trạng thái hoàn thành.',
      badgeText: 'Quá hạn',
      tone: 'danger',
      href: '/tasks',
    });
  }

  if (data.finance && data.finance.overduePaymentsCount > 0) {
    items.push({
      id: 'overdue-payments',
      title: `${data.finance.overduePaymentsCount} đợt thanh toán quá hạn`,
      subtitle: 'Đối chiếu lịch trả nhà cung cấp và ghi nhận giao dịch.',
      badgeText: 'Quá hạn chi',
      tone: 'danger',
      href: '/payments',
    });
  }

  if (data.finance && data.finance.budgetSummary.missingPricesCount > 0) {
    items.push({
      id: 'missing-prices',
      title: `${data.finance.budgetSummary.missingPricesCount} khoản chi chưa chốt giá`,
      subtitle: 'Bổ sung dự toán hoặc hợp đồng để ngân sách dự báo chính xác.',
      badgeText: 'Thiếu giá',
      tone: 'warning',
      href: '/budget',
    });
  }

  return items;
}
