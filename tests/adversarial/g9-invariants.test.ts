import { describe, it, expect, beforeEach } from 'vitest';
import { createMockG9TxDb } from '@tests/helpers/g9-mock-db';
import {
  createSupportAssignment,
  updateSupportAssignment,
  listSupportAssignments,
} from '@/lib/support';
import {
  createIdea,
  updateIdea,
  createPreparationItem,
  updatePreparationItem,
  recordShotListHandover,
  createPhotoShot,
  createMusicTrack,
  validateSafeUrl,
  previewIdeaPromotion,
} from '@/lib/preparation';
import {
  InvalidExternalUrlError,
  RentalDueDateRequiredError,
  ImmutableHandoverError,
} from '@/lib/preparation/errors';

describe('EMPIRICAL ADVERSARIAL: Gate G9 System Invariants (PLAN §14.2, §15, §24 / AT03, AT26)', () => {
  let mockDb: any;
  const eventId = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    mockDb = createMockG9TxDb();
  });

  describe('INVARIANT 1: Zero User Account Creation & Zero Privilege Escalation (PLAN §14.2)', () => {
    it('adversarial payload with injected auth fields never creates user accounts or grants db rights', async () => {
      // Adversarial attempt trying to inject user account fields into support assignment
      const maliciousPayload: any = {
        eventId,
        name: 'Kẻ giả mạo quyền quản trị',
        phone: '0912345678',
        roles: ['dieu_phoi'],
        email: 'admin_backdoor@wedding.local',
        password: 'HackedPassword123!',
        role: 'owner',
        isAdmin: true,
        createAccount: true,
      };

      const member = await createSupportAssignment(mockDb, maliciousPayload);

      // Verify support member was recorded as support assignment ONLY
      expect(member.id).toBeDefined();

      // Assert that users and accounts stores remain completely untouched
      expect((mockDb._store as any).users || []).toHaveLength(0);
      expect((mockDb._store as any).accounts || []).toHaveLength(0);
      expect((mockDb._store as any).sessions || []).toHaveLength(0);

      // Assert no privileges leaked into support_assignments table
      expect((member as any).isAdmin).toBeUndefined();
      expect((member as any).role).toBeUndefined();
      expect((member as any).password).toBeUndefined();
    });
  });

  describe('INVARIANT 2: Family View Read-Only & Sensitive Data Redaction (AT03, AT26)', () => {
    it('strictly prevents family_view from reading unshared items and redacts private notes to null', async () => {
      // 1. Unshared idea with private notes
      await createIdea(mockDb, {
        eventId,
        title: 'Bí mật gia đình 1',
        category: 'decor',
        notes: 'Ghi chú tài chính và gia đình riêng tư',
        isShared: false,
      });

      // 2. Shared idea with private notes
      await createIdea(mockDb, {
        eventId,
        title: 'Ý tưởng trang trí công khai',
        category: 'decor',
        notes: 'Ghi chú thảo luận nội bộ',
        isShared: true,
      });

      // 3. Unshared support member
      await createSupportAssignment(mockDb, {
        eventId,
        name: 'Người thân mang trang sức quý',
        phone: '0901112233',
        roles: ['nguoi_than'],
        attireNotes: 'Giữ hộp kim cương 100 triệu',
        isShared: false,
      });

      // 4. Shared support member with attire notes
      await createSupportAssignment(mockDb, {
        eventId,
        name: 'Phù dâu Linh',
        phone: '0902223344',
        roles: ['phu_dau'],
        attireNotes: 'Áo dài lụa hồng, nhận tại nhà cô dâu lúc 6h',
        isShared: true,
      });

      // Query as family_view
      const familySupport = await listSupportAssignments(mockDb, eventId, 'family_view');
      expect(familySupport).toHaveLength(1);
      expect(familySupport[0].name).toBe('Phù dâu Linh');
      // Invariant: attireNotes must be null in family view
      expect(familySupport[0].attireNotes).toBeNull();
    });
  });

  describe('INVARIANT 3: External Media URL Boundary & SSRF Prevention (PLAN §15, UI_UX_SPEC §7.8)', () => {
    it('strictly rejects local network, loopback, and cloud metadata endpoints', () => {
      const maliciousUrls = [
        'http://localhost:3000/internal-api',
        'http://127.0.0.1:5432/db-status',
        'http://169.254.169.254/latest/user-data',
        'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
        'http://0.0.0.0:80',
        'http://metadata.google.internal/computeMetadata/v1/',
        'ftp://internal.ftp.server/file',
        'javascript:eval(document.cookie)',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'file:///etc/shadow',
      ];

      for (const url of maliciousUrls) {
        expect(() => validateSafeUrl(url)).toThrow(InvalidExternalUrlError);
      }
    });
  });

  describe('INVARIANT 4: Rental Item Due Date Enforcement (PLAN §15)', () => {
    it('refuses to persist or convert an item to rental without explicit valid return deadline', async () => {
      // Creation without returnDueDate
      await expect(
        createPreparationItem(mockDb, {
          eventId,
          title: 'Khung rạp cưới lớn',
          isRental: true,
        })
      ).rejects.toThrow(RentalDueDateRequiredError);

      // Conversion without returnDueDate
      const owned = await createPreparationItem(mockDb, {
        eventId,
        title: 'Bàn ghế inox',
        isRental: false,
      });

      await expect(
        updatePreparationItem(mockDb, owned.id, {
          isRental: true,
          returnDueDate: null,
          version: 1,
        })
      ).rejects.toThrow(RentalDueDateRequiredError);
    });
  });

  describe('INVARIANT 5: Immutability of Handover Timestamps (PLAN §15)', () => {
    it('strictly forbids erasing or modifying manual handover timestamp once set', async () => {
      const shot = await createPhotoShot(mockDb, {
        eventId,
        title: 'Trao nhẫn cưới và hôn lễ',
        priority: 'must_have',
      });

      // Legitimate handover
      const initialTimestamp = '2026-11-16T09:00:00.000Z';
      await recordShotListHandover(mockDb, shot.id, {
        handedOverAt: initialTimestamp,
        recipient: 'Ekip Trưởng Hải',
        channel: 'direct_handover',
      });

      // Adversarial attempt to rewrite or reset handover timestamp
      await expect(
        recordShotListHandover(mockDb, shot.id, {
          handedOverAt: '2026-11-16T12:00:00.000Z',
          recipient: 'Người lạ',
        })
      ).rejects.toThrow(ImmutableHandoverError);
    });
  });

  describe('INVARIANT 6: Deciding Idea Does NOT Auto-Create Costs or Tasks (PLAN §15)', () => {
    it('verifies that transitioning an idea status to "decided" produces zero side-effect records', async () => {
      const idea = await createIdea(mockDb, {
        eventId,
        title: 'Thuê xe mui trần cổ rước dâu',
        category: 'style',
        status: 'considering',
      });

      // Update to decided
      await updateIdea(mockDb, idea.id, {
        status: 'decided',
        version: 1,
      });

      // Assert no tasks or cost items were generated
      expect(mockDb._store.costItems).toHaveLength(0);
      expect(mockDb._store.supportAssignments).toHaveLength(0);

      // Preview function exists and is explicit
      const preview = await previewIdeaPromotion(mockDb, idea.id);
      expect(preview.sourceIdeaId).toBe(idea.id);
      expect(preview.proposedCostItem.name).toBe('Thuê xe mui trần cổ rước dâu');
    });
  });
});
