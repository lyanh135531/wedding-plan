'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, allPages, jsonBody } from '@/lib/api/request';
import { useRole } from '@/context/RoleContext';
import { useEventScope } from '@/context/EventScopeContext';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/components/common/usePagination';
import { AddGuestModal, type AddGuestDraft } from './AddGuestModal';
import { AddFamilyModal, type AddFamilyModalProps } from './AddFamilyModal';
import { RsvpUpdateDrawer, type MemberRsvpState } from './RsvpUpdateDrawer';
import { GuestDetailDrawer, type GuestDetailData } from './GuestDetailDrawer';
import { GuestActions } from './GuestActions';
import {
  DuplicateReviewResults,
  DuplicateReviewTrigger,
  useDuplicateReview,
} from './DuplicateReview';
import type {
  GuestOwnerDto,
  GuestFamilyDto,
  AttendanceOwnerDto,
  AttendanceFamilyDto,
  InvitationOwnerDto,
  GuestSide,
  AgeTier,
} from '@/schemas/guests';
import { removeVietnameseDiacritics } from '@/lib/utils';
import { Mail, Phone, Plus, Search, Users, X } from 'lucide-react';

export type LiveGuest = GuestOwnerDto | GuestFamilyDto;
export type LiveAttendance = AttendanceOwnerDto | AttendanceFamilyDto;
export type GuestSideFilter = 'all' | GuestSide;
export type GuestRsvpFilter =
  | 'all'
  | 'accepted'
  | 'pending_reply'
  | 'tentative'
  | 'declined'
  | 'not_contacted'
  | 'uninvited';

const SIDE_LABELS: Record<GuestSide, string> = {
  groom: 'Nhà trai',
  bride: 'Nhà gái',
  mutual: 'Bạn chung',
  unassigned: 'Chưa phân',
};

const AGE_LABELS: Record<AgeTier, string> = {
  adult: 'Người lớn',
  child: 'Trẻ em',
  baby: 'Em bé',
};

const RSVP_BADGE_MAP: Record<
  string,
  { variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; text: string }
> = {
  accepted: { variant: 'success', text: 'Sẽ tham dự' },
  pending_reply: { variant: 'warning', text: 'Chưa phản hồi' },
  tentative: { variant: 'warning', text: 'Cân nhắc' },
  declined: { variant: 'danger', text: 'Không tham dự' },
  not_contacted: { variant: 'info', text: 'Chưa liên hệ' },
};

export interface GuestSummaryStats {
  total: number;
  accepted: number;
  pending: number;
  declined: number;
  uninvited: number;
}

/**
 * Computes compact event-scoped RSVP summary counters across the loaded guest list.
 */
export function computeGuestStats(
  guests: LiveGuest[],
  attendance: LiveAttendance[]
): GuestSummaryStats {
  const attendanceMap = new Map(attendance.map((row) => [row.guest_id, row]));
  let accepted = 0;
  let pending = 0;
  let declined = 0;
  let uninvited = 0;

  for (const guest of guests) {
    const row = attendanceMap.get(guest.id);
    if (!row) {
      uninvited++;
    } else if (row.rsvp_status === 'accepted') {
      accepted++;
    } else if (row.rsvp_status === 'declined') {
      declined++;
    } else {
      pending++;
    }
  }

  return { total: guests.length, accepted, pending, declined, uninvited };
}

/**
 * Filters guests by Vietnamese-diacritic-insensitive query (name, phone, invitation card),
 * wedding side, and RSVP status.
 */
