import { describe, it, expect } from 'vitest';
import {
  createMenu,
  getMenuById,
  listMenusByEvent,
  updateMenu,
  deleteMenu,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listMenuItems,
  setGuestMealSelection,
  calculateMealSummary,
  createAndLockCateringSnapshot,
  MenuNotFoundError,
  OptimisticLockError,
} from '@/lib/catering';
import { createMockG8TxDb } from '@tests/helpers/g8-mock-db';

describe('Gate G8 Catering Unit Tests (Menus, Items, Meal Summary & Snapshots)', () => {
  const eventId = '11111111-1111-4111-8111-111111111111';
  const menuId = '22222222-2222-4222-8222-222222222222';
  const guest1Id = '33333333-3333-4333-8333-333333333333';
  const guest2Id = '44444444-4444-4444-8444-444444444444';
  const guest3Id = '55555555-5555-4555-8555-555555555555';
  const guest4Id = '66666666-6666-4666-8666-666666666666';

  describe('1. Menu Repository CRUD & Optimistic Locking', () => {
    it('creates a new catering menu with default values', async () => {
      const txDb = createMockG8TxDb();

      const created = await createMenu(txDb, {
        eventId,
        name: 'Thực đơn Tiệc Cưới VIP',
        mealType: 'banquet',
        description: 'Set menu 8 món cao cấp',
        isActive: true,
      });

      expect(created.name).toBe('Thực đơn Tiệc Cưới VIP');
      expect(created.mealType).toBe('banquet');
      expect(created.isActive).toBe(true);
      expect(created.version).toBe(1);
    });

    it('retrieves menu by ID', async () => {
      const txDb = createMockG8TxDb({
        menus: [
          {
            id: menuId,
            eventId,
            name: 'Menu Tiêu Chuẩn',
            mealType: 'banquet',
            description: null,
            isActive: true,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const menu = await getMenuById(txDb, menuId);
      expect(menu).not.toBeNull();
      expect(menu?.id).toBe(menuId);
      expect(menu?.name).toBe('Menu Tiêu Chuẩn');
    });

    it('lists menus by event', async () => {
      const txDb = createMockG8TxDb({
        menus: [
          {
            id: menuId,
            eventId,
            name: 'Menu Tiêu Chuẩn',
            mealType: 'banquet',
            description: null,
            isActive: true,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const list = await listMenusByEvent(txDb, eventId);
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(menuId);
    });

    it('rejects menu update on stale version (Optimistic Locking AT30)', async () => {
      const txDb = createMockG8TxDb({
        menus: [
          {
            id: menuId,
            eventId,
            name: 'Menu Tiêu Chuẩn',
            mealType: 'banquet',
            description: null,
            isActive: true,
            version: 2, // Current version is 2
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      await expect(
        updateMenu(txDb, menuId, {
          name: 'Menu Đã Cập Nhật',
          version: 1, // Stale version
        })
      ).rejects.toThrow(OptimisticLockError);
    });

    it('deletes menu', async () => {
      const txDb = createMockG8TxDb({
        menus: [
          {
            id: menuId,
            eventId,
            name: 'Menu Xóa',
            mealType: 'buffet',
            isActive: false,
            version: 1,
          },
        ],
      });

      const deleted = await deleteMenu(txDb, menuId);
      expect(deleted).toBe(true);
      expect(txDb._store.menus.length).toBe(0);
    });
  });

  describe('2. Menu Items Repository CRUD', () => {
    it('adds dishes to a menu with dietary flags and course order', async () => {
      const txDb = createMockG8TxDb();

      const item = await addMenuItem(txDb, {
        menuId,
        eventId,
        courseOrder: 1,
        courseType: 'appetizer',
        name: 'Súp Bào Ngư Vi Cá',
        dietaryFlags: ['halal', 'gluten_free'],
        allergens: 'Hải sản',
      });

      expect(item.name).toBe('Súp Bào Ngư Vi Cá');
      expect(item.courseType).toBe('appetizer');
      expect(item.dietaryFlags).toEqual(['halal', 'gluten_free']);
      expect(item.allergens).toBe('Hải sản');
    });

    it('updates and deletes a menu item', async () => {
      const itemId = '33333333-3333-4333-8333-333333333333';
      const txDb = createMockG8TxDb({
        menuItems: [
          {
            id: itemId,
            menuId,
            eventId,
            courseOrder: 2,
            courseType: 'main',
            name: 'Gà Hấp Lá Chanh',
            dietaryFlags: [],
            allergens: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const updated = await updateMenuItem(txDb, itemId, {
        name: 'Gà Quay Mật Ong',
        courseOrder: 3,
      });

      expect(updated.name).toBe('Gà Quay Mật Ong');
      expect(updated.courseOrder).toBe(3);

      const deleted = await deleteMenuItem(txDb, itemId);
      expect(deleted).toBe(true);
      expect(txDb._store.menuItems.length).toBe(0);
    });

    it('lists menu items by menuId', async () => {
      const txDb = createMockG8TxDb({
        menuItems: [
          {
            id: '10000000-0000-4000-8000-000000000001',
            menuId,
            eventId,
            courseOrder: 1,
            courseType: 'appetizer',
            name: 'Gỏi Củ Hũ Dừa',
            dietaryFlags: [],
            allergens: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: '10000000-0000-4000-8000-000000000002',
            menuId,
            eventId,
            courseOrder: 2,
            courseType: 'main',
            name: 'Bò Sốt Tiêu Đen',
            dietaryFlags: [],
            allergens: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const items = await listMenuItems(txDb, menuId);
      expect(items.length).toBe(2);
      expect(items[0].name).toBe('Gỏi Củ Hũ Dừa');
      expect(items[1].name).toBe('Bò Sốt Tiêu Đen');
    });
  });

  describe('3. Guest Meal Selection & Meal Summary Calculation (Exact Integer Math)', () => {
    it('sets guest meal selection and updates tier', async () => {
      const txDb = createMockG8TxDb();

      const selection = await setGuestMealSelection(
        txDb,
        eventId,
        guest1Id,
        'vegetarian',
        'Thuần chay không trứng sữa',
        'Dị ứng đậu phộng'
      );

      expect(selection.mealTier).toBe('vegetarian');
      expect(selection.dietaryNotes).toBe('Thuần chay không trứng sữa');
      expect(selection.allergyNotes).toBe('Dị ứng đậu phộng');

      // Update to different tier
      const updated = await setGuestMealSelection(
        txDb,
        eventId,
        guest1Id,
        'standard',
        null,
        null
      );
      expect(updated.mealTier).toBe('standard');
    });

    it('calculates meal summary against confirmed RSVP guests with 0 float rounding error', async () => {
      // Setup 4 guests:
      // g1: accepted, needs_meal=true, explicit selection = vegetarian
      // g2: accepted, needs_meal=true, explicit selection = child
      // g3: accepted, needs_meal=true, no explicit selection (fallback: adult)
      // g4: declined, needs_meal=false (must NOT be counted)
      const txDb = createMockG8TxDb({
        attendance: [
          { guestId: guest1Id, eventId, rsvpStatus: 'accepted', needsMeal: true },
          { guestId: guest2Id, eventId, rsvpStatus: 'accepted', needsMeal: true },
          { guestId: guest3Id, eventId, rsvpStatus: 'accepted', needsMeal: true },
          { guestId: guest4Id, eventId, rsvpStatus: 'declined', needsMeal: false },
        ],
        guestMealSelections: [
          { id: 'sel-1', eventId, guestId: guest1Id, mealTier: 'vegetarian' },
          { id: 'sel-2', eventId, guestId: guest2Id, mealTier: 'child' },
        ],
        guests: [
          { id: guest1Id, ageTier: 'adult' },
          { id: guest2Id, ageTier: 'child' },
          { id: guest3Id, ageTier: 'adult' },
          { id: guest4Id, ageTier: 'adult' },
        ],
      });

      // bufferPercentage = 10% on 3 confirmed meals => Math.ceil(3 * 0.1) = 1 buffer meal
      const summary = await calculateMealSummary(txDb, eventId, 10);

      expect(summary.confirmedGuestsCount).toBe(3); // g4 excluded
      expect(summary.vegetarianMeals).toBe(1);
      expect(summary.childMeals).toBe(1);
      expect(summary.adultMeals).toBe(1); // g3 fallback
      expect(summary.specialMeals).toBe(0);
      expect(summary.confirmedMeals).toBe(3);
      expect(summary.bufferMeals).toBe(1); // Math.ceil(3 * 0.1) = 1
      expect(summary.totalMeals).toBe(4); // 3 + 1 = 4
      expect(summary.missingMealSelectionCount).toBe(1); // g3 has no explicit selection
    });
  });

  describe('4. Restaurant Catering Snapshot & Locking (PLAN §13.3)', () => {
    it('creates immutable catering snapshot with locked state and incremented version', async () => {
      const txDb = createMockG8TxDb({
        menus: [
          {
            id: menuId,
            eventId,
            name: 'Menu Tiệc Cưới',
            mealType: 'banquet',
            isActive: true,
            version: 1,
          },
        ],
        attendance: [
          { guestId: guest1Id, eventId, rsvpStatus: 'accepted', needsMeal: true },
          { guestId: guest2Id, eventId, rsvpStatus: 'accepted', needsMeal: true },
        ],
        guestMealSelections: [
          { id: 'sel-1', eventId, guestId: guest1Id, mealTier: 'standard' },
          { id: 'sel-2', eventId, guestId: guest2Id, mealTier: 'vegetarian' },
        ],
        guests: [
          { id: guest1Id, ageTier: 'adult' },
          { id: guest2Id, ageTier: 'adult' },
        ],
        cateringSnapshots: [],
      });

      // Create snapshot version 1
      const snapshot1 = await createAndLockCateringSnapshot(
        txDb,
        eventId,
        menuId,
        'user-owner-1',
        5, // 5% buffer
        'Chốt danh sách đợt 1 với nhà hàng White Palace'
      );

      expect(snapshot1.snapshotVersion).toBe(1);
      expect(snapshot1.isLocked).toBe(true);
      expect(snapshot1.lockedBy).toBe('user-owner-1');
      expect(snapshot1.adultMeals).toBe(1);
      expect(snapshot1.vegetarianMeals).toBe(1);
      expect(snapshot1.totalMeals).toBe(3); // 2 confirmed + 1 buffer (Math.ceil(2 * 0.05) = 1)
      expect(snapshot1.notes).toBe('Chốt danh sách đợt 1 với nhà hàng White Palace');

      // Create subsequent snapshot version 2
      const snapshot2 = await createAndLockCateringSnapshot(
        txDb,
        eventId,
        menuId,
        'user-owner-1',
        0,
        'Chốt danh sách đợt 2 sau khi có thêm khách xác nhận'
      );

      expect(snapshot2.snapshotVersion).toBe(2);
      expect(snapshot2.isLocked).toBe(true);
    });
  });
});
