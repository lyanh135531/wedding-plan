import { describe, it, expect, beforeEach } from 'vitest';
import { createMockG9TxDb } from '@tests/helpers/g9-mock-db';
import {
  createSupportAssignment,
  updateSupportAssignment,
  listSupportAssignments,
  getSupportAssignmentDetails,
  deleteSupportAssignment,
} from '@/lib/support';
import {
  OptimisticLockError,
  SupportAssignmentNotFoundError,
} from '@/lib/support/errors';

describe('Gate G9 Wedding Party Directory Service (S24 / PLAN §14.2)', () => {
  let mockDb: any;
  const eventId = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    mockDb = createMockG9TxDb();
  });

  describe('1. CRUD & Multi-Role Assignments', () => {
    it('creates support member with roles, arrival time, backup, and attire notes', async () => {
      const member = await createSupportAssignment(mockDb, {
        eventId,
        name: 'Trần Thị Thu Thảo',
        phone: '0901234567',
        roles: ['phu_dau', 'dieu_phoi'],
        arrivalTime: '07:00',
        backupName: 'Lê Hoàng Nam',
        backupPhone: '0912345678',
        attireNotes: 'Áo dài màu hồng phấn lụa tơ tằm',
        duties: 'Đón tiếp đại diện nhà gái và hỗ trợ trao quả cưới',
        assignedTaskIds: ['10000000-0000-4000-8000-000000000001'],
        assignedItemIds: ['20000000-0000-4000-8000-000000000001'],
        isShared: true,
      });

      expect(member.id).toBeDefined();
      expect(member.name).toBe('Trần Thị Thu Thảo');
      expect(member.phone).toBe('0901234567');
      expect(member.roles).toEqual(['phu_dau', 'dieu_phoi']);
      expect(member.arrivalTime).toBe('07:00');
      expect(member.backupName).toBe('Lê Hoàng Nam');
      expect(member.backupPhone).toBe('0912345678');
      expect(member.attireNotes).toBe('Áo dài màu hồng phấn lụa tơ tằm');
      expect(member.duties).toContain('Đón tiếp đại diện nhà gái');
      expect(member.assignedTaskIds).toEqual(['10000000-0000-4000-8000-000000000001']);
      expect(member.isShared).toBe(true);
      expect(member.version).toBe(1);
    });

    it('updates support member details with optimistic locking', async () => {
      const member = await createSupportAssignment(mockDb, {
        eventId,
        name: 'Nguyễn Văn Minh (MC)',
        phone: '0987654321',
        roles: ['mc'],
      });

      const updated = await updateSupportAssignment(mockDb, member.id, {
        arrivalTime: '10:30',
        duties: 'Dẫn chương trình nghi lễ và khai tiệc',
        version: 1,
      });

      expect(updated.arrivalTime).toBe('10:30');
      expect(updated.duties).toBe('Dẫn chương trình nghi lễ và khai tiệc');
      expect(updated.version).toBe(2);

      // Concurrent update rejection
      await expect(
        updateSupportAssignment(mockDb, member.id, {
          arrivalTime: '11:00',
          version: 1,
        })
      ).rejects.toThrow(OptimisticLockError);
    });

    it('deletes support member with version check', async () => {
      const member = await createSupportAssignment(mockDb, {
        eventId,
        name: 'Người hỗ trợ dự bị',
        phone: '0933112233',
        roles: ['khac'],
      });

      const res = await deleteSupportAssignment(mockDb, member.id, 1);
      expect(res.success).toBe(true);
      await expect(getSupportAssignmentDetails(mockDb, member.id)).rejects.toThrow(
        SupportAssignmentNotFoundError
      );
    });
  });

  describe('2. Invariant: Zero Account Creation (PLAN §14.2)', () => {
    it('INVARIANT: creating support member NEVER touches users or accounts tables', async () => {
      // Record initial state of any user store
      const initialUsersCount = (mockDb._store as any).users?.length || 0;

      await createSupportAssignment(mockDb, {
        eventId,
        name: 'Hoàng Quốc Tuấn',
        phone: '0908889999',
        roles: ['phu_re', 'dieu_phoi'],
        arrivalTime: '06:00',
      });

      // Assert no user accounts were created
      const currentUsersCount = (mockDb._store as any).users?.length || 0;
      expect(currentUsersCount).toBe(initialUsersCount);
    });
  });

  describe('3. Family View Sanitization (AT26)', () => {
    it('hides unshared members from family_view and redacts attireNotes to null', async () => {
      await createSupportAssignment(mockDb, {
        eventId,
        name: 'Điều phối viên nội bộ (Planner)',
        phone: '0909998877',
        roles: ['dieu_phoi'],
        attireNotes: 'Đeo bộ đàm kênh 3, mang vest đen đồng phục',
        isShared: false, // Internal only
      });

      await createSupportAssignment(mockDb, {
        eventId,
        name: 'Phù rể Trưởng (Anh Tuấn)',
        phone: '0901112233',
        roles: ['phu_re'],
        attireNotes: 'Vest xanh navy cà vạt đỏ',
        isShared: true, // Shared with family
      });

      const ownerList = await listSupportAssignments(mockDb, eventId, 'owner');
      expect(ownerList).toHaveLength(2);

      const familyList = await listSupportAssignments(mockDb, eventId, 'family_view');
      expect(familyList).toHaveLength(1);
      expect(familyList[0].name).toBe('Phù rể Trưởng (Anh Tuấn)');
      // Invariant AT26: private attireNotes must be redacted to null
      expect(familyList[0].attireNotes).toBeNull();
    });
  });
});