export function filterLiveGuests(
  guests: LiveGuest[],
  attendance: LiveAttendance[],
  invitations: InvitationOwnerDto[],
  filters: {
    search: string;
    side: GuestSideFilter;
    rsvp: GuestRsvpFilter;
  }
): LiveGuest[] {
  const attendanceMap = new Map(attendance.map((row) => [row.guest_id, row]));
  const normQuery = removeVietnameseDiacritics(filters.search.trim());

  return guests.filter((guest) => {
    if (filters.side !== 'all' && guest.side !== filters.side) {
      return false;
    }

    const row = attendanceMap.get(guest.id);
    if (filters.rsvp !== 'all') {
      if (filters.rsvp === 'uninvited') {
        if (row) return false;
      } else if (row?.rsvp_status !== filters.rsvp) {
        return false;
      }
    }

    if (normQuery) {
      const card = invitations.find((item) => item.member_guest_ids.includes(guest.id));
      const normName = removeVietnameseDiacritics(guest.display_name);
      const normCard = card ? removeVietnameseDiacritics(card.card_name) : '';
      const phone = 'phone' in guest && guest.phone ? guest.phone.toLowerCase() : '';
      if (!normName.includes(normQuery) && !normCard.includes(normQuery) && !phone.includes(normQuery)) {
        return false;
      }
    }

    return true;
  });
}

export interface CompactGuestListProps {
  guests: LiveGuest[];
  attendance: LiveAttendance[];
  invitations: InvitationOwnerDto[];
  seatedNames: Record<string, string>;
  isOwner: boolean;
  eventId: string;
  busy: boolean;
  onOpenDetail: (guest: LiveGuest) => void;
  onInvite: (guest: LiveGuest) => void;
  onOpenRsvp: (guestId: string) => void;
  reload: () => Promise<void>;
}

/**
 * Compact responsive guest list rendering a single row per guest across mobile and desktop.
 */
