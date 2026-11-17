import { describe, it, expect, beforeEach } from 'vitest';
import { createMockG9TxDb } from '@tests/helpers/g9-mock-db';
import {
  createPreparationItem,
  updatePreparationItem,
  listPreparationItems,
  getPreparationItemDetails,
  deletePreparationItem,
  getRentalReturnReminders,
} from '@/lib/preparation';
import {
  RentalDueDateRequiredError,
  InvalidStatusTransitionError,
  OptimisticLockError,
  PreparationItemNotFoundError,
} from '@/lib/preparation/errors';

describe('Gate G9 Preparation Items & Checklist Service (S23 Tab 1 / PLAN §15)', () => {
  let mockDb: any;
  const eventId = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    mockDb = createMockG9TxDb();
  });

  describe('1. CRUD & Status Progression', () => {
    it('creates a preparation item with positive quantity and keeper', async () => {
      const item = await createPreparationItem(mockDb, {
        eventId,
        title: 'Khay trầu cau và rượu lễ',
        category: 'ceremony',
        status: 'not_prepared',
        priority: 'high',
        quantity: 2,
        keeper: 'Bác Tư (Đại diện đàng trai)',
        location: 'Nhà chú rể',
        bringTime: '06:30',
        isRental: false,
        notes: 'Chuẩn bị trước 1 ngày',
        isShared: true,
      });

      expect(item.id).toBeDefined();
      expect(item.title).toBe('Khay trầu cau và rượu lễ');
      expect(item.status).toBe('not_prepared');
      expect(item.priority).toBe('high');
      expect(item.metadata.quantity).toBe(2);
      expect(item.metadata.keeper).toBe('Bác Tư (Đại diện đàng trai)');
      expect(item.isRental).toBe(false);
      expect(item.version).toBe(1);
    });

    it('progresses item status: not_prepared -> packed -> brought -> returned', async () => {
      const item = await createPreparationItem(mockDb, {
        eventId,
        title: 'Bộ ấm chén pha trà gia tiên',
        status: 'not_prepared',
      });

      const packed = await updatePreparationItem(mockDb, item.id, {
        status: 'packed',
        version: 1,
      });
      expect(packed.status).toBe('packed');

      const brought = await updatePreparationItem(mockDb, item.id, {
        status: 'brought',
        version: 2,
      });
      expect(brought.status).toBe('brought');

      const returned = await updatePreparationItem(mockDb, item.id, {
        status: 'returned',
        version: 3,
      });
      expect(returned.status).toBe('returned');
    });

    it('rejects invalid item status transitions', async () => {
      const item = await createPreparationItem(mockDb, {
        eventId,
        title: 'Nến long phụng',
        status: 'not_prepared',
      });

      await expect(
        updatePreparationItem(mockDb, item.id, {
          status: 'unknown_status' as any,
          version: 1,
        })
      ).rejects.toThrow(InvalidStatusTransitionError);
    });

    it('enforces optimistic locking on item update', async () => {
      const item = await createPreparationItem(mockDb, {
        eventId,
        title: 'Hộp nhẫn cưới',
        status: 'not_prepared',
      });

      await expect(
        updatePreparationItem(mockDb, item.id, {
          title: 'Hộp nhẫn cưới và trang sức',
          version: 99,
        })
      ).rejects.toThrow(OptimisticLockError);
    });

    it('deletes item with version check', async () => {
      const item = await createPreparationItem(mockDb, {
        eventId,
        title: 'Dây pháo giấy thừa',
        status: 'not_prepared',
      });

      const res = await deletePreparationItem(mockDb, item.id, 1);
      expect(res.success).toBe(true);
      await expect(getPreparationItemDetails(mockDb, item.id)).rejects.toThrow(
        PreparationItemNotFoundError
      );
    });
  });

  describe('2. Rental Item Deadline & Agenda Reminders (PLAN §15)', () => {
    it('requires returnDueDate when isRental is true at creation', async () => {
      await expect(
        createPreparationItem(mockDb, {
          eventId,
          title: 'Váy cưới công chúa dạ tiệc',
          isRental: true,
          // returnDueDate missing or empty
        })
      ).rejects.toThrow(RentalDueDateRequiredError);
    });

    it('creates a rental item when valid returnDueDate is provided', async () => {
      const returnDate = '2026-12-05T18:00:00Z';
      const item = await createPreparationItem(mockDb, {
        eventId,
        title: 'Bộ Vest chú rể cao cấp',
        isRental: true,
        returnDueDate: returnDate,
        keeper: 'Phù rể Tuấn',
      });

      expect(item.isRental).toBe(true);
      expect(item.returnDueDate).toBeDefined();
    });

    it('requires returnDueDate when updating an item to isRental = true', async () => {
      const item = await createPreparationItem(mockDb, {
        eventId,
        title: 'Bộ micro không dây biểu diễn',
        isRental: false,
      });

      await expect(
        updatePreparationItem(mockDb, item.id, {
          isRental: true,
          returnDueDate: null,
          version: 1,
        })
      ).rejects.toThrow(RentalDueDateRequiredError);
    });

    it('generates rental return reminders with overdue detection', async () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      await createPreparationItem(mockDb, {
        eventId,
        title: 'Áo dài rước dâu',
        isRental: true,
        returnDueDate: futureDate,
        status: 'brought',
      });

      await createPreparationItem(mockDb, {
        eventId,
        title: 'Đèn chiếu spotlight',
        isRental: true,
        returnDueDate: pastDate,
        status: 'packed', // Not yet returned and past due!
      });

      await createPreparationItem(mockDb, {
        eventId,
        title: 'Khung backdrop hoa lụa',
        isRental: true,
        returnDueDate: pastDate,
        status: 'returned', // Past due date but already returned!
      });

      const reminders = await getRentalReturnReminders(mockDb, eventId);
      expect(reminders).toHaveLength(3);

      const overdueSpotlight = reminders.find((r) => r.title === 'Đèn chiếu spotlight');
      expect(overdueSpotlight).toBeDefined();
      expect(overdueSpotlight!.isOverdue).toBe(true);

      const returnedBackdrop = reminders.find((r) => r.title === 'Khung backdrop hoa lụa');
      expect(returnedBackdrop).toBeDefined();
      expect(returnedBackdrop!.isOverdue).toBe(false);

      const futureAoDai = reminders.find((r) => r.title === 'Áo dài rước dâu');
      expect(futureAoDai).toBeDefined();
      expect(futureAoDai!.isOverdue).toBe(false);
      expect(futureAoDai!.daysRemaining).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Family View Sanitization (AT26)', () => {
    it('filters out non-shared preparation items and hides private notes from family_view', async () => {
      await createPreparationItem(mockDb, {
        eventId,
        title: 'Bộ trang sức vàng gia bảo trao dâu',
        notes: 'Cất trong két sắt phòng mẹ chú rể, mật khẩu riêng',
        isShared: false,
      });

      await createPreparationItem(mockDb, {
        eventId,
        title: 'Hoa cài áo hai họ',
        notes: 'Mỗi họ 10 bông hoa tươi',
        isShared: true,
      });

      const ownerItems = await listPreparationItems(mockDb, eventId, 'owner');
      expect(ownerItems).toHaveLength(2);

      const familyItems = await listPreparationItems(mockDb, eventId, 'family_view');
      expect(familyItems).toHaveLength(1);
      expect(familyItems[0].title).toBe('Hoa cài áo hai họ');
      expect(familyItems[0].metadata.notes).toBeNull();
    });
  });
});
