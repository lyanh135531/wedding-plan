import { describe, it, expect, beforeEach } from 'vitest';
import { createMockG9TxDb } from '@tests/helpers/g9-mock-db';
import {
  createIdea,
  updateIdea,
  listIdeas,
  getIdeaById,
  deleteIdea,
  previewIdeaPromotion,
  validateSafeUrl,
} from '@/lib/preparation';
import {
  InvalidExternalUrlError,
  InvalidStatusTransitionError,
  OptimisticLockError,
  PreparationItemNotFoundError,
} from '@/lib/preparation/errors';

describe('Gate G9 Preparation Ideas Service (S22 / PLAN §15)', () => {
  let mockDb: any;
  const eventId = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    mockDb = createMockG9TxDb();
  });

  describe('1. CRUD & Status Progression', () => {
    it('creates an idea with color swatches and external link', async () => {
      const created = await createIdea(mockDb, {
        eventId,
        title: 'Trang trí hoa sen trắng',
        category: 'decor',
        status: 'reference',
        externalUrl: 'https://pinterest.com/pin/12345',
        colorSwatches: ['#FFFFFF', '#E0F2FE'],
        notes: 'Chủ đề đám cưới phong cách truyền thống tinh tế',
        isShared: true,
      });

      expect(created.id).toBeDefined();
      expect(created.title).toBe('Trang trí hoa sen trắng');
      expect(created.category).toBe('decor');
      expect(created.status).toBe('reference');
      expect(created.metadata.colorSwatches).toEqual(['#FFFFFF', '#E0F2FE']);
      expect(created.metadata.externalUrl).toBe('https://pinterest.com/pin/12345');
      expect(created.isShared).toBe(true);
      expect(created.version).toBe(1);
    });

    it('updates status from reference -> considering -> decided', async () => {
      const idea = await createIdea(mockDb, {
        eventId,
        title: 'Thiệp cưới dập nổi mạ kim',
        category: 'style',
        status: 'reference',
      });

      const considering = await updateIdea(mockDb, idea.id, {
        status: 'considering',
        version: 1,
      });
      expect(considering.status).toBe('considering');

      const decided = await updateIdea(mockDb, idea.id, {
        status: 'decided',
        version: 2,
      });
      expect(decided.status).toBe('decided');
    });

    it('rejects invalid status transition', async () => {
      const idea = await createIdea(mockDb, {
        eventId,
        title: 'Bàn Gallery ảnh cưới',
        category: 'decor',
        status: 'reference',
      });

      await expect(
        updateIdea(mockDb, idea.id, {
          status: 'invalid_status' as any,
          version: 1,
        })
      ).rejects.toThrow(InvalidStatusTransitionError);
    });

    it('enforces optimistic locking on concurrent updates', async () => {
      const idea = await createIdea(mockDb, {
        eventId,
        title: 'Phong cách tiệc ngoài trời',
        category: 'style',
        status: 'reference',
      });

      // Update with wrong version
      await expect(
        updateIdea(mockDb, idea.id, {
          title: 'Phong cách tiệc hoàng hôn',
          version: 99,
        })
      ).rejects.toThrow(OptimisticLockError);
    });

    it('deletes an idea with optimistic locking check', async () => {
      const idea = await createIdea(mockDb, {
        eventId,
        title: 'Mẫu cổng hoa giả',
        status: 'discarded',
      });

      const res = await deleteIdea(mockDb, idea.id, 1);
      expect(res.success).toBe(true);
      await expect(getIdeaById(mockDb, idea.id)).rejects.toThrow(PreparationItemNotFoundError);
    });
  });

  describe('2. Anti-Duplication & Explicit Promotion Preview (PLAN §15)', () => {
    it('deciding an idea does NOT automatically create a cost item or task', async () => {
      const idea = await createIdea(mockDb, {
        eventId,
        title: 'Thuê ban nhạc Acoustic đón khách',
        category: 'style',
        status: 'reference',
        notes: 'Dự toán 5 triệu',
      });

      await updateIdea(mockDb, idea.id, {
        status: 'decided',
        version: 1,
      });

      // Verify no cost items or tasks were auto-created in store
      expect(mockDb._store.costItems).toHaveLength(0);
    });

    it('provides explicit promotion preview with source link to prevent duplicate entries', async () => {
      const idea = await createIdea(mockDb, {
        eventId,
        title: 'In ấn menu để bàn hoa văn chìm',
        category: 'decor',
        status: 'decided',
        notes: 'Cần duyệt bản in trước ngày 20',
      });

      const preview = await previewIdeaPromotion(mockDb, idea.id);

      expect(preview.ideaId).toBe(idea.id);
      expect(preview.sourceIdeaId).toBe(idea.id);
      expect(preview.proposedTask.title).toContain('In ấn menu để bàn hoa văn chìm');
      expect(preview.proposedCostItem.name).toBe('In ấn menu để bàn hoa văn chìm');
      expect(preview.message).toContain('KHÔNG tự động tạo chi phí hay công việc');
    });
  });

  describe('3. External Link Security & SSRF Prevention (PLAN §15, UI_UX_SPEC §7.8)', () => {
    it('accepts valid public http/https URLs', () => {
      expect(() => validateSafeUrl('https://example.com/ideas/palette')).not.toThrow();
      expect(() => validateSafeUrl('http://wedding-ideas.org/gallery')).not.toThrow();
    });

    it('blocks internal localhost, loopback, and cloud metadata URLs (SSRF guard)', () => {
      expect(() => validateSafeUrl('http://localhost:3000/admin')).toThrow(InvalidExternalUrlError);
      expect(() => validateSafeUrl('http://127.0.0.1:8080/secret')).toThrow(InvalidExternalUrlError);
      expect(() => validateSafeUrl('http://169.254.169.254/latest/meta-data/')).toThrow(
        InvalidExternalUrlError
      );
      expect(() => validateSafeUrl('http://0.0.0.0/')).toThrow(InvalidExternalUrlError);
      expect(() => validateSafeUrl('http://internal-service.local/')).toThrow(
        InvalidExternalUrlError
      );
    });

    it('blocks dangerous non-http protocols (file, javascript, data)', () => {
      expect(() => validateSafeUrl('javascript:alert(1)')).toThrow(InvalidExternalUrlError);
      expect(() => validateSafeUrl('file:///etc/passwd')).toThrow(InvalidExternalUrlError);
    });
  });

  describe('4. Family View Sanitization (AT26)', () => {
    it('hides unshared ideas from family_view role and redacts notes', async () => {
      await createIdea(mockDb, {
        eventId,
        title: 'Ý tưởng bí mật của cô dâu',
        category: 'attire',
        status: 'reference',
        notes: 'Không tiết lộ cho bất kỳ ai trước ngày cưới',
        isShared: false,
      });

      await createIdea(mockDb, {
        eventId,
        title: 'Màu sắc trang phục phù dâu',
        category: 'attire',
        status: 'decided',
        notes: 'Màu hồng phấn pastel nhạt',
        isShared: true,
      });

      const ownerList = await listIdeas(mockDb, eventId, 'owner');
      expect(ownerList).toHaveLength(2);

      const familyList = await listIdeas(mockDb, eventId, 'family_view');
      expect(familyList).toHaveLength(1);
      expect(familyList[0].title).toBe('Màu sắc trang phục phù dâu');
      // Notes in metadata must be sanitized to null
      expect(familyList[0].metadata.notes).toBeNull();
    });
  });
});
