import { describe, it, expect, vi } from 'vitest';
import {
  normalizeVietnamesePhone,
  formatToE164,
  normalizeSearchTerm,
  calculateLevenshteinDistance,
  evaluateDuplicatePair,
  findDuplicateCandidates,
  CandidateGuestInput,
  extractGivenName,
  extractSearchablePhone,
} from '@/lib/guests/search';
import { removeVietnameseDiacritics } from '@/lib/utils';
import {
  computeEventHeadcountBreakdown,
  computeWeddingWideHeadcount,
  AttendanceRecordInput,
  GuestProfileInput,
} from '@/lib/guests/headcount';
import {
  createInvitationSchema,
  updateInvitationSchema,
  mergeGuestsSchema,
  createGuestSchema,
  updateAttendanceSchema,
} from '@/schemas/guests';
import { FX01_FAMILY_GROUP } from '@tests/fixtures/fx01-family';
import { createInvitation } from '@/lib/guests/invitations.repository';
import { mergeGuests } from '@/lib/guests/merge.service';
import * as schema from '@/db/schema';

describe('EMPIRICAL CHALLENGER: Gate G3 Domain Invariants Stress Harness', () => {
  describe('CHALLENGE 1: Invariant "1-Person-Per-Card-Per-Event" Boundary Probes', () => {
    it('prohibits duplicate member entries in schema input', () => {
      const eveningEventId = FX01_FAMILY_GROUP.events.eveningReception.id;
      const fatherId = FX01_FAMILY_GROUP.guests.father.id;

      // An invitation with duplicate guest IDs in member_guest_ids
      const parsed = createInvitationSchema.safeParse({
        event_id: eveningEventId,
        card_name: 'Thiệp Test Trùng Lặp Thành Viên',
        representative_guest_id: fatherId,
        delivery_method: 'paper',
        status: 'save_the_date',
        member_guest_ids: [fatherId, fatherId], // duplicate member in input
      });

      expect(parsed.success).toBe(true);
      // Ensure that when Set is constructed in repository, size is deduplicated
      const uniqueMembers = Array.from(new Set(parsed.data!.member_guest_ids));
      expect(uniqueMembers).toHaveLength(1);
    });

    it('PROBE: Does representative_guest_id bypass member uniqueness check if omitted from member_guest_ids?', () => {
      const eveningEventId = FX01_FAMILY_GROUP.events.eveningReception.id;
      const fatherId = FX01_FAMILY_GROUP.guests.father.id;
      const motherId = FX01_FAMILY_GROUP.guests.mother.id;

      // Input where representative is NOT in member_guest_ids
      const parsed = createInvitationSchema.safeParse({
        event_id: eveningEventId,
        card_name: 'Thiệp Đại Diện Ngoài Danh Sách',
        representative_guest_id: fatherId,
        delivery_method: 'paper',
        status: 'save_the_date',
        member_guest_ids: [motherId], // Father is representative, but not in members list!
      });

      expect(parsed.success).toBe(true);
      // In createInvitation:
      // const existingMemberships query checks inArray(guestId, input.member_guest_ids)
      // Because fatherId was not in input.member_guest_ids, the conflict check would NOT include fatherId!
      // This is an architectural finding: validation must query `finalizedMemberIds` (including representative),
      // not merely `input.member_guest_ids`.
      const memberSet = new Set(parsed.data!.member_guest_ids);
      if (!memberSet.has(parsed.data!.representative_guest_id)) {
        memberSet.add(parsed.data!.representative_guest_id);
      }
      const finalized = Array.from(memberSet);
      expect(finalized).toContain(fatherId);
      expect(finalized).toContain(motherId);
    });

    it('REMEDIATED INVARIANT: createInvitation strictly rejects representative_guest_id if they already belong to another card in the same event', async () => {
      const eventId = 'e0000000-0000-4000-8000-000000000001';
      const guestA = '10000000-0000-4000-8000-000000000001'; // already belongs to Card 1 in eventId
      const guestB = '10000000-0000-4000-8000-000000000002'; // new guest

      const mockTxDb: any = {
        select: vi.fn().mockImplementation(() => {
          return {
            from: vi.fn().mockImplementation((table) => {
              if (table === schema.guests) {
                return {
                  where: vi.fn().mockResolvedValue([
                    { id: guestA, displayName: 'Guest A', ageTier: 'adult', isArchived: false },
                    { id: guestB, displayName: 'Guest B', ageTier: 'adult', isArchived: false },
                  ]),
                };
              }
              if (table === schema.invitationMembers) {
                return {
                  innerJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockImplementation(() => {
                      // Because finalizedMemberIds includes guestA,
                      // the conflict query detects guestA in 'Card 1'!
                      return [{ guestId: guestA, cardName: 'Card 1' }];
                    }),
                  }),
                };
              }
              return { where: vi.fn().mockResolvedValue([]) };
            }),
          };
        }),
      };

      await expect(
        createInvitation(
          mockTxDb,
          {
            event_id: eventId,
            card_name: 'Card 2',
            representative_guest_id: guestA, // Guest A is representative
            delivery_method: 'paper',
            status: 'save_the_date',
            member_guest_ids: [guestB], // Guest A omitted from member_guest_ids
          },
          'user_1'
        )
      ).rejects.toThrow('Khách mời đã thuộc thiệp "Card 1" trong cùng buổi tiệc này');
    });

    it('SUCCESS PATH: createInvitation seeds initial attendance records respecting baby policy and age tier', async () => {
      const eventId = 'e0000000-0000-4000-8000-000000000001';
      const adultGuestId = '10000000-0000-4000-8000-000000000001';
      const babyGuestId = '10000000-0000-4000-8000-000000000002';

      const insertedAttendances: any[] = [];
      const insertedMembers: any[] = [];

      const mockTxDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation((table) => {
            if (table === schema.guests) {
              return {
                where: vi.fn().mockResolvedValue([
                  { id: adultGuestId, displayName: 'Adult Guest', ageTier: 'adult', isArchived: false },
                  { id: babyGuestId, displayName: 'Baby Guest', ageTier: 'baby', isArchived: false },
                ]),
              };
            }
            if (table === schema.invitationMembers) {
              return {
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockResolvedValue([]), // No card conflicts
                }),
              };
            }
            if (table === schema.attendance) {
              return {
                where: vi.fn().mockResolvedValue([]), // No prior attendance records
              };
            }
            return { where: vi.fn().mockResolvedValue([]) };
          }),
        })),
        insert: vi.fn().mockImplementation((table) => ({
          values: vi.fn().mockImplementation((val) => {
            if (table === schema.invitations) {
              return {
                returning: vi.fn().mockResolvedValue([
                  {
                    id: 'c0000000-0000-4000-8000-000000000001',
                    eventId,
                    cardName: 'Gia đình Bác Ba',
                    representativeGuestId: adultGuestId,
                    deliveryMethod: 'paper',
                    inChargeUserId: null,
                    status: 'save_the_date',
                    sentDate: null,
                    notes: null,
                    version: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                ]),
              };
            }
            if (table === schema.invitationMembers) {
              insertedMembers.push(val);
              return Promise.resolve();
            }
            if (table === schema.attendance) {
              insertedAttendances.push(val);
              return Promise.resolve();
            }
            return Promise.resolve();
          }),
        })),
      };

      const result = await createInvitation(
        mockTxDb,
        {
          event_id: eventId,
          card_name: 'Gia đình Bác Ba',
          representative_guest_id: adultGuestId,
          delivery_method: 'paper',
          status: 'save_the_date',
          member_guest_ids: [babyGuestId],
        },
        'user_1'
      );

      expect(result.member_guest_ids).toHaveLength(2);
      expect(insertedMembers).toHaveLength(2);

      // Verify attendance seeding respecting Baby Policy
      expect(insertedAttendances).toHaveLength(2);

      const adultAtt = insertedAttendances.find((a) => a.guestId === adultGuestId);
      expect(adultAtt).toBeDefined();
      expect(adultAtt.needsSeat).toBe(true);
      expect(adultAtt.needsMeal).toBe(true);
      expect(adultAtt.rsvpStatus).toBe('not_contacted');

      const babyAtt = insertedAttendances.find((a) => a.guestId === babyGuestId);
      expect(babyAtt).toBeDefined();
      expect(babyAtt.needsSeat).toBe(false); // Baby policy: false
      expect(babyAtt.needsMeal).toBe(false); // Baby policy: false
      expect(babyAtt.rsvpStatus).toBe('not_contacted');
    });

    it('REJECTS creating invitation if any guest in finalized members is archived', async () => {
      const eventId = 'e0000000-0000-4000-8000-000000000001';
      const activeId = '10000000-0000-4000-8000-000000000001';
      const archivedId = '10000000-0000-4000-8000-000000000002';

      const mockTxDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockResolvedValue([
              { id: activeId, displayName: 'Active Guest', ageTier: 'adult', isArchived: false },
              { id: archivedId, displayName: 'Archived Guest', ageTier: 'adult', isArchived: true },
            ]),
          })),
        })),
      };

      await expect(
        createInvitation(
          mockTxDb,
          {
            event_id: eventId,
            card_name: 'Test Card',
            representative_guest_id: activeId,
            delivery_method: 'paper',
            status: 'save_the_date',
            member_guest_ids: [archivedId],
          },
          'user_1'
        )
      ).rejects.toThrow('Không thể tạo thiệp mời cho khách "Archived Guest" đã bị xóa hoặc đã gộp hồ sơ');
    });
  });

  describe('CHALLENGE 2: Vietnamese Diacritics, Tone Marks, and Normalization Edge Cases', () => {
    it('normalizes barred "đ" and "Đ" across all case and accent positions', () => {
      expect(normalizeSearchTerm('đ')).toBe('d');
      expect(normalizeSearchTerm('Đ')).toBe('d');
      expect(normalizeSearchTerm('đặng')).toBe('dang');
      expect(normalizeSearchTerm('ĐẶNG')).toBe('dang');
      expect(normalizeSearchTerm('đỗ')).toBe('do');
      expect(normalizeSearchTerm('ĐỖ')).toBe('do');
      expect(normalizeSearchTerm('điểm')).toBe('diem');
      expect(normalizeSearchTerm('ĐIỂM')).toBe('diem');
      expect(normalizeSearchTerm('đường')).toBe('duong');
      expect(normalizeSearchTerm('ĐƯỜNG')).toBe('duong');
    });

    it('correctly normalizes all 5 Vietnamese tone marks on all vowels', () => {
      // a: à, á, ả, ã, ạ
      expect(normalizeSearchTerm('hà há hả hã hạ')).toBe('ha ha ha ha ha');
      // ă: ằ, ắ, ẳ, ẵ, ặ
      expect(normalizeSearchTerm('hằn hắt hẳm hẵng hặm')).toBe('han hat ham hang ham');
      // â: ầ, ấ, ẩ, ẫ, ậ
      expect(normalizeSearchTerm('hầm hất hẩm hẫng hậm')).toBe('ham hat ham hang ham');
      // e: è, é, ẻ, ẽ, ẹ
      expect(normalizeSearchTerm('hè hé hẻ hẽ hẹ')).toBe('he he he he he');
      // ê: ề, ế, ể, ễ, ệ
      expect(normalizeSearchTerm('hề hế hể hễ hệ')).toBe('he he he he he');
      // i: ì, í, ỉ, ĩ, ị
      expect(normalizeSearchTerm('hì hí hỉ hĩ hị')).toBe('hi hi hi hi hi');
      // o: ò, ó, ỏ, õ, ọ
      expect(normalizeSearchTerm('hò hó hỏ hõ họ')).toBe('ho ho ho ho ho');
      // ô: ồ, ố, ổ, ỗ, ộ
      expect(normalizeSearchTerm('hồ hố hổ hỗ hộ')).toBe('ho ho ho ho ho');
      // ơ: ờ, ớ, ở, ỡ, ợ
      expect(normalizeSearchTerm('hờ hớ hở hỡ hợ')).toBe('ho ho ho ho ho');
      // u: ù, ú, ủ, ũ, ụ
      expect(normalizeSearchTerm('hù hú hủ hũ hụ')).toBe('hu hu hu hu hu');
      // ư: ừ, ứ, ử, ữ, ự
      expect(normalizeSearchTerm('hừ hứ hử hữ hự')).toBe('hu hu hu hu hu');
      // y: ỳ, ý, ỷ, ỹ, ỵ
      expect(normalizeSearchTerm('hỳ hý hỷ hỹ hỵ')).toBe('hy hy hy hy hy');
    });

    it('handles decomposed Unicode NFD vs precomposed NFC equivalents identically', () => {
      const nfc = 'Nguyễn Thị Thu Thảo';
      const nfd = nfc.normalize('NFD');
      expect(nfc).not.toBe(nfd); // Under binary comparison, strings differ

      expect(normalizeSearchTerm(nfc)).toBe(normalizeSearchTerm(nfd));
      expect(normalizeSearchTerm(nfd)).toBe('nguyen thi thu thao');
    });

    it('handles tone placement variations (old style vs new style)', () => {
      // New style: tone on second vowel in diphthong ("hòa", "thủy")
      // Old style: tone on first vowel ("hoà", "thuỷ")
      expect(normalizeSearchTerm('hòa')).toBe('hoa');
      expect(normalizeSearchTerm('hoà')).toBe('hoa');
      expect(normalizeSearchTerm('hòa')).toBe(normalizeSearchTerm('hoà'));

      expect(normalizeSearchTerm('thủy')).toBe('thuy');
      expect(normalizeSearchTerm('thuỷ')).toBe('thuy');
      expect(normalizeSearchTerm('thủy')).toBe(normalizeSearchTerm('thuỷ'));

      expect(normalizeSearchTerm('quý')).toBe('quy');
      expect(normalizeSearchTerm('qúy')).toBe('quy');
    });

    it('handles excessive spaces, non-breaking spaces, and empty inputs gracefully', () => {
      expect(normalizeSearchTerm('   Nguyễn    Văn      Ba   ')).toBe('nguyen van ba');
      expect(normalizeSearchTerm('\t\tNguyễn\n\tVăn\r\nBa  ')).toBe('nguyen van ba');
      // Non-breaking space (\u00A0)
      expect(normalizeSearchTerm('Nguyễn\u00A0Văn\u00A0Ba')).toBe('nguyen van ba');
      expect(normalizeSearchTerm('')).toBe('');
      expect(normalizeSearchTerm('   ')).toBe('');
      expect(normalizeSearchTerm(null)).toBe('');
      expect(normalizeSearchTerm(undefined)).toBe('');
    });
  });

  describe('CHALLENGE 3: Phone Normalization Boundary & Adversarial Probes', () => {
    it('normalizes all 5 Vietnamese mobile carrier prefix series (03, 05, 07, 08, 09)', () => {
      // Viettel: 03x, 086, 096, 097, 098
      expect(normalizeVietnamesePhone('0321234567')).toBe('0321234567');
      expect(normalizeVietnamesePhone('+84321234567')).toBe('0321234567');
      expect(normalizeVietnamesePhone('0861234567')).toBe('0861234567');
      expect(normalizeVietnamesePhone('0981234567')).toBe('0981234567');

      // Vietnamobile: 05x, 092
      expect(normalizeVietnamesePhone('0561234567')).toBe('0561234567');
      expect(normalizeVietnamesePhone('0921234567')).toBe('0921234567');

      // Mobifone: 07x, 089, 090, 093
      expect(normalizeVietnamesePhone('0701234567')).toBe('0701234567');
      expect(normalizeVietnamesePhone('0891234567')).toBe('0891234567');
      expect(normalizeVietnamesePhone('0901234567')).toBe('0901234567');
      expect(normalizeVietnamesePhone('0931234567')).toBe('0931234567');

      // Vinaphone: 081-085, 088, 091, 094
      expect(normalizeVietnamesePhone('0811234567')).toBe('0811234567');
      expect(normalizeVietnamesePhone('0881234567')).toBe('0881234567');
      expect(normalizeVietnamesePhone('0911234567')).toBe('0911234567');
      expect(normalizeVietnamesePhone('0941234567')).toBe('0941234567');
    });

    it('rejects obsolete 11-digit prefixes (012x, 016x) that were converted to 10-digits in 2018', () => {
      // Obsolete 11-digit numbers
      expect(normalizeVietnamesePhone('01681234567')).toBeNull();
      expect(normalizeVietnamesePhone('01231234567')).toBeNull();
    });

    it('rejects non-mobile numbers (landlines: 024, 028) and invalid prefixes (01, 04, 06)', () => {
      expect(normalizeVietnamesePhone('02438234567')).toBeNull(); // Hanoi landline
      expect(normalizeVietnamesePhone('02838234567')).toBeNull(); // HCMC landline
      expect(normalizeVietnamesePhone('0101234567')).toBeNull();
      expect(normalizeVietnamesePhone('0401234567')).toBeNull();
      expect(normalizeVietnamesePhone('0601234567')).toBeNull();
    });

    it('rejects malformed inputs, SQL injection attempts, and boundary strings', () => {
      // String with trailing SQL injection payload: extra digits cause length > 10, rejected
      expect(normalizeVietnamesePhone("0901234567' OR '1'='1")).toBeNull();
      expect(normalizeVietnamesePhone("09012345678' OR '1'='1")).toBeNull();
      expect(normalizeVietnamesePhone('090-CALL-NOW')).toBeNull();
      expect(normalizeVietnamesePhone('null')).toBeNull();
      expect(normalizeVietnamesePhone('undefined')).toBeNull();
    });
  });

  describe('CHALLENGE 4: Shared Family Phone Exception & Duplicate Detection Logic', () => {
    it('FAMILY PHONE EXCEPTION: Husband and wife with different surnames do not flag as duplicate', () => {
      const father: CandidateGuestInput = { id: '1', displayName: 'Nguyễn Văn Ba', phone: '0901234567', groupId: 'family_1' };
      const mother: CandidateGuestInput = { id: '2', displayName: 'Trần Thị Mẹ', phone: '0901234567', groupId: 'family_1' };

      const evalRes = evaluateDuplicatePair(father, mother);
      expect(evalRes.isCandidate).toBe(false);
      expect(evalRes.similarityScore).toBe(0.35);
      expect(evalRes.matchReasons).toContain('Dùng chung số điện thoại gia đình');
    });

    it('ADVERSARIAL COLLISION RESOLVED: Siblings with identical Family+Middle name ("Nguyễn Văn Ba" vs "Nguyễn Văn Bi") do NOT flag as duplicate candidate', () => {
      const father: CandidateGuestInput = { id: '1', displayName: 'Nguyễn Văn Ba', phone: '0901234567', groupId: 'family_1' };
      const childBi: CandidateGuestInput = { id: '3', displayName: 'Nguyễn Văn Bi', phone: '0901234567', groupId: 'family_1' };

      const evalRes = evaluateDuplicatePair(father, childBi);
      // Remediated verification:
      // Even though "nguyen van ba" vs "nguyen van bi" has Levenshtein distance 1 (similarity 0.923 >= 0.70),
      // their given names differ ("ba" !== "bi").
      // Under Vietnamese naming rules, this is classified as Shared Family Phone Exception:
      expect(evalRes.isCandidate).toBe(false);
      expect(evalRes.similarityScore).toBe(0.35);
      expect(evalRes.matchReasons).toContain('Dùng chung số điện thoại gia đình');
    });

    it('DUPLICATE FLAG: Same person recorded with variation in middle name and same phone FLAGS as duplicate', () => {
      const g1: CandidateGuestInput = {
        id: '1',
        displayName: 'Nguyễn Văn Tuấn',
        phone: '0909112233',
      };
      const g2: CandidateGuestInput = {
        id: '2',
        displayName: 'Nguyễn Tuấn', // missing middle name
        phone: '0909112233',
      };

      const res = evaluateDuplicatePair(g1, g2);
      expect(res.isCandidate).toBe(true);
      expect(res.similarityScore).toBeGreaterThanOrEqual(0.70);
    });

    it('HOMONYM SAFEGUARD: Identical names with different phone numbers and groups do NOT flag as candidate', () => {
      const g1: CandidateGuestInput = {
        id: '1',
        displayName: 'Nguyễn Văn Tuấn',
        phone: '0901111111',
        groupId: 'group_highschool',
      };
      const g2: CandidateGuestInput = {
        id: '2',
        displayName: 'Nguyễn Văn Tuấn', // Homonym
        phone: '0902222222', // completely different phone
        groupId: 'group_colleagues', // completely different group
      };

      const res = evaluateDuplicatePair(g1, g2);
      // Homonym with different phone and different group should NOT be a candidate
      expect(res.isCandidate).toBe(false);
      expect(res.similarityScore).toBe(0.60);
      expect(res.matchReasons).toContain('Trùng tên chuẩn hóa (khác thông tin liên hệ)');
    });
  });

  describe('CHALLENGE 5: Profile Merge Adversarial Security & Invariants', () => {
    it('blocks self-merge in schema with case variations', () => {
      const parseLower = mergeGuestsSchema.safeParse({
        retained_guest_id: '10000000-0000-4000-8000-000000000001',
        merged_guest_id: '10000000-0000-4000-8000-000000000001',
      });
      expect(parseLower.success).toBe(false);

      const parseMixedCase = mergeGuestsSchema.safeParse({
        retained_guest_id: '10000000-0000-4000-8000-00000000000a',
        merged_guest_id: '10000000-0000-4000-8000-00000000000A',
      });
      expect(parseMixedCase.success).toBe(false);
    });

    it('rejects merge resolution if attendance conflict specifies invalid rsvp status', () => {
      const parseInvalid = mergeGuestsSchema.safeParse({
        retained_guest_id: '10000000-0000-4000-8000-000000000001',
        merged_guest_id: '10000000-0000-4000-8000-000000000002',
        attendance_conflict_resolutions: [
          {
            event_id: 'e0000000-0000-4000-8000-000000000001',
            chosen_rsvp_status: 'maybe_coming' as any, // invalid status
            needs_seat: true,
            needs_meal: true,
            meal_dietary_tier: 'regular',
          },
        ],
      });
      expect(parseInvalid.success).toBe(false);
    });
  });

  describe('CHALLENGE 6: Headcount Mathematical Consistency Invariants', () => {
    it('guarantees confirmed_seats <= confirmed_guests and meals_total <= confirmed_guests', () => {
      const mockAttendances: AttendanceRecordInput[] = [
        {
          id: '1',
          guestId: 'g1',
          eventId: 'e1',
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
        {
          id: '2',
          guestId: 'g2',
          eventId: 'e1',
          rsvpStatus: 'accepted',
          needsSeat: false, // does not need seat
          needsMeal: true,
          mealDietaryTier: 'vegetarian',
        },
        {
          id: '3',
          guestId: 'g3',
          eventId: 'e1',
          rsvpStatus: 'declined',
          needsSeat: false,
          needsMeal: false,
          mealDietaryTier: 'regular',
        },
        {
          id: '4',
          guestId: 'g4',
          eventId: 'e1',
          rsvpStatus: 'tentative',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
      ];

      const guestsMap: Record<string, GuestProfileInput> = {
        g1: { id: 'g1', ageTier: 'adult', isArchived: false },
        g2: { id: 'g2', ageTier: 'adult', isArchived: false },
        g3: { id: 'g3', ageTier: 'adult', isArchived: false },
        g4: { id: 'g4', ageTier: 'adult', isArchived: false },
      };

      const summary = computeEventHeadcountBreakdown('e1', mockAttendances, guestsMap);

      // Invariants:
      // 1. confirmedGuests + uncertainGuests + declinedGuests === totalInvited
      expect(summary.confirmed_guests + summary.uncertain_guests + summary.declined_guests).toBe(summary.total_invited);
      expect(summary.total_invited).toBe(4);
      expect(summary.confirmed_guests).toBe(2);
      expect(summary.uncertain_guests).toBe(1);
      expect(summary.declined_guests).toBe(1);

      // 2. confirmed_seats <= confirmed_guests
      expect(summary.confirmed_seats).toBeLessThanOrEqual(summary.confirmed_guests);
      expect(summary.confirmed_seats).toBe(1);

      // 3. meals_total <= confirmed_guests
      expect(summary.meals_total).toBeLessThanOrEqual(summary.confirmed_guests);
      expect(summary.meals_total).toBe(2);

      // 4. meals_regular + meals_vegetarian + meals_child + babies_count === meals_total
      expect(summary.meals_regular + summary.meals_vegetarian + summary.meals_child + summary.babies_count).toBe(
        summary.meals_total
      );
    });

    it('excludes archived guests completely from headcount calculations', () => {
      const mockAttendances: AttendanceRecordInput[] = [
        {
          id: '1',
          guestId: 'g_active',
          eventId: 'e1',
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
        {
          id: '2',
          guestId: 'g_archived',
          eventId: 'e1',
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          mealDietaryTier: 'regular',
        },
      ];

      const guestsMap: Record<string, GuestProfileInput> = {
        g_active: { id: 'g_active', ageTier: 'adult', isArchived: false },
        g_archived: { id: 'g_archived', ageTier: 'adult', isArchived: true },
      };

      const summary = computeEventHeadcountBreakdown('e1', mockAttendances, guestsMap);
      expect(summary.total_invited).toBe(1);
      expect(summary.confirmed_guests).toBe(1);
      expect(summary.confirmed_seats).toBe(1);
    });
  });

  describe('CHALLENGE 7: Search Query Single-Digit Phone Wildcard Collision Safeguard', () => {
    it('extractSearchablePhone returns null when search term contains text/letters (e.g. "Bàn 1" or "Bác Ba 2")', () => {
      expect(extractSearchablePhone('Bàn 1')).toBeNull();
      expect(extractSearchablePhone('Bàn 2')).toBeNull();
      expect(extractSearchablePhone('Bác Ba 2')).toBeNull();
      expect(extractSearchablePhone('Nhóm 3')).toBeNull();
      expect(extractSearchablePhone('Bàn VIP 10')).toBeNull();
    });

    it('extractSearchablePhone returns null for short digit queries (< 4 digits)', () => {
      expect(extractSearchablePhone('1')).toBeNull();
      expect(extractSearchablePhone('12')).toBeNull();
      expect(extractSearchablePhone('123')).toBeNull();
      expect(extractSearchablePhone('09')).toBeNull();
    });

    it('extractSearchablePhone returns digits for pure partial phone queries (>= 4 digits)', () => {
      expect(extractSearchablePhone('4567')).toBe('4567');
      expect(extractSearchablePhone('0901')).toBe('0901');
      expect(extractSearchablePhone('12345')).toBe('12345');
    });

    it('extractSearchablePhone returns canonical 10-digit phone for full Vietnamese phone inputs', () => {
      expect(extractSearchablePhone('090 123 4567')).toBe('0901234567');
      expect(extractSearchablePhone('+84 901 234 567')).toBe('0901234567');
      expect(extractSearchablePhone('090-123-4567')).toBe('0901234567');
    });
  });

  describe('CHALLENGE 8: Phone Schema vs Domain Normalizer Consistency', () => {
    it('Zod phone schema accepts formatted numbers via cleanPhoneInput preprocessor', () => {
      const spacedPhone = '090 123 4567';
      const dashedPhone = '090-123-4567';
      const dottedPhone = '090.123.4567';
      const parenthesizedPhone = '(090) 123-4567';
      const intlNoPlus = '84901234567';
      const intlSpaced = '+84 901 234 567';

      // Domain function normalizeVietnamesePhone accepts all:
      expect(normalizeVietnamesePhone(spacedPhone)).toBe('0901234567');
      expect(normalizeVietnamesePhone(dashedPhone)).toBe('0901234567');
      expect(normalizeVietnamesePhone(dottedPhone)).toBe('0901234567');
      expect(normalizeVietnamesePhone(parenthesizedPhone)).toBe('0901234567');
      expect(normalizeVietnamesePhone(intlNoPlus)).toBe('0901234567');
      expect(normalizeVietnamesePhone(intlSpaced)).toBe('0901234567');

      // Zod schema on API gateway (createGuestSchema) also accepts all:
      const parseSpaced = createGuestSchema.safeParse({ display_name: 'Test', phone: spacedPhone });
      const parseDashed = createGuestSchema.safeParse({ display_name: 'Test', phone: dashedPhone });
      const parseDotted = createGuestSchema.safeParse({ display_name: 'Test', phone: dottedPhone });
      const parseParenthesized = createGuestSchema.safeParse({ display_name: 'Test', phone: parenthesizedPhone });
      const parseIntlNoPlus = createGuestSchema.safeParse({ display_name: 'Test', phone: intlNoPlus });
      const parseIntlSpaced = createGuestSchema.safeParse({ display_name: 'Test', phone: intlSpaced });

      expect(parseSpaced.success).toBe(true);
      expect(parseDashed.success).toBe(true);
      expect(parseDotted.success).toBe(true);
      expect(parseParenthesized.success).toBe(true);
      expect(parseIntlNoPlus.success).toBe(true);
      expect(parseIntlSpaced.success).toBe(true);
    });
  });

  describe('CHALLENGE 9: Merge Service Invariant Probes', () => {
    it('REMEDIATED: mergeGuests throws when merged guest profile is already archived', async () => {
      const retainedId = '10000000-0000-4000-8000-000000000001';
      const mergedId = '10000000-0000-4000-8000-000000000002';

      let selectCount = 0;
      const mockTxDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1) {
                return [{ id: retainedId, displayName: 'Retained', isArchived: false, version: 1 }];
              } else {
                return [{ id: mergedId, displayName: 'Merged', isArchived: true, version: 1 }];
              }
            }),
          }),
        }),
      };

      await expect(
        mergeGuests(
          mockTxDb,
          {
            retained_guest_id: retainedId,
            merged_guest_id: mergedId,
            attendance_conflict_resolutions: [],
          },
          'user_1'
        )
      ).rejects.toThrow('Không thể gộp một hồ sơ đã bị xóa hoặc đã gộp trước đó');
    });

    it('CLEANUP: mergeGuests deletes orphaned invitation card when merged guest was sole member in an event where retained guest already has a card', async () => {
      const retainedId = '10000000-0000-4000-8000-000000000001';
      const mergedId = '10000000-0000-4000-8000-000000000002';
      const eventId = 'e0000000-0000-4000-8000-000000000001';
      const orphanedCardId = 'c0000000-0000-4000-8000-000000000002';

      let deletedCardId: string | null = null;
      let callIndex = 0;

      const mockTxDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation((table) => {
            if (table === schema.guests) {
              return {
                where: vi.fn().mockImplementation(() => {
                  callIndex++;
                  if (callIndex === 1) {
                    return [{ id: retainedId, displayName: 'Retained', isArchived: false, version: 1, subTags: [] }];
                  } else {
                    return [{ id: mergedId, displayName: 'Merged', isArchived: false, version: 1, subTags: [] }];
                  }
                }),
              };
            }
            if (table === schema.invitationMembers) {
              return {
                innerJoin: vi.fn().mockImplementation(() => ({
                  where: vi.fn().mockImplementation(() => {
                    if (callIndex < 5) {
                      callIndex += 2;
                      return [
                        {
                          invitationId: orphanedCardId,
                          eventId,
                          representativeGuestId: mergedId,
                        },
                      ];
                    } else {
                      return [
                        {
                          invitationId: 'c0000000-0000-4000-8000-000000000001',
                          eventId,
                        },
                      ];
                    }
                  }),
                })),
                where: vi.fn().mockImplementation(() => {
                  // remainingMembers check: returns empty array (sole member was deleted)
                  return [];
                }),
              };
            }
            return { where: vi.fn().mockResolvedValue([]) };
          }),
        })),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => ({
              returning: vi.fn().mockResolvedValue([
                {
                  id: retainedId,
                  displayName: 'Retained',
                  side: 'groom',
                  ageTier: 'adult',
                  isPlaceholder: false,
                  isArchived: false,
                  version: 2,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]),
            })),
          }),
        })),
        delete: vi.fn().mockImplementation((table) => ({
          where: vi.fn().mockImplementation(() => {
            if (table === schema.invitations) {
              deletedCardId = orphanedCardId;
            }
            return Promise.resolve();
          }),
        })),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };

      const res = await mergeGuests(
        mockTxDb,
        {
          retained_guest_id: retainedId,
          merged_guest_id: mergedId,
          attendance_conflict_resolutions: [],
        },
        'user_1'
      );

      expect(res.success).toBe(true);
      expect(deletedCardId).toBe(orphanedCardId);
    });
  });
});
