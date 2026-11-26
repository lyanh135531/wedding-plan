'use client';

import * as React from 'react';
import {
  Check,
  CheckCircle2,
  Edit3,
  FileText,
  Mail,
  Plus,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import { useEventScope } from '@/context/EventScopeContext';
import { allPages, api, jsonBody } from '@/lib/api/request';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/components/common/usePagination';
import { useLoadState } from '@/components/common/useLoadState';
import type { DeliveryMethod, GuestOwnerDto, InvitationOwnerDto } from '@/schemas/guests';
import {
  InvitationEditorModal,
  type InvitationFormPayload,
} from './InvitationEditorModal';
import { QuickSentModal } from './QuickSentModal';
import {
  DELIVERY_METHOD_OPTIONS,
  STATUS_BADGE_MAP,
  type InvitationMethodFilter,
  type InvitationStatusFilter,
  computeInvitationStats,
  filterInvitations,
  formatShortViDate,
} from './helpers';

const DELIVERY_METHOD_ICONS: Record<DeliveryMethod, typeof FileText> = {
  paper: FileText,
  electronic: Mail,
  in_person: Send,
};

const DELIVERY_LABEL_MAP: Record<DeliveryMethod, string> = {
  paper: 'Thiệp giấy',
  electronic: 'Thiệp điện tử',
  in_person: 'Trao tận tay',
};

const STATUS_FILTER_TABS: ReadonlyArray<{ value: InvitationStatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'save_the_date', label: 'Đã giữ lịch' },
  { value: 'preparing', label: 'Đang chuẩn bị' },
  { value: 'sent', label: 'Đã gửi' },
];

