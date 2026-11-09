import { removeVietnameseDiacritics } from '@/lib/utils';

/**
 * Normalizes any Vietnamese phone string into canonical local format ('0xxxxxxxxx').
 * Supports: '+84...', '84...', spaces, dots, dashes, parentheses.
 * Validates 10-digit format starting with official carrier prefixes: 03, 05, 07, 08, 09.
 * Returns null if the phone string cannot be normalized to a valid Vietnamese mobile number.
 */
export function normalizeVietnamesePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  let local = digits;

  if (digits.startsWith('+84')) {
    local = '0' + digits.slice(3);
  } else if (digits.startsWith('84') && digits.length === 11) {
    local = '0' + digits.slice(2);
  }

  // Official Vietnamese mobile prefixes: 10 digits starting with 03, 05, 07, 08, 09
  if (/^0[35789]\d{8}$/.test(local)) {
    return local;
  }
  return null;
}

/**
 * Formats canonical local phone to E.164 (+84...)
 */
export function formatToE164(localPhone: string | null | undefined): string | null {
  const normalized = normalizeVietnamesePhone(localPhone);
  if (!normalized) return null;
  return '+84' + normalized.slice(1);
}

/**
 * Normalizes text for search by lowercasing and stripping Vietnamese accents/tone marks,
 * including composite diacritics and 'đ' / 'Đ'.
 */
export function normalizeSearchTerm(term: string | null | undefined): string {
  if (!term) return '';
  return removeVietnameseDiacritics(term.trim().replace(/\s+/g, ' '));
}

/**
 * Extracts the given name (tên chính / last token) from a normalized Vietnamese name.
 * In Vietnamese naming conventions (Họ + Đệm + Tên), the given name is the final word.
 */
