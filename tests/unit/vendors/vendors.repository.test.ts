import { describe, it, expect, vi } from 'vitest';
import {
  listVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  addVendorContact,
  listVendorContacts,
  deleteVendorContact,
  VendorNotFoundError,
  VendorHasActiveCostItemsError,
  ContactNotFoundError,
  VersionConflictError,
} from '../../../src/lib/vendors/vendors.repository';
import { vendorDtoSchema } from '../../../src/schemas/vendors';

// -----------------------------------------------------------------------------
// MOCK DATABASE BUILDER
// -----------------------------------------------------------------------------

function createMockTxDb(overrides: {
  selectRows?: any[];
  insertResult?: any[];
  updateResult?: any[];
  deleteResult?: any[];
} = {}) {
  const queryBuilder: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    $dynamic: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => Promise.resolve(overrides.insertResult || overrides.updateResult || [])),
    then: (resolve: (data: any) => void) => Promise.resolve(overrides.selectRows || []).then(resolve),
  };

  return {
    select: vi.fn().mockReturnValue(queryBuilder),
    insert: vi.fn().mockReturnValue(queryBuilder),
    update: vi.fn().mockReturnValue(queryBuilder),
    delete: vi.fn().mockReturnValue(queryBuilder),
    _builder: queryBuilder,
  };
}