export function LiveInvitationsWorkspace() {
  const { currentScope, availableEvents, setScope } = useEventScope();
  const activeEvents = React.useMemo(
    () => availableEvents.filter((event) => !event.isCancelled),
    [availableEvents]
  );

  const eventId = React.useMemo(() => {
    if (activeEvents.some((event) => event.id === currentScope)) return currentScope;
    return activeEvents.find((event) => event.isRepresentative)?.id || activeEvents[0]?.id || '';
  }, [activeEvents, currentScope]);

  const activeEvent = activeEvents.find((event) => event.id === eventId);

  const [invitations, setInvitations] = React.useState<InvitationOwnerDto[]>([]);
  const [guests, setGuests] = React.useState<GuestOwnerDto[]>([]);
  const { loading, refreshing, beginLoad, markLoaded, finishLoad } = useLoadState();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<InvitationStatusFilter>('all');
  const [methodFilter, setMethodFilter] = React.useState<InvitationMethodFilter>('all');

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [editingInvitation, setEditingInvitation] = React.useState<
    InvitationOwnerDto | null | undefined
  >(undefined);
  const [quickSentTargets, setQuickSentTargets] = React.useState<InvitationOwnerDto[] | null>(
    null
  );

  const generation = React.useRef(0);

  const load = React.useCallback(async () => {
    if (!eventId) {
      finishLoad();
      return;
    }
    const requestId = ++generation.current;
    beginLoad(eventId);
    setError(null);
    try {
      const [cardsResult, guestList] = await Promise.all([
        api<{ data: InvitationOwnerDto[] }>(
          `/api/v1/invitations?eventId=${encodeURIComponent(eventId)}`
        ),
        allPages<GuestOwnerDto>('/api/v1/guests'),
      ]);
      if (requestId !== generation.current) return;
      setInvitations(cardsResult.data);
      setGuests(guestList);
      setSelectedIds((prev) =>
        prev.filter((id) =>
          cardsResult.data.some((card) => card.id === id && card.status !== 'sent')
        )
      );
      markLoaded(eventId);
    } catch (failure) {
      if (requestId === generation.current) {
        setError((failure as Error).message);
        finishLoad();
      }
    }
  }, [eventId, beginLoad, markLoaded, finishLoad]);

  React.useEffect(() => {
    void load();
    setSelectedIds([]);
    setEditingInvitation(undefined);
    setQuickSentTargets(null);
    return () => {
      generation.current++;
    };
  }, [load]);

  const guestMap = React.useMemo(
    () => new Map(guests.map((guest) => [guest.id, guest])),
    [guests]
  );

  const stats = React.useMemo(() => computeInvitationStats(invitations), [invitations]);

  const unassignedGuestCount = React.useMemo(() => {
    if (guests.length === 0) return 0;
    const assigned = new Set<string>();
    for (const inv of invitations) {
      if (inv.representative_guest_id) assigned.add(inv.representative_guest_id);
      for (const id of inv.member_guest_ids) assigned.add(id);
    }
    return guests.reduce((count, guest) => (assigned.has(guest.id) ? count : count + 1), 0);
  }, [guests, invitations]);

  const filteredInvitations = React.useMemo(
    () =>
      filterInvitations(invitations, guestMap, {
        search,
        statusFilter,
        methodFilter,
      }),
    [invitations, guestMap, search, statusFilter, methodFilter]
  );

  const pagination = usePagination(filteredInvitations, {
    defaultPageSize: 15,
    resetKey: `${eventId}:${search}:${statusFilter}:${methodFilter}`,
  });

  const unsentVisibleIds = React.useMemo(
    () => pagination.pagedItems.filter((inv) => inv.status !== 'sent').map((inv) => inv.id),
    [pagination.pagedItems]
  );

  const allUnsentVisibleSelected =
    unsentVisibleIds.length > 0 && unsentVisibleIds.every((id) => selectedIds.includes(id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllUnsent = () => {
    if (allUnsentVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !unsentVisibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...unsentVisibleIds])));
    }
  };

  const handleSaveInvitation = async (payload: InvitationFormPayload) => {
    if (!eventId) throw new Error('Chưa có buổi lễ đang chọn.');
    if (editingInvitation) {
      await api(`/api/v1/invitations/${editingInvitation.id}`, {
        method: 'PATCH',
        body: jsonBody({
          ...payload,
          event_id: eventId,
          version: editingInvitation.version,
        }),
      });
      setNotice(`Đã cập nhật thiệp "${payload.card_name}".`);
    } else {
      await api('/api/v1/invitations', {
        method: 'POST',
        body: jsonBody({
          ...payload,
          event_id: eventId,
        }),
      });
      setNotice(`Đã tạo thiệp "${payload.card_name}".`);
    }
    await load();
  };

  const handleConfirmQuickSent = async (sentDate: string) => {
    if (!quickSentTargets || quickSentTargets.length === 0) return;
    const ids = quickSentTargets.map((item) => item.id);
    const result = await api<{ updatedCount: number }>('/api/v1/invitations/bulk-sent', {
      method: 'POST',
      body: jsonBody({ invitationIds: ids, sentDate }),
    });
    setNotice(
      `Đã đánh dấu ${result.updatedCount} thiệp Đã gửi (${formatShortViDate(sentDate)}). RSVP khách vẫn được giữ nguyên.`
    );
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    await load();
  };

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter !== 'all' || methodFilter !== 'all'
  );

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setMethodFilter('all');
  };

  const resolveMemberSummary = (inv: InvitationOwnerDto) => {
    const repName = guestMap.get(inv.representative_guest_id)?.display_name || '';
    const uniqueIds = Array.from(
      new Set([inv.representative_guest_id, ...inv.member_guest_ids].filter(Boolean))
    );
    const otherNames = uniqueIds
      .filter((id) => id !== inv.representative_guest_id)
      .map((id) => guestMap.get(id)?.display_name)
      .filter((name): name is string => Boolean(name));

    return {
      repName,
      otherNames,
      memberCount: uniqueIds.length,
    };
  };

  if (activeEvents.length === 0) {
    return (
      <EmptyState
        type="no_data"
        title="Chưa có buổi lễ nào"
        description="Vui lòng thêm buổi lễ trong phần Cài đặt chung trước khi quản lý thiệp mời."
        icon={<Mail className="w-7 h-7 text-accent" strokeWidth={1.4} />}
        action={{
          label: 'Đi tới Cài đặt chung',
          onClick: () => {
            window.location.assign('/settings');
          },
        }}
      />
    );
  }

  return (
    <section className="space-y-3" aria-busy={refreshing}>
      {/* Compact Luxury Control & Progress Card */}
      <div className="surface-card p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h2 className="font-serif text-xl sm:text-[22px] font-medium text-primary-luxury tracking-tight">
              Danh Sách Thiệp Mời
            </h2>

            {activeEvents.length > 1 ? (
              <div
                className="inline-flex items-center gap-1 p-0.5 rounded-full bg-page border border-border-subtle"
                role="tablist"
                aria-label="Chọn buổi lễ"
              >
                {activeEvents.map((ev) => {
                  const selected = ev.id === eventId;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setScope(ev.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                        selected
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      {ev.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              activeEvent?.name && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-page border border-border-subtle text-[11px] font-medium text-text-muted">
                  {activeEvent.name}
                </span>
              )
            )}

            {!loading && !error && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-page border border-border-subtle text-text-main font-medium tabular-nums">
                  <Users className="w-3 h-3 text-primary" aria-hidden="true" />
                  {stats.totalCards} thiệp · {stats.totalGuestsCovered} khách
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-success-bg text-success font-semibold tabular-nums">
                  Đã gửi {stats.sentCards}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-warning-bg text-warning font-semibold tabular-nums">
                  Chuẩn bị {stats.preparingCards}
                </span>
                {stats.saveTheDateCards > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-info-bg text-info font-semibold tabular-nums">
                    Giữ lịch {stats.saveTheDateCards}
                  </span>
                )}
                {unassignedGuestCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FAF6EC] border border-[#E5D7B8] text-[#8A6D3B] font-medium tabular-nums">
                    {unassignedGuestCount} khách chưa xếp thiệp
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FAF6EC] border border-[#D4BF8F]">
                <span className="text-xs font-medium text-primary-luxury tabular-nums">
                  Đã chọn {selectedIds.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-[11px] text-text-muted hover:text-text-main px-1.5 py-0.5 rounded"
                >
                  Bỏ chọn
                </button>
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Send className="w-3 h-3" aria-hidden="true" />}
                  onClick={() =>
                    setQuickSentTargets(invitations.filter((inv) => selectedIds.includes(inv.id)))
                  }
                  className="h-7 min-h-[28px] px-2.5 text-[11px]"
                >
                  Đánh dấu đã gửi
                </Button>
              </div>
            )}

            <Button
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
              disabled={loading}
              onClick={() => setEditingInvitation(null)}
              className="h-9 min-h-[36px] px-3.5 text-xs"
            >
              Tạo thiệp mới
            </Button>
          </div>
        </div>

        {/* Hairline Luxury Progress Indicator */}
        {!loading && !error && stats.totalCards > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-[#EFECE5] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#173C33] via-[#235447] to-[#BFA16E] transition-all duration-300"
                style={{ width: `${stats.sentRatePercent}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-text-muted tabular-nums shrink-0">
              {stats.sentRatePercent}% đã gửi
            </span>
          </div>
        )}

        {/* Search & Filter Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Tìm thiệp mời"
              placeholder="Tìm theo tên thiệp, tên khách hoặc ghi chú..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-8 text-sm bg-surface border border-border-control rounded-control focus:outline-none focus:border-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-text-main"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTER_TABS.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`h-9 px-3 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-[#173C33] text-[#F6F3E9] border-[#173C33]'
                      : 'bg-surface text-text-muted border-border-subtle hover:text-text-main hover:bg-[#FAF8F4]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            <select
              aria-label="Lọc theo hình thức gửi"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as InvitationMethodFilter)}
              className="h-9 px-2.5 text-xs bg-surface border border-border-control rounded-control text-text-main focus:outline-none focus:border-primary"
            >
              <option value="all">Mọi hình thức</option>
              {DELIVERY_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 px-2.5 text-xs font-medium text-danger hover:bg-danger-bg/60 rounded-control border border-danger/20 whitespace-nowrap transition-colors"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline Feedback Notice */}
      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-card bg-success-bg/80 border border-success/20 text-xs sm:text-sm text-success"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Đóng thông báo"
            className="p-1 rounded hover:bg-success/10"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-card bg-danger-bg border border-danger/20 text-sm text-danger"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="underline font-medium min-h-8 px-2"
          >
            Tải lại
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div role="status" className="surface-card divide-y divide-border-subtle animate-pulse">
          <span className="sr-only">Đang tải danh sách thiệp mời…</span>
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 bg-border-subtle rounded" />
                <div className="h-3 w-32 bg-border-subtle/70 rounded" />
              </div>
              <div className="h-6 w-24 bg-border-subtle rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredInvitations.length === 0 && (
        <EmptyState
          type={hasActiveFilters ? 'no_filter_match' : 'no_data'}
          title={
            hasActiveFilters
              ? 'Không tìm thấy thiệp mời phù hợp'
              : 'Mỗi tấm thiệp, một lời trân trọng'
          }
          description={
            hasActiveFilters
              ? 'Thử thay đổi từ khóa hoặc xóa bộ lọc để xem toàn bộ thiệp mời.'
              : 'Tạo nhóm thiệp mời cho gia đình và bạn bè để theo dõi tiến độ chuẩn bị và gửi thiệp.'
          }
          icon={<Mail className="w-7 h-7 text-accent" strokeWidth={1.4} />}
          action={
            hasActiveFilters
              ? { label: 'Xóa bộ lọc', onClick: clearFilters }
              : { label: 'Tạo thiệp đầu tiên', onClick: () => setEditingInvitation(null) }
          }
        />
      )}

      {/* Streamlined Desktop Table + Mobile Card List */}
      {!loading && !error && filteredInvitations.length > 0 && (
        <>
          {/* Desktop Editorial Table */}
          <div className="hidden md:block surface-card overflow-hidden">
            <table className="w-full text-left border-collapse text-sm" aria-label="Bảng quản lý thiệp mời">
              <thead>
                <tr className="bg-[#FAF8F4] border-b border-border-subtle text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted select-none">
                  <th className="w-11 px-4 py-3">
                    <button
                      type="button"
                      disabled={unsentVisibleIds.length === 0}
                      onClick={toggleSelectAllUnsent}
                      aria-label={
                        allUnsentVisibleSelected
                          ? 'Bỏ chọn tất cả thiệp chưa gửi'
                          : 'Chọn tất cả thiệp chưa gửi'
                      }
                      className={`w-[18px] h-[18px] rounded border flex items-center justify-center transition-colors disabled:opacity-30 ${
                        allUnsentVisibleSelected
                          ? 'bg-primary border-primary text-white'
                          : 'border-border-control bg-surface hover:border-primary'
                      }`}
                    >
                      {allUnsentVisibleSelected && (
                        <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3">Thiệp mời & Khách nhận</th>
                  <th className="px-3 py-3 w-36">Hình thức</th>
                  <th className="px-3 py-3 w-44">Tiến độ</th>
                  <th className="px-4 py-3 w-44 text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border-subtle/80">
                {pagination.pagedItems.map((inv) => {
                  const isSent = inv.status === 'sent';
                  const isSelected = selectedIds.includes(inv.id);
                  const { repName, otherNames, memberCount } = resolveMemberSummary(inv);
                  const MethodIcon = DELIVERY_METHOD_ICONS[inv.delivery_method] || FileText;
                  const statusMeta = STATUS_BADGE_MAP[inv.status];
                  const formattedDate = formatShortViDate(inv.sent_date);

                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-primary/[0.04]' : 'hover:bg-[#FAF8F4]/80'
                      }`}
                    >
                      <td className="px-4 py-3 align-middle">
                        {isSent ? (
                          <span
                            className="w-[18px] h-[18px] inline-flex items-center justify-center rounded-full bg-success-bg text-success"
                            title="Đã gửi"
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleSelect(inv.id)}
                            aria-label={`Chọn thiệp ${inv.card_name}`}
                            className={`w-[18px] h-[18px] rounded border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-primary border-primary text-white'
                                : 'border-border-control bg-surface hover:border-primary'
                            }`}
                          >
                            {isSelected && (
                              <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
                            )}
                          </button>
                        )}
                      </td>

                      <td className="px-3 py-3 align-middle min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-primary-luxury text-[14px] leading-snug">
                            {inv.card_name}
                          </span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-page border border-border-subtle text-text-muted tabular-nums">
                            {memberCount} khách
                          </span>
                        </div>
                        {(repName || otherNames.length > 0) && (
                          <p className="text-xs text-text-muted mt-0.5 truncate max-w-xl">
                            {repName && (
                              <span className="text-text-main font-medium">Đại diện: {repName}</span>
                            )}
                            {otherNames.length > 0 && (
                              <span>{repName ? ` · Cùng thiệp: ${otherNames.join(', ')}` : otherNames.join(', ')}</span>
                            )}
                          </p>
                        )}
                        {inv.notes && (
                          <p className="text-[11px] italic text-text-muted/80 mt-0.5 truncate max-w-xl">
                            {inv.notes}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-3 align-middle">
                        <span className="inline-flex items-center gap-1.5 text-xs text-text-main bg-[#FAF8F4] border border-border-subtle px-2.5 py-1 rounded-full">
                          <MethodIcon className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                          {DELIVERY_LABEL_MAP[inv.delivery_method] || inv.delivery_method}
                        </span>
                      </td>

                      <td className="px-3 py-3 align-middle">
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge
                            variant={statusMeta.variant}
                            text={statusMeta.label}
                            size="sm"
                          />
                          {formattedDate && (
                            <span className="text-[11px] text-text-muted tabular-nums pl-0.5">
                              Ngày {formattedDate}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isSent && (
                            <button
                              type="button"
                              onClick={() => setQuickSentTargets([inv])}
                              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-control text-xs font-medium text-primary border border-primary/25 bg-primary/[0.04] hover:bg-primary hover:text-white transition-colors"
                            >
                              <Send className="w-3 h-3" aria-hidden="true" />
                              Đã gửi
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingInvitation(inv)}
                            aria-label={`Sửa thiệp ${inv.card_name}`}
                            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-control text-xs font-medium text-text-muted hover:text-text-main hover:bg-page border border-border-subtle transition-colors"
                          >
                            <Edit3 className="w-3 h-3" aria-hidden="true" />
                            Sửa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Compact Cards */}
          <div className="md:hidden surface-card divide-y divide-border-subtle">
            {pagination.pagedItems.map((inv) => {
              const isSent = inv.status === 'sent';
              const isSelected = selectedIds.includes(inv.id);
              const { repName, otherNames, memberCount } = resolveMemberSummary(inv);
              const MethodIcon = DELIVERY_METHOD_ICONS[inv.delivery_method] || FileText;
              const statusMeta = STATUS_BADGE_MAP[inv.status];
              const formattedDate = formatShortViDate(inv.sent_date);

              return (
                <article
                  key={inv.id}
                  className={`p-3.5 space-y-2.5 transition-colors ${
                    isSelected ? 'bg-primary/[0.04]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {!isSent && (
                        <button
                          type="button"
                          onClick={() => toggleSelect(inv.id)}
                          aria-label={`Chọn thiệp ${inv.card_name}`}
                          className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-primary border-primary text-white'
                              : 'border-border-control bg-surface'
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
                          )}
                        </button>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-medium text-primary-luxury text-[15px] leading-snug break-words">
                          {inv.card_name}
                        </h3>
                        <p className="text-xs text-text-muted mt-0.5 break-words">
                          {memberCount} khách
                          {repName ? ` · Đại diện: ${repName}` : ''}
                          {otherNames.length > 0 ? ` · ${otherNames.join(', ')}` : ''}
                        </p>
                      </div>
                    </div>

                    <StatusBadge
                      variant={statusMeta.variant}
                      text={statusMeta.label}
                      size="sm"
                    />
                  </div>

                  {inv.notes && (
                    <p className="text-xs italic text-text-muted/85">{inv.notes}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <MethodIcon className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                        {DELIVERY_LABEL_MAP[inv.delivery_method]}
                      </span>
                      {formattedDate && (
                        <span className="tabular-nums">· {formattedDate}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isSent && (
                        <button
                          type="button"
                          onClick={() => setQuickSentTargets([inv])}
                          className="inline-flex items-center gap-1 min-h-9 px-3 rounded-control text-xs font-medium text-primary border border-primary/25 bg-primary/[0.04]"
                        >
                          <Send className="w-3 h-3" aria-hidden="true" />
                          Đã gửi
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingInvitation(inv)}
                        className="inline-flex items-center gap-1 min-h-9 px-3 rounded-control text-xs font-medium text-text-main border border-border-subtle bg-surface"
                      >
                        <Edit3 className="w-3 h-3" aria-hidden="true" />
                        Sửa
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <Pagination
            currentPage={pagination.currentPage}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            onPageChange={pagination.setCurrentPage}
            onPageSizeChange={pagination.setPageSize}
            pageSizeOptions={[15, 30, 50, 100]}
            unitLabel="thiệp"
          />
        </>
      )}

      {/* Create / Edit Invitation Modal */}
      <InvitationEditorModal
        isOpen={editingInvitation !== undefined}
        onClose={() => setEditingInvitation(undefined)}
        invitation={editingInvitation ?? null}
        guests={guests}
        existingInvitations={invitations}
        onSave={handleSaveInvitation}
      />

      {/* Quick Single / Bulk Mark-Sent Modal */}
      <QuickSentModal
        isOpen={Boolean(quickSentTargets && quickSentTargets.length > 0)}
        onClose={() => setQuickSentTargets(null)}
        targetNames={(quickSentTargets || []).map((item) => item.card_name)}
        onConfirm={handleConfirmQuickSent}
      />
    </section>
  );
}
