import { describe, it, expect, beforeEach } from 'vitest';
import { createMockG9TxDb } from '@tests/helpers/g9-mock-db';
import {
  createPhotoShot,
  updatePhotoShot,
  listPhotoShots,
  getPhotoShotById,
  deletePhotoShot,
  recordShotListHandover,
} from '@/lib/preparation';
import {
  ImmutableHandoverError,
  OptimisticLockError,
  PreparationItemNotFoundError,
} from '@/lib/preparation/errors';

describe('Gate G9 Preparation Photo Shot List Service (S23 Tab 3 / PLAN §15)', () => {
  let mockDb: any;
  const eventId = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    mockDb = createMockG9TxDb();
  });

  describe('1. CRUD & Priority Management', () => {
    it('creates a shot list item with subject groups and gathering lead', async () => {
      const shot = await createPhotoShot(mockDb, {
        eventId,
        title: 'Chụp hình cô dâu chú rể cùng bố mẹ hai bên trên sân khấu',
        subjectGroup: 'Gia đình nội ngoại',
        sessionName: 'Nghi lễ chính',
        timeLocation: '11:45 tại Sân khấu chính',
        priority: 'must_have',
        gatheringLead: 'Chú Tư (Bác của chú rể)',
        notes: 'Chụp ngay sau khi kết thúc rót rượu giao bôi',
        isShared: true,
      });

      expect(shot.id).toBeDefined();
      expect(shot.title).toContain('bố mẹ hai bên');
      expect(shot.priority).toBe('must_have');
      expect(shot.metadata.subjectGroup).toBe('Gia đình nội ngoại');
      expect(shot.metadata.gatheringLead).toBe('Chú Tư (Bác của chú rể)');
      expect(shot.metadata.isExecuted).toBe(false);
      expect(shot.status).toBe('pending');
      expect(shot.handedOverAt).toBeNull();
    });

    it('marks a shot as executed and updates status to completed', async () => {
      const shot = await createPhotoShot(mockDb, {
        eventId,
        title: 'Cô dâu chụp cùng hội bạn thân cấp 3',
        priority: 'nice_to_have',
      });

      const updated = await updatePhotoShot(mockDb, shot.id, {
        isExecuted: true,
        version: 1,
      });

      expect(updated.status).toBe('completed');
      expect(updated.metadata.isExecuted).toBe(true);
      expect(updated.version).toBe(2);
    });

    it('enforces optimistic locking on updates', async () => {
      const shot = await createPhotoShot(mockDb, {
        eventId,
        title: 'Chụp ảnh sảnh đón khách',
      });

      await expect(
        updatePhotoShot(mockDb, shot.id, {
          title: 'Chụp ảnh sảnh hoa',
          version: 99,
        })
      ).rejects.toThrow(OptimisticLockError);
    });

    it('deletes a shot with optimistic lock check', async () => {
      const shot = await createPhotoShot(mockDb, {
        eventId,
        title: 'Cảnh chụp hủy bỏ',
      });

      const res = await deletePhotoShot(mockDb, shot.id, 1);
      expect(res.success).toBe(true);
      await expect(getPhotoShotById(mockDb, shot.id)).rejects.toThrow(
        PreparationItemNotFoundError
      );
    });
  });

  describe('2. Manual Handover & Immutability Invariant (PLAN §15)', () => {
    it('records manual handover timestamp to photographer ekip', async () => {
      const shot = await createPhotoShot(mockDb, {
        eventId,
        title: 'Chụp toàn cảnh sảnh tiệc trước giờ G',
        priority: 'must_have',
      });

      const handoverTime = '2026-11-16T08:00:00.000Z';
      const res = await recordShotListHandover(mockDb, shot.id, {
        handedOverAt: handoverTime,
        recipient: 'Anh Hải (Trưởng ekip chụp ảnh Studio)',
        channel: 'direct_handover',
        notes: 'Đã in bản giấy và gửi Zalo file PDF',
      });

      expect(res.success).toBe(true);
      expect(res.handedOverAt).toBe(handoverTime);
      expect(res.recipient).toBe('Anh Hải (Trưởng ekip chụp ảnh Studio)');

      const updated = await getPhotoShotById(mockDb, shot.id);
      expect(updated.handedOverAt).toBe(handoverTime);
    });

    it('INVARIANT: rejects modifying or rewriting handover timestamp once recorded (Immutable)', async () => {
      const shot = await createPhotoShot(mockDb, {
        eventId,
        title: 'Trao nhẫn cưới cận cảnh',
        priority: 'must_have',
      });

      // First handover succeeds
      await recordShotListHandover(mockDb, shot.id, {
        handedOverAt: '2026-11-16T08:30:00Z',
        recipient: 'Ekip Nhiếp Ảnh',
      });

      // Attempting second handover or overwrite MUST fail (PLAN §15)
      await expect(
        recordShotListHandover(mockDb, shot.id, {
          handedOverAt: '2026-11-16T10:00:00Z',
          recipient: 'Người khác',
        })
      ).rejects.toThrow(ImmutableHandoverError);
    });
  });
});