describe('Vendors Repository Unit Tests (AT03, AT41, Optimistic Locking, Deletion Safeguard)', () => {
  const sampleVendorRow = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Trung tâm Tiệc cưới White Palace',
    serviceType: 'venue' as const,
    status: 'quoted' as const,
    contactPerson: 'Nguyễn Văn Quản Lý',
    phone: '0901234567',
    email: 'info@whitepalace.vn',
    address: '194 Hoàng Văn Thụ, Phú Nhuận',
    mapUrl: 'https://maps.google.com/?q=whitepalace',
    website: 'https://whitepalace.vn',
    notes: 'Ghi chú mật: Đã thỏa thuận chiết khấu 5% nếu chốt trước tháng 12',
    rating: 5,
    capacity: 600,
    minGuests: 200,
    tablePrice: 6500000n,
    seatsPerTable: 10,
    rentalFee: 20000000n,
    feesInclusive: false,
    prepTime: '07:00',
    endTime: '22:30',
    parkingNotes: 'Hầm giữ xe 500 xe máy, 50 ô tô',
    rainPlan: 'Sảnh trong nhà có máy lạnh',
    decorAudioRules: 'Không dùng pháo kim tuyến',
    extraFeesNotes: 'Phí mang âm thanh ngoài: 5.000.000đ',
    version: 1,
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
  };

  // ---------------------------------------------------------------------------
  // 1. Role Masking (AT03, AT41)
  // ---------------------------------------------------------------------------
  describe('AT03, AT41: Role-Based Masking for Family View', () => {
    it('returns full private notes and extra fees notes when role === "owner"', async () => {
      const mockDb = createMockTxDb({ selectRows: [sampleVendorRow] });

      const vendor = await getVendorById(mockDb as any, sampleVendorRow.id, 'owner');

      expect(() => vendorDtoSchema.parse(vendor)).not.toThrow();
      expect(vendor).not.toBeNull();
      expect(vendor?.notes).toBe('Ghi chú mật: Đã thỏa thuận chiết khấu 5% nếu chốt trước tháng 12');
      expect(vendor?.extra_fees_notes).toBe('Phí mang âm thanh ngoài: 5.000.000đ');
      expect(vendor?.table_price).toBe('6500000');
      expect(vendor?.rental_fee).toBe('20000000');
    });

    it('masks private notes and extra fees notes (returns null) when role === "family_view"', async () => {
      const mockDb = createMockTxDb({ selectRows: [sampleVendorRow] });

      const vendor = await getVendorById(mockDb as any, sampleVendorRow.id, 'family_view');

      expect(() => vendorDtoSchema.parse(vendor)).not.toThrow();
      expect(vendor).not.toBeNull();
      expect(vendor?.notes).toBeNull(); // Masked!
      expect(vendor?.extra_fees_notes).toBeNull(); // Masked!
      // Operational details remain accessible
      expect(vendor?.name).toBe('Trung tâm Tiệc cưới White Palace');
      expect(vendor?.address).toBe('194 Hoàng Văn Thụ, Phú Nhuận');
      expect(vendor?.contact_person).toBe('Nguyễn Văn Quản Lý');
    });

    it('masks private notes in listVendors when role === "family_view"', async () => {
      const mockDb = createMockTxDb({ selectRows: [sampleVendorRow] });

      const vendorsList = await listVendors(mockDb as any, { role: 'family_view' });

      expect(vendorsList).toHaveLength(1);
      expect(vendorsList[0].notes).toBeNull();
      expect(vendorsList[0].extra_fees_notes).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Optimistic Locking (updateVendor)
  // ---------------------------------------------------------------------------
  describe('Optimistic Locking on updateVendor', () => {
    it('successfully updates vendor and increments version when version matches', async () => {
      const updatedRow = {
        ...sampleVendorRow,
        name: 'Trung tâm Tiệc cưới White Palace (Cập nhật)',
        version: 2,
        updatedAt: new Date('2026-11-02T10:00:00.000Z'),
      };

      let queryCount = 0;
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => {
          queryCount++;
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            for: vi.fn().mockImplementation(() => Promise.resolve([sampleVendorRow])),
          };
        }),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockImplementation(() => Promise.resolve([updatedRow])),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation(() => Promise.resolve()),
        })),
      };

      const result = await updateVendor(
        mockDb,
        sampleVendorRow.id,
        {
          name: 'Trung tâm Tiệc cưới White Palace (Cập nhật)',
          version: 1, // matches sampleVendorRow.version
        },
        'user-123'
      );

      expect(result.name).toBe('Trung tâm Tiệc cưới White Palace (Cập nhật)');
      expect(result.version).toBe(2);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled(); // Audit log
    });

    it('throws VersionConflictError (409) when input version does not match existing version', async () => {
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockImplementation(() => Promise.resolve([sampleVendorRow])),
        })),
      };

      await expect(
        updateVendor(
          mockDb,
          sampleVendorRow.id,
          {
            name: 'Attempted Change',
            version: 999, // Stale version!
          },
          'user-123'
        )
      ).rejects.toThrow(VersionConflictError);
    });

    it('throws VendorNotFoundError (404) when updating non-existent vendor', async () => {
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockImplementation(() => Promise.resolve([])),
        })),
      };

      await expect(
        updateVendor(
          mockDb,
          'non-existent-id',
          { version: 1 },
          'user-123'
        )
      ).rejects.toThrow(VendorNotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Deletion Safeguard (deleteVendor)
  // ---------------------------------------------------------------------------
  describe('Safeguard on deleteVendor', () => {
    it('throws VendorHasActiveCostItemsError (400) when active cost items are linked', async () => {
      let selectCount = 0;
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) {
              // Existing vendor found
              return Promise.resolve([sampleVendorRow]);
            }
            // Active cost item found!
            return Promise.resolve([{ id: 'cost-1', status: 'contracted' }]);
          }),
        })),
      };

      await expect(
        deleteVendor(mockDb, sampleVendorRow.id, 'user-123')
      ).rejects.toThrow(VendorHasActiveCostItemsError);
    });

    it('throws VendorHasActiveCostItemsError (400) when a quote is selected', async () => {
      let selectCount = 0;
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) {
              return Promise.resolve([sampleVendorRow]); // vendor exists
            }
            if (selectCount === 2) {
              return Promise.resolve([]); // no cost items
            }
            // Selected quote exists!
            return Promise.resolve([{ id: 'quote-selected-1' }]);
          }),
        })),
      };

      await expect(
        deleteVendor(mockDb, sampleVendorRow.id, 'user-123')
      ).rejects.toThrow(VendorHasActiveCostItemsError);
    });

    it('successfully deletes vendor when no active cost items and no selected quotes exist', async () => {
      let selectCount = 0;
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) return Promise.resolve([sampleVendorRow]);
            return Promise.resolve([]); // 0 cost items, 0 selected quotes
          }),
        })),
        delete: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => Promise.resolve()),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation(() => Promise.resolve()),
        })),
      };

      await expect(
        deleteVendor(mockDb, sampleVendorRow.id, 'user-123')
      ).resolves.not.toThrow();

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled(); // Audit log
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Contact Management
  // ---------------------------------------------------------------------------
  describe('Vendor Contacts Management', () => {
    it('creates a new contact and sets it as primary if requested', async () => {
      const mockContactRow = {
        id: '22222222-2222-4222-8222-222222222222',
        vendorId: sampleVendorRow.id,
        name: 'Trần Thị Sale',
        role: 'Tư vấn tiệc cưới',
        phone: '0987654321',
        email: 'sale@whitepalace.vn',
        isPrimary: true,
        notes: 'Chỉ gọi vào giờ hành chính',
        createdAt: new Date('2026-11-01T10:00:00.000Z'),
        updatedAt: new Date('2026-11-01T10:00:00.000Z'),
      };

      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => Promise.resolve([sampleVendorRow])),
        })),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => Promise.resolve()),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockImplementation(() => Promise.resolve([mockContactRow])),
        })),
      };

      const contact = await addVendorContact(
        mockDb,
        sampleVendorRow.id,
        {
          name: 'Trần Thị Sale',
          role: 'Tư vấn tiệc cưới',
          phone: '0987654321',
          email: 'sale@whitepalace.vn',
          is_primary: true,
          notes: 'Chỉ gọi vào giờ hành chính',
        },
        'user-123'
      );

      expect(contact.name).toBe('Trần Thị Sale');
      expect(contact.is_primary).toBe(true);
      expect(mockDb.update).toHaveBeenCalled(); // Reset existing primaries
    });

    it('throws ContactNotFoundError (404) when deleting non-existent contact', async () => {
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => Promise.resolve([])),
        })),
      };

      await expect(
        deleteVendorContact(mockDb, 'non-existent-contact', 'user-123')
      ).rejects.toThrow(ContactNotFoundError);
    });
  });
});
