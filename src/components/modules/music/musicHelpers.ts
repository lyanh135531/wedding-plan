import { removeVietnameseDiacritics } from '@/lib/utils';
import type { PreparationItemDto } from '@/schemas/preparation';

export interface MusicMomentOption {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const MUSIC_MOMENTS: readonly MusicMomentOption[] = [
  {
    key: 'guest_arrival',
    label: '1. Đón khách',
    shortLabel: 'Đón khách',
    description: 'Acoustic nhẹ nhàng, giai điệu êm dịu khi khách ổn định chỗ ngồi.',
  },
  {
    key: 'entrance',
    label: '2. Tiến vào lễ',
    shortLabel: 'Tiến vào lễ',
    description: 'Khúc nhạc trang trọng và cảm xúc lúc cô dâu chú rể bước vào lễ đường.',
  },
  {
    key: 'vows_rings',
    label: '3. Trao nhẫn & Lời thề',
    shortLabel: 'Trao nhẫn',
    description: 'Cao trào thiêng liêng khi trao nhẫn cưới và lời hẹn ước.',
  },
  {
    key: 'toast',
    label: '4. Nâng ly & Khai tiệc',
    shortLabel: 'Nâng ly',
    description: 'Giai điệu ngọt ngào, hân hoan lúc cắt bánh và rót tháp rượu.',
  },
  {
    key: 'first_dance',
    label: '5. Khiêu vũ đầu tiên',
    shortLabel: 'Khiêu vũ',
    description: 'Bản tình ca lãng mạn riêng cho khoảnh khắc khiêu vũ của hai bạn.',
  },
  {
    key: 'party_games',
    label: '6. Tiệc & Trò chơi',
    shortLabel: 'Tiệc & Chơi',
    description: 'Nhịp điệu vui tươi, sôi nổi khi chúc bàn và tung hoa cưới.',
  },
  {
    key: 'send_off',
    label: '7. Tiễn khách',
    shortLabel: 'Tiễn khách',
    description: 'Giai điệu ấm áp, lưu luyến khi buổi tiệc khép lại.',
  },
] as const;

const LEGACY_MOMENT_ALIAS: Record<string, string> = {
  grand_entrance: 'entrance',
  ceremony: 'vows_rings',
  champagne_cake: 'toast',
  table_visits: 'party_games',
  bouquet_toss: 'party_games',
};

export function normalizeMomentKey(rawMoment: string | null | undefined): string {
  const key = (rawMoment || '').trim();
  if (!key) return 'guest_arrival';
  return LEGACY_MOMENT_ALIAS[key] || key;
}

export function getMomentMeta(rawMoment: string | null | undefined): MusicMomentOption {
  const normalized = normalizeMomentKey(rawMoment);
  return (
    MUSIC_MOMENTS.find((m) => m.key === normalized) ?? {
      key: normalized,
      label: normalized,
      shortLabel: normalized,
      description: '',
    }
  );
}

export interface ParsedMusicTrack {
  id: string;
  eventId: string;
  title: string;
  artist: string | null;
  moment: string;
  externalUrl: string | null;
  durationSeconds: number | null;
  cueNotes: string | null;
  trackOrder: number;
  isBlacklisted: boolean;
  isShared: boolean;
  version: number;
}

export function parseMusicTrack(dto: PreparationItemDto): ParsedMusicTrack {
  const meta = (dto.metadata || {}) as Record<string, unknown>;
  const rawDuration = meta.durationSeconds;
  const durationSeconds =
    typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration >= 0
      ? Math.round(rawDuration)
      : null;

  const rawOrder = meta.trackOrder;
  const trackOrder =
    typeof rawOrder === 'number' && Number.isFinite(rawOrder) && rawOrder >= 0
      ? Math.round(rawOrder)
      : 0;

  return {
    id: dto.id,
    eventId: dto.eventId,
    title: dto.title,
    artist: typeof meta.artist === 'string' && meta.artist.trim() ? meta.artist.trim() : null,
    moment: normalizeMomentKey(
      (typeof meta.moment === 'string' ? meta.moment : dto.category) || 'guest_arrival'
    ),
    externalUrl:
      typeof meta.externalUrl === 'string' && meta.externalUrl.trim()
        ? meta.externalUrl.trim()
        : null,
    durationSeconds,
    cueNotes:
      typeof meta.cueNotes === 'string' && meta.cueNotes.trim() ? meta.cueNotes.trim() : null,
    trackOrder,
    isBlacklisted: Boolean(dto.isBlacklisted),
    isShared: Boolean(dto.isShared),
    version: dto.version,
  };
}

/**
 * Format duration in seconds into compact `m:ss` text (e.g. `205` -> `'3:25'`).
 */
export function formatDurationSeconds(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format total playlist duration concisely in Vietnamese (`'18 phút'` or `'1 giờ 12 phút'`).
 */
export function formatTotalPlaylistDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 'Chưa rõ';
  const totalMins = Math.round(totalSeconds / 60);
  if (totalMins < 1) return `${Math.round(totalSeconds)} giây`;
  if (totalMins < 60) return `${totalMins} phút`;
  const hours = Math.floor(totalMins / 60);
  const remMins = totalMins % 60;
  return remMins > 0 ? `${hours}g ${remMins}p` : `${hours} giờ`;
}

/**
 * Parse user duration input accepting either `mm:ss` (e.g. `'3:45'`) or plain seconds (`'225'`).
 * Returns `null` when empty, or `undefined` when invalid format.
 */
export function parseDurationInput(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isSafeInteger(num) && num >= 0 && num <= 86400 ? num : undefined;
  }

