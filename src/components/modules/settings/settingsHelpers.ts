export type EventType = 'engagement' | 'ancestor_ceremony' | 'wedding_party' | 'other';
export type EventStatus = 'tentative' | 'confirmed' | 'completed' | 'cancelled';

export interface WeddingSettingsPublicDto {
  id: string;
  groomName: string;
  brideName: string;
  shortTitle: string | null;
  tentativeDateNote: string;
  isDateConfirmed: boolean;
  representativeEventId: string | null;
  version: number;
}

export interface WeddingConfigurationDto extends WeddingSettingsPublicDto {
  budgetTarget: string | null;
  contingencyBudget: string | null;
}

export interface WeddingEventDto {
  id: string;
  title: string;
  eventType: EventType;
  status: EventStatus;
  startTime: string | null;
  endTime: string | null;
  locationName: string | null;
  locationAddress: string | null;
  mapUrl: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  publicNotes: string | null;
  privateNotes?: string | null;
  isCheckInEnabled: boolean;
  version: number;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  engagement: 'Ăn hỏi',
  ancestor_ceremony: 'Gia tiên',
  wedding_party: 'Tiệc cưới',
  other: 'Khác',
};

export const EVENT_STATUS_META: Record<
  EventStatus,
  { label: string; badgeVariant: 'warning' | 'success' | 'neutral' | 'danger' }
> = {
  tentative: { label: 'Dự kiến', badgeVariant: 'warning' },
  confirmed: { label: 'Đã chốt', badgeVariant: 'success' },
  completed: { label: 'Đã kết thúc', badgeVariant: 'neutral' },
  cancelled: { label: 'Đã hủy', badgeVariant: 'danger' },
};

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Convert an ISO timestamp string to `YYYY-MM-DDTHH:mm` in Vietnam time (UTC+7)
 * for native `datetime-local` inputs.
 */
export function toVietnamDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Date(parsed.getTime() + VN_OFFSET_MS).toISOString().slice(0, 16);
}

/**
 * Convert a `datetime-local` value entered in Vietnam time (UTC+7) back to an ISO UTC string.
 */
export function fromVietnamDateTimeInput(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) return null;
  const parsed = new Date(`${trimmed}:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export interface CeremonyTimeFormat {
  dateLabel: string;
  timeLabel: string | null;
  isScheduled: boolean;
}

function vnDateKey(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function vnTimeOnly(date: Date): string {
  return date.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function vnShortDate(date: Date): string {
  const [, month, day] = vnDateKey(date).split('-');
  return `${day}/${month}`;
}

/**
 * Format ceremony start/end timestamps into concise Vietnamese display labels.
 */
export function formatCeremonyTimeRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): CeremonyTimeFormat {
  if (!startIso) {
    return {
      dateLabel: 'Chưa ấn định ngày giờ',
      timeLabel: null,
      isScheduled: false,
    };
  }
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return {
      dateLabel: 'Chưa ấn định ngày giờ',
      timeLabel: null,
      isScheduled: false,
    };
  }

  const dateLabel = start.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const startClock = vnTimeOnly(start);
  if (!endIso) {
    return {
      dateLabel,
      timeLabel: startClock,
      isScheduled: true,
    };
  }

  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) {
    return {
      dateLabel,
      timeLabel: startClock,
      isScheduled: true,
    };
  }

  const endClock = vnTimeOnly(end);
  const sameDay = vnDateKey(start) === vnDateKey(end);
  return {
    dateLabel,
    timeLabel: sameDay
      ? `${startClock} – ${endClock}`
      : `${startClock} ${vnShortDate(start)} – ${endClock} ${vnShortDate(end)}`,
    isScheduled: true,
  };
}

/**
 * Order ceremonies cleanly for Settings:
 * 1) Representative active ceremony first
 * 2) Other non-cancelled ceremonies sorted chronologically (unscheduled after scheduled)
 * 3) Cancelled ceremonies last
 */
export function sortCeremoniesForSettings(
  events: WeddingEventDto[],
  representativeEventId: string | null | undefined
): WeddingEventDto[] {
  return [...events].sort((a, b) => {
    const aCancelled = a.status === 'cancelled';
    const bCancelled = b.status === 'cancelled';
    if (aCancelled !== bCancelled) return aCancelled ? 1 : -1;

    const aRep = !aCancelled && a.id === representativeEventId;
    const bRep = !bCancelled && b.id === representativeEventId;
    if (aRep !== bRep) return aRep ? -1 : 1;

    const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;

    return a.title.localeCompare(b.title, 'vi');
  });
}

export interface SettingsSummaryMetrics {
  activeCount: number;
  confirmedCount: number;
  tentativeCount: number;
  cancelledCount: number;
  representativeEvent: WeddingEventDto | null;
  coupleDisplayTitle: string;
  budgetTarget: bigint | null;
  contingencyBudget: bigint | null;
}

function parseOptionalBigInt(value: string | null | undefined): bigint | null {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function computeSettingsSummary(
  events: WeddingEventDto[],
  config: WeddingConfigurationDto | null
): SettingsSummaryMetrics {
  let activeCount = 0;
  let confirmedCount = 0;
  let tentativeCount = 0;
  let cancelledCount = 0;

  for (const ev of events) {
    if (ev.status === 'cancelled') {
      cancelledCount++;
    } else {
      activeCount++;
      if (ev.status === 'confirmed') confirmedCount++;
      else if (ev.status === 'tentative') tentativeCount++;
    }
  }

  const representativeEvent =
    events.find((e) => e.id === config?.representativeEventId && e.status !== 'cancelled') ?? null;

  const coupleDisplayTitle = config
    ? config.shortTitle?.trim() || `${config.groomName} & ${config.brideName}`
    : 'Sổ Quản Lý Đám Cưới';

  return {
    activeCount,
    confirmedCount,
    tentativeCount,
    cancelledCount,
    representativeEvent,
    coupleDisplayTitle,
    budgetTarget: parseOptionalBigInt(config?.budgetTarget),
    contingencyBudget: parseOptionalBigInt(config?.contingencyBudget),
  };
}
