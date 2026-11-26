import { removeVietnameseDiacritics } from '@/lib/utils';
import type {
  DeliveryMethod,
  GuestOwnerDto,
  GuestSide,
  InvitationOwnerDto,
  InvitationStatus,
} from '@/schemas/guests';

export type InvitationStatusFilter = 'all' | InvitationStatus;
export type InvitationMethodFilter = 'all' | DeliveryMethod;

export const DELIVERY_METHOD_OPTIONS: ReadonlyArray<{
  value: DeliveryMethod;
  label: string;
}> = [
  { value: 'paper', label: 'Thiệp giấy' },
  { value: 'electronic', label: 'Thiệp điện tử' },
  { value: 'in_person', label: 'Trao tận tay' },
];

export const INVITATION_STATUS_OPTIONS: ReadonlyArray<{
  value: InvitationStatus;
  label: string;
}> = [
  { value: 'save_the_date', label: 'Đã giữ lịch' },
  { value: 'preparing', label: 'Đang chuẩn bị' },
  { value: 'sent', label: 'Đã gửi' },
];

export const STATUS_BADGE_MAP: Record<
  InvitationStatus,
  { variant: 'info' | 'warning' | 'success'; label: string }
> = {
  save_the_date: { variant: 'info', label: 'Đã giữ lịch' },
  preparing: { variant: 'warning', label: 'Đang chuẩn bị' },
  sent: { variant: 'success', label: 'Đã gửi' },
};

export const SIDE_LABELS: Record<GuestSide, string> = {
  groom: 'Nhà trai',
  bride: 'Nhà gái',
  mutual: 'Bạn chung',
  unassigned: 'Chưa phân',
};

export interface InvitationStats {
  totalCards: number;
  sentCards: number;
  preparingCards: number;
  saveTheDateCards: number;
  totalGuestsCovered: number;
  sentRatePercent: number;
}

/** Returns today's YYYY-MM-DD calendar date in Asia/Ho_Chi_Minh timezone. */
export function todayIsoInVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Formats ISO date string YYYY-MM-DD cleanly to dd/mm/yyyy for UI display. */
export function formatShortViDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const match = String(isoDate).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(isoDate);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Computes aggregate progress counters across all invitation cards in an event. */
export function computeInvitationStats(invitations: InvitationOwnerDto[]): InvitationStats {
  let sentCards = 0;
  let preparingCards = 0;
  let saveTheDateCards = 0;
  const coveredGuests = new Set<string>();

  for (const inv of invitations) {
    if (inv.status === 'sent') sentCards++;
    else if (inv.status === 'preparing') preparingCards++;
    else saveTheDateCards++;

    if (inv.representative_guest_id) coveredGuests.add(inv.representative_guest_id);
    for (const id of inv.member_guest_ids) coveredGuests.add(id);
  }

  const totalCards = invitations.length;
  const sentRatePercent = totalCards > 0 ? Math.round((sentCards / totalCards) * 100) : 0;

  return {
    totalCards,
    sentCards,
    preparingCards,
    saveTheDateCards,
    totalGuestsCovered: coveredGuests.size,
    sentRatePercent,
  };
}

/** Maps each guestId belonging to another card in the same event to its card name. */
export function buildOccupiedGuestCardMap(
  invitations: InvitationOwnerDto[],
  excludeInvitationId?: string
): Map<string, string> {
  const map = new Map<string, string>();
  for (const inv of invitations) {
    if (excludeInvitationId && inv.id === excludeInvitationId) continue;
    for (const guestId of [inv.representative_guest_id, ...inv.member_guest_ids]) {
      if (guestId && !map.has(guestId)) {
        map.set(guestId, inv.card_name);
      }
    }
  }
  return map;
}

/** Filters invitations by search query (card name, guest names, notes), status, and method. */
export function filterInvitations(
  invitations: InvitationOwnerDto[],
  guestMap: Map<string, GuestOwnerDto>,
  filters: {
    search: string;
    statusFilter: InvitationStatusFilter;
    methodFilter: InvitationMethodFilter;
  }
): InvitationOwnerDto[] {
  const normQuery = removeVietnameseDiacritics(filters.search.trim());
  return invitations.filter((inv) => {
    if (filters.statusFilter !== 'all' && inv.status !== filters.statusFilter) {
      return false;
    }
    if (filters.methodFilter !== 'all' && inv.delivery_method !== filters.methodFilter) {
      return false;
    }
    if (normQuery) {
      const memberNames = inv.member_guest_ids
        .map((id) => guestMap.get(id)?.display_name || '')
        .join(' ');
      const repName = guestMap.get(inv.representative_guest_id)?.display_name || '';
      const haystack = removeVietnameseDiacritics(
        `${inv.card_name} ${repName} ${memberNames} ${inv.notes || ''}`
      );
      if (!haystack.includes(normQuery)) {
        return false;
      }
    }
    return true;
  });
}

/** Suggests a natural Vietnamese card name when members are chosen on a blank form. */
export function suggestCardName(
  memberIds: string[],
  representativeId: string,
  guestMap: Map<string, GuestOwnerDto>
): string {
  const primaryId = representativeId || memberIds[0];
  const primaryName = primaryId ? guestMap.get(primaryId)?.display_name?.trim() : '';
  if (!primaryName) return '';
  return memberIds.length > 1 ? `Gia đình ${primaryName}` : primaryName;
}
