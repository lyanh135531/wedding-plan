import { describe, it, expect, vi } from 'vitest';
import {
  evaluateDuplicatePair,
  findDuplicateCandidates,
  CandidateGuestInput,
  normalizeVietnamesePhone,
} from '@/lib/guests/search';
import { mergeGuestsSchema } from '@/schemas/guests';
import { mergeGuests } from '@/lib/guests/merge.service';

describe('AT09: Duplicate Candidate Detection & Profile Merge', () => {
  describe('1. Duplicate Candidate Evaluation & Scoring', () => {
    it('flags exact normalized name and identical phone number as high confidence duplicate (0.95)', () => {
      const g1: CandidateGuestInput = {
        id: '00000000-0000-4000-8000-000000000001',
        displayName: 'Nguyễn Văn Tuấn',
        phone: '0912345678',
      };
      const g2: CandidateGuestInput = {
        id: '00000000-0000-4000-8000-000000000002',
        displayName: 'nguyen van tuan',
        phone: '+84 912 345 678',
      };

      const result = evaluateDuplicatePair(g1, g2);

      expect(result.isCandidate).toBe(true);
      expect(result.similarityScore).toBe(0.95);
      expect(result.matchReasons).toContain('Trùng tên chuẩn hóa và số điện thoại');
    });

    it('flags high name similarity and identical phone number as candidate duplicate (0.85)', () => {
      const g1: CandidateGuestInput = {
        id: '00000000-0000-4000-8000-000000000001',
        displayName: 'Nguyễn Tuấn',
        phone: '0912345678',
      };
      const g2: CandidateGuestInput = {
        id: '00000000-0000-4000-8000-000000000002',
        displayName: 'Nguyễn Văn Tuấn',
        phone: '0912345678',
      };

      const result = evaluateDuplicatePair(g1, g2);

      expect(result.isCandidate).toBe(true);
      expect(result.similarityScore).toBe(0.85);
      expect(result.matchReasons).toContain('Tên tương đồng cao và trùng số điện thoại');
    });

    it('flags identical name and group when contact info is absent (0.85)', () => {
      const g1: CandidateGuestInput = {
        id: '00000000-0000-4000-8000-000000000001',
        displayName: 'Bác Ba',
        groupId: 'group_family',
        phone: null,
      };
      const g2: CandidateGuestInput = {
        id: '00000000-0000-4000-8000-000000000002',
        displayName: 'bác ba',
        groupId: 'group_family',
        phone: null,
      };

      const result = evaluateDuplicatePair(g1, g2);

      expect(result.isCandidate).toBe(true);
      expect(result.similarityScore).toBe(0.85);
      expect(result.matchReasons).toContain('Trùng tên chuẩn hóa và cùng nhóm quan hệ');
    });

    it('finds and sorts duplicate candidate pairs in a guest list', () => {
      const guestList: CandidateGuestInput[] = [
        { id: '1', displayName: 'Nguyễn Tuấn', phone: '0912345678' },
        { id: '2', displayName: 'Nguyễn Văn Tuấn', phone: '0912345678' },
        { id: '3', displayName: 'Lê Thị Mai', phone: '0988776655' },
        { id: '4', displayName: 'Lê Thị Mai', phone: '0988776655' }, // Exact match
        { id: '5', displayName: 'Hoàng Long', phone: '0933221100', isArchived: true }, // Archived
      ];

      const candidates = findDuplicateCandidates(guestList);

      // Must find candidate pairs and exclude archived
      expect(candidates.length).toBeGreaterThanOrEqual(2);
      // Top candidate is the exact match (0.95)
      expect(candidates[0].similarityScore).toBe(0.95);
      // No archived guest included
      for (const c of candidates) {
        expect(c.guestA.id).not.toBe('5');
        expect(c.guestB.id).not.toBe('5');
      }
    });
  });

  describe('2. Merge Profile Input Validation & Invariants', () => {
    const idA = '10000000-0000-4000-8000-000000000001';
    const idB = '10000000-0000-4000-8000-000000000002';

    it('prohibits merging a guest profile into itself', () => {
      const selfMerge = mergeGuestsSchema.safeParse({
        retained_guest_id: idA,
        merged_guest_id: idA, // Same ID
      });

      expect(selfMerge.success).toBe(false);
      if (!selfMerge.success) {
        expect(selfMerge.error.issues[0].message).toContain('hai người khác nhau');
      }
    });

    it('validates successful merge input with scalar resolution and attendance resolution', () => {
      const validMerge = mergeGuestsSchema.safeParse({
        retained_guest_id: idA,
        merged_guest_id: idB,
        resolved_phone: '0901234567',
        resolved_email: 'resolved@example.com',
        resolved_address: '12 Võ Văn Tần, Q3',
        attendance_conflict_resolutions: [
          {
            event_id: 'e0000000-0000-4000-8000-000000000001',
            chosen_rsvp_status: 'accepted',
            needs_seat: true,
            needs_meal: true,
            meal_dietary_tier: 'regular',
          },
        ],
      });

      expect(validMerge.success).toBe(true);
    });

    it('validates resolved phone during merge validation and canonicalizes via domain logic', () => {
      const mergeWithIntlPhone = mergeGuestsSchema.safeParse({
        retained_guest_id: idA,
        merged_guest_id: idB,
        resolved_phone: '+84901234567',
      });

      expect(mergeWithIntlPhone.success).toBe(true);
      if (mergeWithIntlPhone.success) {
        expect(normalizeVietnamesePhone(mergeWithIntlPhone.data.resolved_phone)).toBe('0901234567');
      }

      // Also accepts formatted numbers with spaces and dashes
      const mergeWithSpacedPhone = mergeGuestsSchema.safeParse({
        retained_guest_id: idA,
        merged_guest_id: idB,
        resolved_phone: '090 123 4567',
      });
      expect(mergeWithSpacedPhone.success).toBe(true);
    });

    it('rejects merging if merged guest profile is already archived', async () => {
      let callCount = 0;
      const mockTxDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return [{ id: idA, displayName: 'Guest A', isArchived: false, version: 1 }];
              }
              return [{ id: idB, displayName: 'Guest B', isArchived: true, version: 1 }];
            }),
          }),
        }),
      };

      await expect(
        mergeGuests(
          mockTxDb,
          {
            retained_guest_id: idA,
            merged_guest_id: idB,
            attendance_conflict_resolutions: [],
          },
          'user_1'
        )
      ).rejects.toThrow('Không thể gộp một hồ sơ đã bị xóa hoặc đã gộp trước đó');
    });

    it('rejects merging if retained guest profile is already archived', async () => {
      const mockTxDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: idA, displayName: 'Guest A', isArchived: true, version: 1 },
            ]),
          }),
        }),
      };

      await expect(
        mergeGuests(
          mockTxDb,
          {
            retained_guest_id: idA,
            merged_guest_id: idB,
            attendance_conflict_resolutions: [],
          },
          'user_1'
        )
      ).rejects.toThrow('Không thể gộp vào một hồ sơ đã bị xóa');
    });
  });
});