  const mmss = trimmed.match(/^(\d{1,3}):([0-5]\d)$/);
  if (mmss) {
    const mins = Number(mmss[1]);
    const secs = Number(mmss[2]);
    return mins * 60 + secs;
  }

  return undefined;
}

export function detectStreamingSource(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('spotify.com')) return 'Spotify';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('soundcloud.com')) return 'SoundCloud';
    if (host.includes('music.apple.com')) return 'Apple Music';
    if (host.includes('zingmp3.vn') || host.includes('nhaccuatui.com')) return 'Nhạc Việt';
    return 'Nghe thử';
  } catch {
    return null;
  }
}

export interface MusicStats {
  totalActive: number;
  totalBlacklisted: number;
  totalDurationSeconds: number;
  coveredMomentsCount: number;
  totalMomentsCount: number;
  activeCountByMoment: Record<string, number>;
}

export function computeMusicStats(tracks: ParsedMusicTrack[]): MusicStats {
  const activeCountByMoment: Record<string, number> = {};
  const coveredSet = new Set<string>();
  let totalActive = 0;
  let totalBlacklisted = 0;
  let totalDurationSeconds = 0;

  for (const track of tracks) {
    if (track.isBlacklisted) {
      totalBlacklisted++;
      continue;
    }
    totalActive++;
    if (track.durationSeconds && track.durationSeconds > 0) {
      totalDurationSeconds += track.durationSeconds;
    }
    activeCountByMoment[track.moment] = (activeCountByMoment[track.moment] || 0) + 1;
    if (MUSIC_MOMENTS.some((m) => m.key === track.moment)) {
      coveredSet.add(track.moment);
    }
  }

  return {
    totalActive,
    totalBlacklisted,
    totalDurationSeconds,
    coveredMomentsCount: coveredSet.size,
    totalMomentsCount: MUSIC_MOMENTS.length,
    activeCountByMoment,
  };
}

export type MusicViewFilter = 'all' | 'active' | 'blacklisted';

export function filterMusicTracks(
  tracks: ParsedMusicTrack[],
  filters: {
    search: string;
    momentFilter: string;
    viewFilter: MusicViewFilter;
  }
): ParsedMusicTrack[] {
  const cleanSearch = removeVietnameseDiacritics(filters.search.trim()).toLowerCase();

  return tracks.filter((track) => {
    if (filters.viewFilter === 'active' && track.isBlacklisted) return false;
    if (filters.viewFilter === 'blacklisted' && !track.isBlacklisted) return false;

    if (filters.momentFilter !== 'all' && track.moment !== filters.momentFilter) {
      return false;
    }

    if (cleanSearch) {
      const haystack = removeVietnameseDiacritics(
        `${track.title} ${track.artist || ''} ${track.cueNotes || ''} ${getMomentMeta(track.moment).label}`
      ).toLowerCase();
      if (!haystack.includes(cleanSearch)) return false;
    }

    return true;
  });
}