export function CompactGuestList({
  guests,
  attendance,
  invitations,
  seatedNames,
  isOwner,
  eventId,
  busy,
  onOpenDetail,
  onInvite,
  onOpenRsvp,
  reload,
}: CompactGuestListProps) {
  const attendanceMap = useMemo(
    () => new Map(attendance.map((row) => [row.guest_id, row])),
    [attendance]
  );

  return (
    <div className="surface-card overflow-hidden">
      <div className="hidden md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(125px,1fr)_minmax(145px,1.15fr)_auto] items-center gap-4 px-5 py-2.5 bg-page/70 border-b border-border-subtle text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        <span>Khách mời</span>
        <span>Phản hồi</span>
        <span>Chỗ &amp; Bàn</span>
        <span className="text-right">{isOwner ? 'Thao tác' : 'Chi tiết'}</span>
      </div>

      <div className="divide-y divide-border-subtle">
        {guests.map((guest) => {
          const row = attendanceMap.get(guest.id);
          const card = invitations.find((item) => item.member_guest_ids.includes(guest.id));
          const badge = row
            ? RSVP_BADGE_MAP[row.rsvp_status] ?? { variant: 'neutral' as const, text: 'Chưa rõ' }
            : { variant: 'neutral' as const, text: 'Chưa mời' };
          const tableName = seatedNames[guest.id];
          const phone = 'phone' in guest ? guest.phone : null;

          return (
            <article
              key={guest.id}
              data-testid={`guest-${guest.id}`}
              className="px-4 py-3 md:px-5 md:py-3 grid grid-cols-1 md:grid-cols-[minmax(0,2.2fr)_minmax(125px,1fr)_minmax(145px,1.15fr)_auto] items-start md:items-center gap-2.5 md:gap-4 hover:bg-page/40 transition-colors"
            >
              {/* Col 1: Name & compact metadata */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(guest)}
                    className="text-[15px] font-semibold text-primary hover:underline text-left truncate max-w-full"
                  >
                    {guest.display_name}
                  </button>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-page border border-border-subtle text-[11px] font-medium text-text-muted">
                    {SIDE_LABELS[guest.side]}
                  </span>
                  {guest.age_tier !== 'adult' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-info-bg text-info text-[11px] font-medium">
                      {AGE_LABELS[guest.age_tier]}
                    </span>
                  )}
                </div>

                {(phone || card) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-text-muted">
                    {phone && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Phone className="w-3 h-3 shrink-0" aria-hidden="true" />
                        {phone}
                      </span>
                    )}
                    {card && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[260px]">
                        <Mail className="w-3 h-3 shrink-0" aria-hidden="true" />
                        Thiệp: {card.card_name}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Col 2: RSVP Status */}
              <div className="flex items-center">
                <StatusBadge size="sm" variant={badge.variant} text={badge.text} />
              </div>

              {/* Col 3: Seat / Meal / Assigned Table */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                {tableName && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium text-[11px]">
                    {tableName}
                  </span>
                )}
                {row ? (
                  <span>
                    {row.needs_seat ? 'Có ghế' : 'Không ghế'} · {row.needs_meal ? 'Suất ăn' : 'Không ăn'}
                  </span>
                ) : (
                  !tableName && <span className="text-text-muted/60">—</span>
                )}
              </div>

              {/* Col 4: Compact Action Strip */}
              <div className="flex items-center justify-end gap-1.5 flex-wrap md:flex-nowrap w-full md:w-auto pt-1 md:pt-0 border-t border-border-subtle/50 md:border-0">
                {isOwner ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!eventId || busy}
                      onClick={() => (row ? onOpenRsvp(guest.id) : onInvite(guest))}
                      className="h-9 min-h-[36px] md:h-8 md:min-h-[32px] px-3 text-xs whitespace-nowrap"
                    >
                      {row ? 'Cập nhật RSVP' : 'Mời dự buổi'}
                    </Button>
                    <GuestActions guest={guest as GuestOwnerDto} reload={reload} />
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenDetail(guest)}
                    className="text-xs font-medium text-primary hover:underline px-2 py-1"
                  >
                    Chi tiết
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Live guest management workspace with unified toolbar, filters, compact list,
 * and integrated RSVP, household, detail, and duplicate-merge drawers.
 */
export function LiveGuestsDirectory() {
  const { isOwner } = useRole();
  const { currentScope, availableEvents } = useEventScope();
  const eventId = availableEvents.some((event) => event.id === currentScope)
    ? currentScope
    : availableEvents[0]?.id || '';
  const event = availableEvents.find((item) => item.id === eventId);

  const [guests, setGuests] = useState<LiveGuest[]>([]);
  const [attendance, setAttendance] = useState<LiveAttendance[]>([]);
  const [invitations, setInvitations] = useState<InvitationOwnerDto[]>([]);
  const [seatedNames, setSeatedNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sideFilter, setSideFilter] = useState<GuestSideFilter>('all');
  const [rsvpFilter, setRsvpFilter] = useState<GuestRsvpFilter>('all');

  const [addGuest, setAddGuest] = useState(false);
  const [addFamily, setAddFamily] = useState(false);
  const [rsvpGuest, setRsvpGuest] = useState<string | null>(null);
  const [detail, setDetail] = useState<GuestDetailData | null>(null);
  const [busy, setBusy] = useState(false);

  const duplicateState = useDuplicateReview();
  const generation = useRef(0);
  const currentFilters = useRef({ eventId });
  currentFilters.current = { eventId };

  const load = useCallback(async () => {
    // A mutation may finish after the user has changed the visible filter.
    // Its old reload callback must not replace the current list.
    if (currentFilters.current.eventId !== eventId) return;
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const [people, attendees, cards] = await Promise.all([
        allPages<LiveGuest>('/api/v1/guests'),
        eventId
          ? api<{
              data: {
                attendance: LiveAttendance[];
                tables: { id: string; name: string }[];
                seats: { guestId: string; tableId: string }[];
              };
            }>(`/api/v1/seating?eventId=${eventId}`)
          : Promise.resolve({ data: { attendance: [], tables: [], seats: [] } }),
        eventId
          ? api<{ data: InvitationOwnerDto[] }>(`/api/v1/invitations?eventId=${eventId}`)
          : Promise.resolve({ data: [] }),
      ]);
      if (request !== generation.current) return;
      setGuests(people);
      setAttendance(attendees.data.attendance);
      setInvitations(cards.data);
      setSeatedNames(
        Object.fromEntries(
          attendees.data.seats.map((seat) => [
            seat.guestId,
            attendees.data.tables.find((table) => table.id === seat.tableId)?.name || 'Bàn đã xếp',
          ])
        )
      );
    } catch (failure) {
      if (request === generation.current) setError((failure as Error).message);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
    setRsvpGuest(null);
    setDetail(null);
    return () => {
      generation.current++;
    };
  }, [load]);

  const createGuest = async (draft: AddGuestDraft) => {
    await api('/api/v1/guests', {
      method: 'POST',
      body: jsonBody({
        display_name: draft.displayName,
        side: draft.side,
        age_tier: draft.ageTier,
        phone: draft.phone || null,
        email: draft.email || null,
        address: draft.address || null,
        private_notes: draft.privateNotes || null,
        is_placeholder: draft.isPlaceholder,
        placeholder_for: draft.placeholderFor || null,
        sub_tags: draft.subTags,
        ...(eventId ? { event_id: eventId, initial_rsvp_status: 'accepted' } : {}),
      }),
    });
    await load();
  };

  const createFamily: AddFamilyModalProps['onSubmit'] = async (draft) => {
    if (!eventId) throw new Error('Hãy chọn một buổi lễ trước khi tạo thiệp gia đình.');
    await api('/api/v1/guests/household', {
      method: 'POST',
      body: jsonBody({
        ...draft,
        eventId,
        members: draft.members.map((member) => ({
          ...member,
          displayName: member.name,
          phone: member.phone || null,
          rsvpStatus: 'accepted',
        })),
      }),
    });
    await load();
  };

  const invite = async (guest: LiveGuest) => {
    if (!eventId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/v1/invitations', {
        method: 'POST',
        body: jsonBody({
          event_id: eventId,
          card_name: guest.display_name,
          representative_guest_id: guest.id,
          member_guest_ids: [guest.id],
        }),
      });
      const attRes = await api<{ data: AttendanceOwnerDto[] }>(
        `/api/v1/attendance?guestId=${guest.id}&eventId=${eventId}`
      );
      const createdAtt = attRes.data[0];
      if (createdAtt && createdAtt.rsvp_status !== 'accepted') {
        await api('/api/v1/attendance', {
          method: 'PATCH',
          body: jsonBody({
            guest_id: guest.id,
            event_id: eventId,
            rsvp_status: 'accepted',
            needs_seat: createdAtt.needs_seat,
            needs_meal: createdAtt.needs_meal,
            meal_dietary_tier: createdAtt.meal_dietary_tier,
            accommodation_needed: createdAtt.accommodation_needed ?? false,
            transport_needed: createdAtt.transport_needed ?? false,
            version: createdAtt.version,
          }),
        });
      }
      await load();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveRsvp = async (members: MemberRsvpState[]) => {
    const member = members[0];
    const previous = attendance.find((row) => row.guest_id === member.guestId);
    if (!previous) throw new Error('Chưa có bản ghi tham dự. Hãy mời khách vào buổi lễ trước.');
    await api('/api/v1/attendance', {
      method: 'PATCH',
      body: jsonBody({
        ...previous,
        guest_id: member.guestId,
        event_id: eventId,
        rsvp_status: member.rsvpStatus,
        needs_seat: member.needsSeat,
        needs_meal: member.needsMeal,
        meal_dietary_tier: member.mealTier,
        accommodation_needed: previous.accommodation_needed ?? false,
        transport_needed: previous.transport_needed ?? false,
      }),
    });
    await load();
  };

  const openDetail = (guest: LiveGuest) => {
    const card = invitations.find((item) => item.member_guest_ids.includes(guest.id));
    setDetail({
      id: guest.id,
      displayName: guest.display_name,
      side: guest.side,
      groupName: card?.card_name || null,
      ageTier: guest.age_tier,
      ...('phone' in guest
        ? {
            phone: guest.phone,
            email: guest.email,
            address: guest.address,
            privateNotes: guest.private_notes,
          }
        : {}),
      subTags: guest.sub_tags,
      version: guest.version,
      attendances: attendance
        .filter((row) => row.guest_id === guest.id)
        .map((row) => ({
          eventId,
          eventName: event?.name || '',
          rsvpStatus: row.rsvp_status,
          needsSeat: row.needs_seat,
          needsMeal: row.needs_meal,
          mealDietaryTier: row.meal_dietary_tier,
          tableName: seatedNames[guest.id] || null,
          invitationCardName: card?.card_name || null,
          invitationStatus: card?.status,
        })),
    });
  };

  const active = guests.find((guest) => guest.id === rsvpGuest);
  const activeAttendance = attendance.find((row) => row.guest_id === rsvpGuest);

  const stats = useMemo(() => computeGuestStats(guests, attendance), [guests, attendance]);
  const shown = useMemo(
    () =>
      filterLiveGuests(guests, attendance, invitations, {
        search,
        side: sideFilter,
        rsvp: rsvpFilter,
      }),
    [guests, attendance, invitations, search, sideFilter, rsvpFilter]
  );
  const pagination = usePagination(shown, {
    defaultPageSize: 25,
    resetKey: `${eventId}:${search}:${sideFilter}:${rsvpFilter}`,
  });

  const hasActiveFilters = Boolean(search.trim() || sideFilter !== 'all' || rsvpFilter !== 'all');
  const clearFilters = () => {
    setSearch('');
    setSideFilter('all');
    setRsvpFilter('all');
  };

  const detailCanUpdateRsvp =
    isOwner && detail ? attendance.some((row) => row.guest_id === detail.id) : false;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1.5">Những người thương quý</p>
          <h1 className="text-[26px] sm:text-[32px] font-medium leading-tight">Danh sách khách mời</h1>
        </div>
        {isOwner && (
          <div className="flex flex-wrap items-center gap-2">
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setAddGuest(true)}>
              Thêm khách mời
            </Button>
            <Button variant="secondary" disabled={!eventId} onClick={() => setAddFamily(true)}>
              Thêm gia đình
            </Button>
          </div>
        )}
      </div>

      {/* Unified Control Bar */}
      <div className="surface-card p-4 space-y-3">
        {/* Top strip: Event context + counters + secondary owner tools */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-border-subtle/70">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span>
              Buổi: <strong className="font-medium text-text-main">{event?.name || 'Chưa có buổi lễ'}</strong>
            </span>
            {!loading && !error && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium tabular-nums">
                  <Users className="w-3 h-3" aria-hidden="true" />
                  {stats.total} khách
                </span>
                {stats.accepted > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-success-bg text-success font-medium tabular-nums">
                    {stats.accepted} tham dự
                  </span>
                )}
                {stats.pending > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-warning-bg text-warning font-medium tabular-nums">
                    {stats.pending} chờ
                  </span>
                )}
                {stats.uninvited > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-page border border-border-subtle text-text-muted font-medium tabular-nums">
                    {stats.uninvited} chưa mời
                  </span>
                )}
              </div>
            )}
          </div>

          {isOwner && (
            <div className="flex flex-wrap items-center gap-3">
              <DuplicateReviewTrigger
                busy={duplicateState.busy}
                onClick={() => void duplicateState.checkDuplicates()}
              />
            </div>
          )}
        </div>

        {/* Search & Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Tìm khách mời"
              placeholder="Tìm theo tên, SĐT, tên thiệp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-9 text-sm bg-surface border border-border-control rounded-control focus:outline-none focus:border-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-text-main"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <select
            aria-label="Lọc theo bên mời"
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value as GuestSideFilter)}
            className="h-11 sm:w-40 text-sm bg-surface border border-border-control rounded-control"
          >
            <option value="all">Tất cả bên mời</option>
            <option value="groom">Nhà trai</option>
            <option value="bride">Nhà gái</option>
            <option value="mutual">Bạn chung</option>
            <option value="unassigned">Chưa phân</option>
          </select>

          <select
            aria-label="Lọc theo trạng thái"
            value={rsvpFilter}
            onChange={(e) => setRsvpFilter(e.target.value as GuestRsvpFilter)}
            className="h-11 sm:w-44 text-sm bg-surface border border-border-control rounded-control"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="accepted">Sẽ tham dự</option>
            <option value="pending_reply">Chưa phản hồi</option>
            <option value="tentative">Cân nhắc</option>
            <option value="declined">Không tham dự</option>
            <option value="not_contacted">Chưa liên hệ</option>
            <option value="uninvited">Chưa mời</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-11 px-3 text-xs font-medium text-danger hover:bg-danger-bg/60 rounded-control border border-danger/20 whitespace-nowrap transition-colors"
            >
              Xóa lọc
            </button>
          )}
        </div>

        {/* Inline duplicate check results */}
        {isOwner && <DuplicateReviewResults state={duplicateState} reload={load} />}
      </div>

      {/* Error alert */}
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

      {/* Loading skeleton */}
      {loading && (
        <div role="status" className="surface-card divide-y divide-border-subtle animate-pulse">
          <span className="sr-only">Đang tải khách mời…</span>
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-44 bg-border-subtle rounded" />
                <div className="h-3 w-28 bg-border-subtle/70 rounded" />
              </div>
              <div className="h-6 w-24 bg-border-subtle rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && shown.length === 0 && (
        <EmptyState
          type={hasActiveFilters ? 'no_filter_match' : 'no_data'}
          title={
            hasActiveFilters
              ? 'Không tìm thấy khách mời phù hợp'
              : 'Những gương mặt thân thương, bắt đầu từ đây'
          }
          description={
            hasActiveFilters
              ? 'Thử đổi từ khóa hoặc xóa bộ lọc để xem toàn bộ danh sách khách mời.'
              : 'Thêm khách mời để cùng theo dõi thiệp mời, phản hồi và sắp xếp chỗ ngồi cho ngày chung vui.'
          }
          icon={<Users className="w-7 h-7 text-accent" strokeWidth={1.4} />}
          action={
            hasActiveFilters
              ? { label: 'Xóa bộ lọc', onClick: clearFilters }
              : isOwner
              ? { label: 'Thêm khách mời đầu tiên', onClick: () => setAddGuest(true) }
              : undefined
          }
        />
      )}

      {/* Compact Guest List */}
      {!loading && !error && shown.length > 0 && (
        <>
          <CompactGuestList
            guests={pagination.pagedItems}
            attendance={attendance}
            invitations={invitations}
            seatedNames={seatedNames}
            isOwner={isOwner}
            eventId={eventId}
            busy={busy}
            onOpenDetail={openDetail}
            onInvite={(guest) => void invite(guest)}
            onOpenRsvp={(id) => setRsvpGuest(id)}
            reload={load}
          />
          <Pagination
            currentPage={pagination.currentPage}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            onPageChange={pagination.setCurrentPage}
            onPageSizeChange={pagination.setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            unitLabel="khách"
          />
        </>
      )}

      {/* Modals & Drawers */}
      {addGuest && (
        <AddGuestModal isOpen onClose={() => setAddGuest(false)} onSubmit={createGuest} />
      )}
      {addFamily && (
        <AddFamilyModal
          isOpen
          initialGroupName=""
          initialMembers={[{ id: '1', name: '', ageTier: 'adult', isRepresentative: true }]}
          onClose={() => setAddFamily(false)}
          onSubmit={createFamily}
        />
      )}
      {active && activeAttendance && (
        <RsvpUpdateDrawer
          key={`${eventId}:${active.id}`}
          isOpen
          onClose={() => setRsvpGuest(null)}
          householdName={active.display_name}
          initialEventTitle={event?.name}
          onSave={saveRsvp}
          initialMembers={[
            {
              guestId: active.id,
              name: active.display_name,
              rsvpStatus: activeAttendance.rsvp_status,
              needsSeat: activeAttendance.needs_seat,
              needsMeal: activeAttendance.needs_meal,
              mealTier: activeAttendance.meal_dietary_tier,
              assignedTable: seatedNames[active.id] || null,
            },
          ]}
        />
      )}
      <GuestDetailDrawer
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        guest={detail}
        onUpdateRsvp={
          detailCanUpdateRsvp
            ? (guest) => {
                setDetail(null);
                setRsvpGuest(guest.id);
              }
            : undefined
        }
      />
    </section>
  );
}
