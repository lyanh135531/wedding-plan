'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock,
  LayoutGrid,
  Mail,
  MapPin,
  Plus,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api/request';
import { formatVND } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  buildUrgentActions,
  computeOverviewRates,
  computeWeddingCountdown,
  formatAgendaSlot,
  type OverviewPayload,
  type OverviewSettings,
} from './overviewHelpers';

function formatShortViDate(iso: string | null | undefined): string {
  if (!iso) return 'Chưa chốt ngày';
  const match = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function LiveOverviewDashboard() {
  const [data, setData] = React.useState<OverviewPayload | null>(null);
  const [settings, setSettings] = React.useState<OverviewSettings | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    setError(null);
    Promise.all([
      api<{ data: OverviewPayload }>('/api/v1/overview', { signal: controller.signal }),
      api<{ data: OverviewSettings | null }>('/api/v1/settings', { signal: controller.signal }),
    ])
      .then(([overview, configuration]) => {
        if (!controller.signal.aborted) {
          setData(overview.data);
          setSettings(configuration.data);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError((failure as Error).message || 'Không thể tải tổng quan đám cưới.');
        }
      });
    return () => controller.abort();
  }, [revision]);

  if (error) {
    return (
      <Alert
        variant="danger"
        action={{ label: 'Thử lại', onClick: () => setRevision((v) => v + 1) }}
      >
        {error}
      </Alert>
    );
  }

  if (!data) {
    return (
      <div
        role="status"
        aria-label="Đang tải tổng quan"
        className="space-y-4 animate-pulse max-w-7xl mx-auto"
      >
        <span className="sr-only">Đang tải tổng quan...</span>
        <div className="h-36 rounded-2xl bg-[#173C33]/15" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-card bg-surface border border-border-subtle" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 h-56 rounded-card bg-surface border border-border-subtle" />
          <div className="lg:col-span-5 h-56 rounded-card bg-surface border border-border-subtle" />
        </div>
      </div>
    );
  }

  const coupleNames = settings
    ? settings.shortTitle || `${settings.groomName} & ${settings.brideName}`
    : 'Sổ Quản Lý Đám Cưới';

  const representative = data.events.find((e) => e.id === settings?.representativeEventId);
  const confirmedSolarDate =
    settings?.isDateConfirmed && representative?.startTime
      ? representative.solarDate || representative.startTime
      : null;

  const dateNote =
    confirmedSolarDate && representative?.startTime
      ? new Date(representative.startTime).toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : settings?.tentativeDateNote || 'Chưa chốt ngày cưới';

  const countdown = computeWeddingCountdown(
    confirmedSolarDate,
    Boolean(settings?.isDateConfirmed && confirmedSolarDate)
  );
  const rates = computeOverviewRates(data);
  const urgentActions = buildUrgentActions(data);

  const projectedCost = BigInt(data.finance?.budgetSummary.totalProjectedCost || '0');
  const netPaid = BigInt(data.finance?.budgetSummary.totalNetPaid || '0');
  const remainingDue = BigInt(data.finance?.budgetSummary.totalProjectedRemaining || '0');
  const missingPricesCount = data.finance?.budgetSummary.missingPricesCount ?? 0;
  const totalCards = data.invitations?.totalCards ?? 0;
  const sentCards = data.invitations?.sentCards ?? 0;
  const seatedCount = data.seating?.seatedCount ?? 0;
  const totalTables = data.seating?.totalTables ?? 0;
  const totalCapacity = data.seating?.totalCapacity ?? 0;
  const seatTarget = data.guests.confirmedSeats ?? data.guests.confirmedCount;

  const availableCash =
    data.finance?.cashLedger?.isConfigured && data.finance?.cashLedger?.availableCash != null
      ? BigInt(data.finance.cashLedger.availableCash)
      : null;

  const topExpenses = data.finance?.topExpenses || [];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. Signature Forest-Emerald Couple Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#173C33] via-[#1B453A] to-[#123028] text-[#F6F3E9] p-5 sm:p-6 border border-[#26574A] shadow-sm">
        <div
          className="pointer-events-none absolute -right-14 -bottom-16 w-56 h-56 rounded-full border border-[#D4BF8F]/15"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-4 -bottom-24 w-44 h-44 rounded-full border border-[#D4BF8F]/10"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4BF8F]">
              Hành trình ngày chung đôi
            </p>
            <h2 className="font-serif font-medium text-2xl sm:text-[32px] leading-tight tracking-tight text-[#FAF7F0] break-words">
              {coupleNames}
            </h2>

            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#D8E2DA]">
                <CalendarDays className="w-3.5 h-3.5 text-[#D4BF8F] shrink-0" aria-hidden="true" />
                {dateNote}
              </span>

              {countdown.label && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#D4BF8F]/15 border border-[#D4BF8F]/35 text-[#F2E3BE] font-medium tabular-nums">
                  <Sparkles className="w-3 h-3 text-[#D4BF8F]" aria-hidden="true" />
                  {countdown.label}
                </span>
              )}

              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/10 text-[#E5ECE6] tabular-nums">
                {data.events.length} buổi lễ
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!settings ? (
              <Link href="/setup">
                <Button
                  size="sm"
                  className="bg-[#D4BF8F] text-[#14332B] hover:bg-[#DECBA0] border-0 font-semibold"
                >
                  Thiết lập thông tin cưới
                </Button>
              </Link>
            ) : (
              <>
                <Link
                  href="/guests"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-medium text-[#FAF7F0] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#D4BF8F]" aria-hidden="true" />
                  Khách mời
                </Link>
                <Link
                  href="/invitations"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-medium text-[#FAF7F0] transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#D4BF8F]" aria-hidden="true" />
                  Thiệp mời
                </Link>
                <Link
                  href="/seating"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-medium text-[#FAF7F0] transition-colors"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-[#D4BF8F]" aria-hidden="true" />
                  Xếp bàn
                </Link>
                <Link
                  href="/budget"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#D4BF8F]/20 hover:bg-[#D4BF8F]/30 border border-[#D4BF8F]/40 text-xs font-medium text-[#F5E8C7] transition-colors"
                >
                  <Wallet className="w-3.5 h-3.5 text-[#D4BF8F]" aria-hidden="true" />
                  Ngân sách
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2. Four Streamlined Wedding Pillar Tiles */}
      <section
        aria-label="Tổng hợp bốn phân hệ chính"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {/* Pillar 1: Khách mời */}
        <Link
          href="/guests"
          className="group surface-card p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 hover:border-primary/40 transition-all"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted">
              Khách mời
            </span>
            <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 tabular-nums flex-wrap">
              <span className="text-xl sm:text-2xl font-semibold text-primary-luxury">
                {data.guests.confirmedCount}
              </span>
              <span className="text-xs text-text-muted">
                / {data.guests.totalUniqueGuests} tham dự
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5 tabular-nums truncate">
              {data.guests.uncertainCount ?? 0} chờ phản hồi · {data.guests.declinedCount ?? 0} từ chối
            </p>
          </div>
          <div className="h-1 w-full rounded-full bg-[#EFECE5] overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${rates.guestPercent}%` }}
            />
          </div>
        </Link>

        {/* Pillar 2: Thiệp mời */}
        <Link
          href="/invitations"
          className="group surface-card p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 hover:border-primary/40 transition-all"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted">
              Thiệp mời
            </span>
            <span className="w-7 h-7 rounded-full bg-[#FAF3E3] text-[#967638] flex items-center justify-center shrink-0">
              <Mail className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 tabular-nums flex-wrap">
              <span className="text-xl sm:text-2xl font-semibold text-primary-luxury">
                {sentCards}
              </span>
              <span className="text-xs text-text-muted">/ {totalCards} đã gửi</span>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5 tabular-nums truncate">
              {Math.max(0, totalCards - sentCards)} thiệp đang chuẩn bị · {rates.invitationPercent}%
            </p>
          </div>
          <div className="h-1 w-full rounded-full bg-[#EFECE5] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#BFA16E] transition-all"
              style={{ width: `${rates.invitationPercent}%` }}
            />
          </div>
        </Link>

        {/* Pillar 3: Xếp bàn */}
        <Link
          href="/seating"
          className="group surface-card p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 hover:border-primary/40 transition-all"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted">
              Xếp bàn tiệc
            </span>
            <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 tabular-nums flex-wrap">
              <span className="text-xl sm:text-2xl font-semibold text-primary-luxury">
                {seatedCount}
              </span>
              <span className="text-xs text-text-muted">/ {seatTarget} chỗ</span>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5 tabular-nums truncate">
              {totalTables} bàn tiệc · sức chứa {totalCapacity} ghế
            </p>
          </div>
          <div className="h-1 w-full rounded-full bg-[#EFECE5] overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${rates.seatingPercent}%` }}
            />
          </div>
        </Link>

        {/* Pillar 4: Ngân sách */}
        <Link
          href="/budget"
          className="group surface-card p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 hover:border-primary/40 transition-all"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted">
              Ngân sách
            </span>
            <span className="w-7 h-7 rounded-full bg-[#F3F8F5] text-[#173C33] flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap tabular-nums">
              <span className="text-lg sm:text-xl font-semibold text-primary-luxury truncate">
                {formatVND(projectedCost)}
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5 tabular-nums truncate">
              Đã chi {formatVND(netPaid)}
              {missingPricesCount > 0
                ? ` · Thiếu giá ${missingPricesCount}`
                : ` · Còn ${formatVND(remainingDue)}`}
            </p>
          </div>
          <div className="h-1 w-full rounded-full bg-[#EFECE5] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#173C33] to-[#BFA16E] transition-all"
              style={{ width: `${rates.budgetPaidPercent}%` }}
            />
          </div>
        </Link>
      </section>

      {/* 3. Streamlined Asymmetric Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Tasks & Urgent Attention + Top Expenses */}
        <div className="lg:col-span-7 space-y-4">
          {/* Task Progress & Urgent Actions */}
          <section className="surface-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckSquare className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                <h2 className="font-serif text-lg font-medium text-primary-luxury">
                  Tiến độ chuẩn bị
                </h2>
              </div>
              <Link
                href="/tasks"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 shrink-0"
              >
                Mở công việc
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs tabular-nums">
                <span className="text-text-main font-medium">
                  Đã xong {data.tasks.completedTasks} / {data.tasks.totalTasks} đầu việc
                </span>
                <span className="font-semibold text-primary-luxury">{rates.taskPercent}%</span>
              </div>
              <div
                className="h-1.5 w-full rounded-full bg-[#EFECE5] overflow-hidden"
                role="progressbar"
                aria-valuenow={rates.taskPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Tiến độ công việc ${rates.taskPercent}%`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${rates.taskPercent}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border-subtle/80">
              {urgentActions.length === 0 ? (
                <p className="flex items-center gap-2 text-xs text-[#2E5A4C] bg-[#F3F8F5] border border-[#D4E3DA] rounded-control px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Mọi đầu việc và thanh toán đều đang đúng tiến độ.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
                    Cần lưu tâm ({urgentActions.length})
                  </p>
                  <div className="space-y-2">
                    {urgentActions.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-control bg-[#FAF8F4] border border-border-subtle hover:border-primary/40 transition-colors group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-main group-hover:text-primary truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-text-muted truncate">{item.subtitle}</p>
                        </div>
                        <StatusBadge
                          variant={item.tone === 'danger' ? 'danger' : 'warning'}
                          text={item.badgeText}
                          size="sm"
                        />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Top Expenses */}
          <section className="surface-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <Wallet className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                <h2 className="font-serif text-lg font-medium text-primary-luxury">
                  Các khoản chi chính
                </h2>
                {availableCash !== null && (
                  <Link
                    href="/fund"
                    className="text-[11px] px-2 py-0.5 rounded-full bg-[#FAF6EC] border border-[#E5D7B8] text-[#7A5E2E] font-medium tabular-nums hover:opacity-90"
                  >
                    Quỹ hiện có: {formatVND(availableCash)}
                  </Link>
                )}
              </div>
              <Link
                href="/budget"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 shrink-0"
              >
                Chi tiết ngân sách
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>

            {topExpenses.length === 0 ? (
              <Link
                href="/budget"
                className="block rounded-control border border-dashed border-border-control bg-[#FAF8F4]/70 px-4 py-4 text-center text-xs text-text-muted hover:border-primary/40 hover:text-text-main transition-colors"
              >
                Chưa có khoản chi nào — nhấn để lên dự toán và theo dõi chi tiêu.
              </Link>
            ) : (
              <div className="divide-y divide-border-subtle/80">
                {topExpenses.slice(0, 4).map((expense) => (
                  <div
                    key={expense.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-text-main truncate">{expense.name}</p>
                      {expense.category && (
                        <p className="text-[11px] text-text-muted">{expense.category}</p>
                      )}
                    </div>
                    <span className="font-semibold text-primary-luxury tabular-nums shrink-0">
                      {formatVND(BigInt(expense.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: 7-Day Agenda + Wedding Ceremonies */}
        <div className="lg:col-span-5 space-y-4">
          {/* 7-Day Upcoming Agenda */}
          <section className="surface-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                <h2 className="font-serif text-lg font-medium text-primary-luxury">
                  Lịch 7 ngày tới
                </h2>
              </div>
              <Link
                href="/calendar"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 shrink-0"
              >
                Xem lịch
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>

            {data.agenda7Days.length === 0 ? (
              <p className="rounded-control bg-[#FAF8F4] border border-border-subtle px-3.5 py-4 text-xs text-text-muted text-center">
                Trong 7 ngày tới chưa có lịch hẹn hay mốc thanh toán nào.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.agenda7Days.slice(0, 5).map((item) => {
                  const slot = formatAgendaSlot(item.dateTime);
                  return (
                    <li
                      key={item.id}
                      className="rounded-control border border-border-subtle bg-[#FAF8F4]/70 px-3 py-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold ${
                            slot.isToday
                              ? 'bg-primary text-white'
                              : 'bg-surface border border-border-subtle text-text-main'
                          }`}
                        >
                          {slot.dayLabel}
                        </span>
                        <span className="text-text-muted tabular-nums font-mono">
                          {slot.timeLabel}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-text-main leading-snug">
                        {item.title}
                      </p>
                      {item.location && (
                        <p className="text-[11px] text-text-muted flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-accent shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.location}</span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Ceremonies Summary */}
          <section className="surface-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarDays className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                <h2 className="font-serif text-lg font-medium text-primary-luxury">
                  Các buổi lễ
                </h2>
              </div>
              <Link
                href="/settings"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 shrink-0"
              >
                Cài đặt
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>

            {data.events.length === 0 ? (
              <p className="text-xs text-text-muted">Chưa thiết lập buổi lễ nào.</p>
            ) : (
              <ul className="divide-y divide-border-subtle/80">
                {data.events.map((ev) => (
                  <li
                    key={ev.id}
                    className="py-2 flex items-center justify-between gap-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-text-main truncate">{ev.title}</p>
                      <p className="text-[11px] text-text-muted tabular-nums">
                        {formatShortViDate(ev.solarDate || ev.startTime)}
                      </p>
                    </div>
                    <StatusBadge
                      variant={ev.isDateConfirmed ? 'success' : 'warning'}
                      text={ev.isDateConfirmed ? 'Đã chốt' : 'Dự kiến'}
                      size="sm"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
