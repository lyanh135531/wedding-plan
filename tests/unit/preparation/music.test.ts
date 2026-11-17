import { describe, it, expect, beforeEach } from 'vitest';
import { createMockG9TxDb } from '@tests/helpers/g9-mock-db';
import {
  createMusicTrack,
  updateMusicTrack,
  listMusicTracks,
  getMusicTrackById,
  deleteMusicTrack,
  reorderPlaylist,
} from '@/lib/preparation';
import {
  InvalidExternalUrlError,
  OptimisticLockError,
  PreparationItemNotFoundError,
} from '@/lib/preparation/errors';

describe('Gate G9 Preparation Music Playlist Service (S23 Tab 2 / PLAN §15)', () => {
  let mockDb: any;
  const eventId = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    mockDb = createMockG9TxDb();
  });

  describe('1. Music Track CRUD & Ceremony Moments', () => {
    it('creates a track assigned to entrance ceremony moment with cue timing notes', async () => {
      const track = await createMusicTrack(mockDb, {
        eventId,
        title: 'Ánh Nắng Của Anh',
        artist: 'Đức Phúc',
        moment: 'entrance',
        externalUrl: 'https://spotify.com/track/12345',
        durationSeconds: 245,
        cueNotes: 'Bắt đầu phát khi cô dâu bước vào cửa sảnh, điệp khúc khi chú rể đón tay',
        isBlacklisted: false,
        trackOrder: 1,
        isShared: true,
      });

      expect(track.id).toBeDefined();
      expect(track.title).toBe('Ánh Nắng Của Anh');
      expect(track.category).toBe('entrance');
      expect(track.metadata.artist).toBe('Đức Phúc');
      expect(track.metadata.cueNotes).toContain('Bắt đầu phát khi cô dâu bước vào cửa sảnh');
      expect(track.metadata.durationSeconds).toBe(245);
      expect(track.isBlacklisted).toBe(false);
      expect(track.version).toBe(1);
    });

    it('creates a track with "Do Not Play" blacklist flag', async () => {
      const track = await createMusicTrack(mockDb, {
        eventId,
        title: 'Đắp Mộ Cuộc Tình',
        artist: 'Nhiều ca sĩ',
        moment: 'send_off',
        isBlacklisted: true,
        cueNotes: 'Cấm phát trong mọi hoàn cảnh của đám cưới',
      });

      expect(track.isBlacklisted).toBe(true);
      expect(track.metadata.cueNotes).toContain('Cấm phát');
    });

    it('updates track details with optimistic locking', async () => {
      const track = await createMusicTrack(mockDb, {
        eventId,
        title: 'Until I Found You',
        artist: 'Stephen Sanchez',
        moment: 'first_dance',
      });

      const updated = await updateMusicTrack(mockDb, track.id, {
        cueNotes: 'Hạ bớt đèn sảnh, bật pháo kim tuyến lúc 2:15',
        version: 1,
      });

      expect(updated.metadata.cueNotes).toBe('Hạ bớt đèn sảnh, bật pháo kim tuyến lúc 2:15');
      expect(updated.version).toBe(2);

      // Concurrent update with stale version
      await expect(
        updateMusicTrack(mockDb, track.id, {
          title: 'Different Title',
          version: 1,
        })
      ).rejects.toThrow(OptimisticLockError);
    });

    it('deletes track with version check', async () => {
      const track = await createMusicTrack(mockDb, {
        eventId,
        title: 'Bài hát nháp',
        moment: 'guest_arrival',
      });

      const res = await deleteMusicTrack(mockDb, track.id, 1);
      expect(res.success).toBe(true);
      await expect(getMusicTrackById(mockDb, track.id)).rejects.toThrow(
        PreparationItemNotFoundError
      );
    });
  });

  describe('2. Playlist Reordering & External Links', () => {
    it('reorders playlist tracks and updates trackOrder indices', async () => {
      const track1 = await createMusicTrack(mockDb, {
        eventId,
        title: 'Bài 1: Đón khách 1',
        moment: 'guest_arrival',
        trackOrder: 0,
      });
      const track2 = await createMusicTrack(mockDb, {
        eventId,
        title: 'Bài 2: Đón khách 2',
        moment: 'guest_arrival',
        trackOrder: 1,
      });
      const track3 = await createMusicTrack(mockDb, {
        eventId,
        title: 'Bài 3: Đón khách 3',
        moment: 'guest_arrival',
        trackOrder: 2,
      });

      // Reverse order: track3 -> track1 -> track2
      const reordered = await reorderPlaylist(mockDb, eventId, [track3.id, track1.id, track2.id]);

      expect(reordered).toHaveLength(3);
      expect(reordered[0].id).toBe(track3.id);
      expect(reordered[0].metadata.trackOrder).toBe(0);
      expect(reordered[1].id).toBe(track1.id);
      expect(reordered[1].metadata.trackOrder).toBe(1);
      expect(reordered[2].id).toBe(track2.id);
      expect(reordered[2].metadata.trackOrder).toBe(2);
    });

    it('blocks SSRF and invalid URLs in music track links', async () => {
      await expect(
        createMusicTrack(mockDb, {
          eventId,
          title: 'Nhạc Test',
          moment: 'toast',
          externalUrl: 'http://169.254.169.254/latest/meta-data',
        })
      ).rejects.toThrow(InvalidExternalUrlError);
    });
  });
});
