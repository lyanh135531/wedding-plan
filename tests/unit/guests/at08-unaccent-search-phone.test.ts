import { describe, it, expect } from 'vitest';
import {
  normalizeVietnamesePhone,
  formatToE164,
  normalizeSearchTerm,
  evaluateDuplicatePair,
  CandidateGuestInput,
  extractGivenName,
  extractSearchablePhone,
} from '@/lib/guests/search';
import { removeVietnameseDiacritics } from '@/lib/utils';
import { FX01_FAMILY_GROUP } from '@tests/fixtures/fx01-family';

describe('AT08: Vietnamese Unaccent Search & Phone Normalization', () => {
  describe('1. Vietnamese Unaccent Search & Diacritic Handling', () => {
    it('properly converts barred "đ" and "Đ" to "d"', () => {
      expect(normalizeSearchTerm('Đặng')).toBe('dang');
      expect(normalizeSearchTerm('Đỗ Thị Thu Thảo')).toBe('do thi thu thao');
      expect(normalizeSearchTerm('ĐỒNG NAI')).toBe('dong nai');
      expect(normalizeSearchTerm('Đường Đi')).toBe('duong di');
    });

    it('strips all Vietnamese vowel diacritics and tone marks', () => {
      expect(normalizeSearchTerm('Nguyễn Văn Ba')).toBe('nguyen van ba');
      expect(normalizeSearchTerm('Trần Thị Mẹ (Bác Gái)')).toBe('tran thi me (bac gai)');
      expect(normalizeSearchTerm('Lễ Gia Tiên & Nhà Trai')).toBe('le gia tien & nha trai');
      expect(normalizeSearchTerm('Vũ Như Quỳnh')).toBe('vu nhu quynh');
      expect(normalizeSearchTerm('Huỳnh Phước Thọ')).toBe('huynh phuoc tho');
      expect(normalizeSearchTerm('Ngô Bảo Châu')).toBe('ngo bao chau');
    });

    it('handles uppercase, lowercase, mixed case, and excessive whitespace', () => {
      expect(normalizeSearchTerm('   BÁC BA   ')).toBe('bac ba');
      expect(normalizeSearchTerm('nGuYễN   vĂn   bA')).toBe('nguyen van ba');
      expect(normalizeSearchTerm(null)).toBe('');
      expect(normalizeSearchTerm(undefined)).toBe('');
    });

    it('matches search terms regardless of accents', () => {
      const guestName = 'Nguyễn Văn Ba';
      const normGuestName = normalizeSearchTerm(guestName);

      const query1 = 'nguyen van ba';
      const query2 = 'Nguyễn';
      const query3 = 'bac ba';

      expect(normGuestName.includes(normalizeSearchTerm(query1))).toBe(true);
      expect(normGuestName.includes(normalizeSearchTerm(query2))).toBe(true);
      expect(normGuestName.includes(normalizeSearchTerm(query3))).toBe(false);
    });
  });

  describe('2. Phone Normalization (+84 -> 0)', () => {
    it('normalizes international format +84 to local 0', () => {
      expect(normalizeVietnamesePhone('+84901234567')).toBe('0901234567');
      expect(normalizeVietnamesePhone('+84381234567')).toBe('0381234567');
      expect(normalizeVietnamesePhone('+84771234567')).toBe('0771234567');
      expect(normalizeVietnamesePhone('+84561234567')).toBe('0561234567');
      expect(normalizeVietnamesePhone('+84881234567')).toBe('0881234567');
    });

    it('normalizes 84 prefix without plus', () => {
      expect(normalizeVietnamesePhone('84901234567')).toBe('0901234567');
    });

    it('strips spaces, dashes, dots, and parentheses', () => {
      expect(normalizeVietnamesePhone('090 123 4567')).toBe('0901234567');
      expect(normalizeVietnamesePhone('090-123-4567')).toBe('0901234567');
      expect(normalizeVietnamesePhone('090.123.4567')).toBe('0901234567');
      expect(normalizeVietnamesePhone('(090) 123-4567')).toBe('0901234567');
      expect(normalizeVietnamesePhone('+84 (90) 123.4567')).toBe('0901234567');
    });

    it('rejects invalid phone numbers or non-Vietnamese carrier prefixes', () => {
      // 01 is not a valid 10-digit mobile prefix
      expect(normalizeVietnamesePhone('0123456789')).toBeNull();
      // Too short
      expect(normalizeVietnamesePhone('09012345')).toBeNull();
      // Too long
      expect(normalizeVietnamesePhone('090123456789')).toBeNull();
      // Letters
      expect(normalizeVietnamesePhone('090abcd567')).toBeNull();
      // Empty
      expect(normalizeVietnamesePhone('')).toBeNull();
      expect(normalizeVietnamesePhone(null)).toBeNull();
    });

    it('formats normalized phone to canonical E.164 (+84)', () => {
      expect(formatToE164('0901234567')).toBe('+84901234567');
      expect(formatToE164('+84 901 234 567')).toBe('+84901234567');
      expect(formatToE164('invalid')).toBeNull();
    });
  });

  describe('3. Shared Family Phone Exception', () => {
    it('does NOT classify husband and wife sharing a phone as duplicate candidates', () => {
      const father: CandidateGuestInput = {
        id: FX01_FAMILY_GROUP.guests.father.id,
        displayName: FX01_FAMILY_GROUP.guests.father.displayName,
        phone: FX01_FAMILY_GROUP.guests.father.phone, // '0901234567'
        groupId: FX01_FAMILY_GROUP.guests.father.groupId,
      };

      const mother: CandidateGuestInput = {
        id: FX01_FAMILY_GROUP.guests.mother.id,
        displayName: FX01_FAMILY_GROUP.guests.mother.displayName,
        phone: FX01_FAMILY_GROUP.guests.mother.phone, // '0901234567' (shared)
        groupId: FX01_FAMILY_GROUP.guests.mother.groupId,
      };

      const result = evaluateDuplicatePair(father, mother);

      // Must NOT be classified as candidate duplicate (score < 0.70)
      expect(result.isCandidate).toBe(false);
      expect(result.similarityScore).toBeLessThan(0.70);
      expect(result.matchReasons).toContain('Dùng chung số điện thoại gia đình');
    });
  });

  describe('4. Sibling Given Name Safeguard (extractGivenName)', () => {
    it('extracts given name correctly from standard Vietnamese full names', () => {
      expect(extractGivenName('nguyen van ba')).toBe('ba');
      expect(extractGivenName('nguyen van bi')).toBe('bi');
      expect(extractGivenName('tran thi thu thao')).toBe('thao');
      expect(extractGivenName('tuan')).toBe('tuan');
      expect(extractGivenName('')).toBe('');
      expect(extractGivenName('   ')).toBe('');
    });

    it('distinguishes siblings with shared family/middle names vs legitimate typos/duplicates', () => {
      const brother1: CandidateGuestInput = { id: 'b1', displayName: 'Nguyễn Văn Ba', phone: '0901234567' };
      const brother2: CandidateGuestInput = { id: 'b2', displayName: 'Nguyễn Văn Bi', phone: '0901234567' };

      const siblingRes = evaluateDuplicatePair(brother1, brother2);
      expect(siblingRes.isCandidate).toBe(false);
      expect(siblingRes.similarityScore).toBe(0.35);
      expect(siblingRes.matchReasons).toContain('Dùng chung số điện thoại gia đình');

      // Contrast: Duplicate with abbreviation/omission of middle name ("Nguyễn Tuấn" vs "Nguyễn Văn Tuấn")
      const personA: CandidateGuestInput = { id: 'p1', displayName: 'Nguyễn Tuấn', phone: '0901234567' };
      const personB: CandidateGuestInput = { id: 'p2', displayName: 'Nguyễn Văn Tuấn', phone: '0901234567' };

      const duplicateRes = evaluateDuplicatePair(personA, personB);
      expect(duplicateRes.isCandidate).toBe(true);
      expect(duplicateRes.similarityScore).toBe(0.85);
      expect(duplicateRes.matchReasons).toContain('Tên tương đồng cao và trùng số điện thoại');
    });
  });

  describe('5. Search Query Phone Extraction (extractSearchablePhone)', () => {
    it('returns null when query has text or letters', () => {
      expect(extractSearchablePhone('Bàn 1')).toBeNull();
      expect(extractSearchablePhone('Bác Ba 2')).toBeNull();
      expect(extractSearchablePhone('Nhóm 2')).toBeNull();
      expect(extractSearchablePhone('Bàn VIP 1')).toBeNull();
    });

    it('returns null for short digit queries (< 4 digits)', () => {
      expect(extractSearchablePhone('1')).toBeNull();
      expect(extractSearchablePhone('12')).toBeNull();
      expect(extractSearchablePhone('123')).toBeNull();
    });

    it('returns digits for partial phone queries (>= 4 digits)', () => {
      expect(extractSearchablePhone('4567')).toBe('4567');
      expect(extractSearchablePhone('0901')).toBe('0901');
    });

    it('returns canonical 10-digit number for full mobile numbers', () => {
      expect(extractSearchablePhone('090 123 4567')).toBe('0901234567');
      expect(extractSearchablePhone('+84 901 234 567')).toBe('0901234567');
      expect(extractSearchablePhone('090-123-4567')).toBe('0901234567');
    });
  });
});