export function extractGivenName(normName: string): string {
  const parts = normName.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

/**
 * Extracts a searchable phone query substring if and only if the search input
 * represents a valid full or partial phone number.
 *
 * Rules:
 * 1. If raw search normalizes to a valid 10-digit Vietnamese mobile phone, returns canonical phone ('0xxxxxxxxx').
 * 2. If raw search contains alphabetical letters (e.g. "Bàn 1", "Nhóm 2", "Bác Ba 2"), returns null
 *    (preventing accidental database-wide phone wildcard matching on name/table searches).
 * 3. If raw search consists only of digits/separators, requires at least 4 digits (e.g. "4567", "0901")
 *    to prevent single-digit ("1") or double-digit ("09") wildcard leakage.
 * 4. Otherwise returns null.
 */
export function extractSearchablePhone(search: string | null | undefined): string | null {
  if (!search) return null;
  const trimmed = search.trim();
  if (!trimmed) return null;

  // 1. Full valid Vietnamese phone number (+84..., 09..., etc.)
  const fullPhone = normalizeVietnamesePhone(trimmed);
  if (fullPhone) return fullPhone;

  // 2. Check if search contains any Latin or Vietnamese word letters
  const norm = normalizeSearchTerm(trimmed);
  const hasLetters = /[a-z]/i.test(norm);
  if (hasLetters) {
    return null;
  }

  // 3. Partial phone search: digits only, must be at least 4 digits
  const cleanDigits = trimmed.replace(/\D/g, '');
  if (cleanDigits.length >= 4) {
    return cleanDigits;
  }

  return null;
}

/**
 * Calculates Levenshtein edit distance between two strings.
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export interface CandidateGuestInput {
  id: string;
  displayName: string;
  phone?: string | null;
  email?: string | null;
  groupId?: string | null;
  address?: string | null;
  side?: string | null;
  subTags?: string[];
  isArchived?: boolean;
}

export interface DuplicateEvaluationResult {
  guestA: CandidateGuestInput;
  guestB: CandidateGuestInput;
  similarityScore: number;
  matchReasons: string[];
  isCandidate: boolean;
}

/**
 * Evaluates duplicate candidate likelihood between two guest records.
 *
 * CRITICAL DOMAIN RULE (AT08):
 * Shared Family Phone Exception:
 * In Vietnamese families, husbands, wives, and children frequently share a contact phone.
 * Matching phone ALONE with different names MUST NOT be classified as a duplicate candidate.
 * (Qualification requires score >= 0.70).
 */
export function evaluateDuplicatePair(
  a: CandidateGuestInput,
  b: CandidateGuestInput
): DuplicateEvaluationResult {
  const normNameA = normalizeSearchTerm(a.displayName);
  const normNameB = normalizeSearchTerm(b.displayName);

  const levDist = calculateLevenshteinDistance(normNameA, normNameB);
  const maxLen = Math.max(normNameA.length, normNameB.length) || 1;
  const nameSim = 1 - levDist / maxLen;
  const isExactName = normNameA === normNameB;

  const phoneA = normalizeVietnamesePhone(a.phone);
  const phoneB = normalizeVietnamesePhone(b.phone);
  const isPhoneMatch = phoneA !== null && phoneB !== null && phoneA === phoneB;

  const emailA = a.email?.trim().toLowerCase() || null;
  const emailB = b.email?.trim().toLowerCase() || null;
  const isEmailMatch = emailA !== null && emailB !== null && emailA === emailB;

  const isGroupMatch = a.groupId !== null && b.groupId !== null && a.groupId === b.groupId;

  // Sibling / Family Member Safeguard: extract given names (tên chính)
  const givenNameA = extractGivenName(normNameA);
  const givenNameB = extractGivenName(normNameB);
  const isGivenNameMatch = givenNameA !== '' && givenNameB !== '' && givenNameA === givenNameB;

  let score = 0;
  const matchReasons: string[] = [];

  if (isExactName) {
    if (isPhoneMatch) {
      score = 0.95;
      matchReasons.push('Trùng tên chuẩn hóa và số điện thoại');
    } else if (isEmailMatch) {
      score = 0.95;
      matchReasons.push('Trùng tên chuẩn hóa và email');
    } else if (isGroupMatch) {
      score = 0.85;
      matchReasons.push('Trùng tên chuẩn hóa và cùng nhóm quan hệ');
    } else {
      score = 0.60;
      matchReasons.push('Trùng tên chuẩn hóa (khác thông tin liên hệ)');
    }
  } else if (nameSim >= 0.70) {
    if (isGivenNameMatch) {
      // High name similarity AND identical given name (e.g. "Nguyễn Tuấn" vs "Nguyễn Văn Tuấn")
      if (isPhoneMatch) {
        score = 0.85;
        matchReasons.push('Tên tương đồng cao và trùng số điện thoại');
      } else if (isEmailMatch) {
        score = 0.85;
        matchReasons.push('Tên tương đồng cao và trùng email');
      } else if (isGroupMatch) {
        score = 0.70;
        matchReasons.push('Tên tương đồng cao và cùng nhóm quan hệ');
      } else {
        score = 0.50;
        matchReasons.push('Tên tương đồng');
      }
    } else {
      // High name similarity BUT different given names (e.g. siblings "Nguyễn Văn Ba" vs "Nguyễn Văn Bi")
      // Sharing phone or email is the classic Shared Family Contact Exception
      if (isPhoneMatch) {
        score = 0.35;
        matchReasons.push('Dùng chung số điện thoại gia đình');
      } else if (isEmailMatch) {
        score = 0.35;
        matchReasons.push('Dùng chung email gia đình');
      } else if (isGroupMatch) {
        score = 0.30;
        matchReasons.push('Cùng nhóm quan hệ nhưng khác tên chính');
      } else {
        score = 0.20;
        matchReasons.push('Họ đệm tương đồng nhưng khác tên chính');
      }
    }
  } else {
    // Shared family phone exception: different names sharing a phone number
    if (isPhoneMatch) {
      score = 0.35;
      matchReasons.push('Dùng chung số điện thoại gia đình');
    } else if (isEmailMatch) {
      score = 0.35;
      matchReasons.push('Dùng chung email gia đình');
    } else {
      score = 0.10;
    }
  }

  return {
    guestA: a,
    guestB: b,
    similarityScore: score,
    matchReasons,
    isCandidate: score >= 0.70,
  };
}

/**
 * Scans a list of active guests and detects all candidate duplicate pairs.
 */
export function findDuplicateCandidates(
  guests: CandidateGuestInput[]
): DuplicateEvaluationResult[] {
  const active = guests.filter((g) => !g.isArchived);
  const candidates: DuplicateEvaluationResult[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const evaluation = evaluateDuplicatePair(active[i], active[j]);
      if (evaluation.isCandidate) {
        candidates.push(evaluation);
      }
    }
  }

  return candidates.sort((a, b) => b.similarityScore - a.similarityScore);
}
