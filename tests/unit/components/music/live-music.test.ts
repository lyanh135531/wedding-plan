import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider } from '@/context/EventScopeContext';
import type { PreparationItemDto } from '@/schemas/preparation';
import {
  computeMusicStats,
  detectStreamingSource,
  filterMusicTracks,
  formatDurationSeconds,
  formatTotalPlaylistDuration,
  getMomentMeta,
  parseDurationInput,
  parseMusicTrack,
} from '@/components/modules/music/musicHelpers';
import { LiveMusicWorkspace } from '@/components/modules/music/LiveMusicWorkspace';

function makeMusicDto(partial: Partial<PreparationItemDto> = {}): PreparationItemDto {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    eventId: '00000000-0000-4000-8000-000000000011',
    type: 'music',
    title: 'Ánh Nắng Của Anh',
    category: 'entrance',
    status: 'active',
    priority: null,
    metadata: {
      artist: 'Đức Phúc',
      moment: 'entrance',
      externalUrl: 'https://open.spotify.com/track/abc',
      durationSeconds: 245,
      cueNotes: 'Vào điệp khúc lúc cô dâu bước vào sảnh',
      trackOrder: 1,
    },
    isRental: false,
    returnDueDate: null,
    isBlacklisted: false,
    isShared: false,
    version: 1,
    handedOverAt: null,
    createdAt: '2026-11-26T00:00:00.000Z',
    updatedAt: '2026-11-26T00:00:00.000Z',
    ...partial,
  };
}

describe('Music Helpers & LiveMusicWorkspace UI', () => {
  it('parses DTO metadata safely and normalizes legacy moment keys', () => {
    const modern = parseMusicTrack(makeMusicDto());
    expect(modern).toMatchObject({
      title: 'Ánh Nắng Của Anh',
      artist: 'Đức Phúc',
      moment: 'entrance',
      durationSeconds: 245,
      trackOrder: 1,
      isBlacklisted: false,
    });

    const legacy = parseMusicTrack(
      makeMusicDto({
        category: 'ceremony',
        metadata: { moment: 'ceremony', trackOrder: 0 },
      })
    );
    expect(legacy.moment).toBe('vows_rings');
    expect(getMomentMeta(legacy.moment).shortLabel).toBe('Trao nhẫn');
  });

  it('formats and parses mm:ss and second-based track durations cleanly', () => {
    expect(formatDurationSeconds(245)).toBe('4:05');
    expect(formatDurationSeconds(0)).toBe('0:00');
    expect(formatDurationSeconds(null)).toBeNull();

    expect(parseDurationInput('')).toBeNull();
    expect(parseDurationInput('3:45')).toBe(225);
    expect(parseDurationInput('180')).toBe(180);
    expect(parseDurationInput('3:99')).toBeUndefined();
    expect(parseDurationInput('abc')).toBeUndefined();

    expect(formatTotalPlaylistDuration(0)).toBe('Chưa rõ');
    expect(formatTotalPlaylistDuration(900)).toBe('15 phút');
    expect(formatTotalPlaylistDuration(4320)).toBe('1g 12p');
  });

  it('detects common music streaming providers from external URLs', () => {
    expect(detectStreamingSource('https://open.spotify.com/track/123')).toBe('Spotify');
    expect(detectStreamingSource('https://youtu.be/xyz')).toBe('YouTube');
    expect(detectStreamingSource('https://soundcloud.com/artist/song')).toBe('SoundCloud');
    expect(detectStreamingSource('https://music.apple.com/vn/album/1')).toBe('Apple Music');
    expect(detectStreamingSource('https://example.com/audio')).toBe('Nghe thử');
    expect(detectStreamingSource('not-a-url')).toBeNull();
  });

  it('computes active/blacklisted KPIs and filters tracks with unaccented search', () => {
    const active1 = parseMusicTrack(makeMusicDto());
    const active2 = parseMusicTrack(
      makeMusicDto({
        id: '00000000-0000-4000-8000-000000000002',
        title: 'Can’t Help Falling In Love',
        category: 'guest_arrival',
        metadata: {
          artist: 'Kina Grannis',
          moment: 'guest_arrival',
          durationSeconds: 200,
          trackOrder: 0,
        },
      })
    );
    const blocked = parseMusicTrack(
      makeMusicDto({
        id: '00000000-0000-4000-8000-000000000003',
        title: 'Nhạc Buồn Không Phát',
        category: 'send_off',
        metadata: {
          moment: 'send_off',
          durationSeconds: 300,
          trackOrder: 2,
        },
        isBlacklisted: true,
      })
    );

    const list = [active2, active1, blocked];
    const stats = computeMusicStats(list);
    expect(stats.totalActive).toBe(2);
    expect(stats.totalBlacklisted).toBe(1);
    expect(stats.totalDurationSeconds).toBe(445);
    expect(stats.coveredMomentsCount).toBe(2);
    expect(stats.activeCountByMoment.entrance).toBe(1);
    expect(stats.activeCountByMoment.send_off).toBeUndefined();

    expect(
      filterMusicTracks(list, {
        search: 'anh nang',
        momentFilter: 'all',
        viewFilter: 'active',
      }).map((t) => t.title)
    ).toEqual(['Ánh Nắng Của Anh']);

    expect(
      filterMusicTracks(list, {
        search: '',
        momentFilter: 'all',
        viewFilter: 'blacklisted',
      }).map((t) => t.title)
    ).toEqual(['Nhạc Buồn Không Phát']);
  });

  it('renders LiveMusicWorkspace cleanly for both active-event loading and empty events', () => {
    const loadingHtml = renderToStaticMarkup(
      React.createElement(
        RoleProvider,
        { initialRole: 'owner' },
        React.createElement(
          EventScopeProvider,
          {
            initialEvents: [
              { id: '00000000-0000-4000-8000-000000000011', name: 'Tiệc Cưới Chính', isRepresentative: true },
            ],
          },
          React.createElement(LiveMusicWorkspace)
        )
      )
    );
    expect(loadingHtml).toContain('Chọn Nhạc Lễ Cưới');
    expect(loadingHtml).toContain('Thêm bài hát');
    expect(loadingHtml).toContain('Tất cả khoảnh khắc');

    const emptyHtml = renderToStaticMarkup(
      React.createElement(
        RoleProvider,
        { initialRole: 'owner' },
        React.createElement(
          EventScopeProvider,
          { initialEvents: [] },
          React.createElement(LiveMusicWorkspace)
        )
      )
    );
    expect(emptyHtml).toContain('Chưa có buổi lễ nào');
    expect(emptyHtml).toContain('Mở Cài đặt chung');
  });
});
