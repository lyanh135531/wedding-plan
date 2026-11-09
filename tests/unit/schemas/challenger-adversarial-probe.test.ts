import { describe, it, expect } from 'vitest';
import {
  sanitizedTextSchema,
  uuidSchema,
  taskFamilyDtoSchema,
  toTaskFamilyDto,
  createTaskDependencySchema,
  mergeGuestsSchema,
  guestFamilyDtoSchema,
  weddingSettingsFamilyDtoSchema,
  attachmentFamilyDtoSchema,
} from '../../../src/schemas';
import { sanitizeCsvField, validateStorageKey, FORMULA_DANGEROUS_PREFIXES } from '../../helpers/security';
import { sanitizeGuestForRole } from '../../helpers/auth';

describe('CHALLENGER Probe 1: Formula Injection & Whitespace / Control Prefix Evasion', () => {
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r', '\n'];
  const testPayloads = [
    '  =SUM(A1)',
    '\t=cmd',
    '\r\n+1',
    '   @HYPERLINK',
    '\t\t-calc',
    '\n=cmd',
    '\r=cmd',
    ' \t =cmd',
    '   +12345',
    ' -100',
    '  \t  \r  @alert',
    ' \r\n =1+1',
    '   \t   @SUM(B1:B10)',
    '\u00A0=SUM(A1)', // Non-breaking space + formula
    '    \t\r\n-malicious',
  ];

  it('empirically verifies sanitizedTextSchema neutralizes all whitespace & control character variations', () => {
    const schema = sanitizedTextSchema(255);

    for (const payload of testPayloads) {
      const sanitized = schema.parse(payload);
      expect(
        sanitized.startsWith("'"),
        `Expected payload [${JSON.stringify(payload)}] to be prefixed with apostrophe, got [${sanitized}]`
      ).toBe(true);
    }
  });

  it('empirically verifies sanitizeCsvField neutralizes all whitespace & control character variations', () => {
    for (const payload of testPayloads) {
      const sanitized = sanitizeCsvField(payload);
      expect(
        sanitized.startsWith("'"),
        `Expected CSV field [${JSON.stringify(payload)}] to be prefixed with apostrophe, got [${sanitized}]`
      ).toBe(true);
    }
  });

  it('empirically probes formula evasion with leading apostrophe already present', () => {
    const schema = sanitizedTextSchema(255);
    const alreadySafe = "'=SUM(A1)";
    const res = schema.parse(alreadySafe);
    expect(res.startsWith("'")).toBe(true);
    // Should not double-escape if already safe
    expect(res).toBe("'=SUM(A1)");
  });

  it('probes edge cases: empty strings, pure whitespace, safe words', () => {
    const schema = sanitizedTextSchema(255);
    expect(schema.parse('')).toBe('');
    expect(schema.parse('   ')).toBe('');
    expect(schema.parse('Normal wedding plan')).toBe('Normal wedding plan');
    expect(sanitizeCsvField('')).toBe('');
    expect(sanitizeCsvField(null)).toBe('');
    expect(sanitizeCsvField(undefined)).toBe('');
  });
});

describe('CHALLENGER Probe 2: Mixed-Case UUID Evasion in Self-Dependency & Self-Merge', () => {
  const baseUuid = 'e5b6c3d4-1234-4567-890a-bcdef0123456';
  const upperUuid = 'E5B6C3D4-1234-4567-890A-BCDEF0123456';
  const mixedUuid1 = 'e5B6c3D4-1234-4567-890A-bcDEF0123456';
  const mixedUuid2 = 'E5b6C3d4-1234-4567-890a-BCdef0123456';

  it('empirically confirms uuidSchema normalizes uppercase to lowercase and validates RFC 4122 hex', () => {
    const parsedUpper = uuidSchema.parse(upperUuid);
    expect(parsedUpper).toBe(baseUuid);

    const parsedMixed = uuidSchema.parse(mixedUuid1);
    expect(parsedMixed).toBe(baseUuid);

    // Non-hex letter 'g' must be rejected
    const nonHex = 'g5b6c3d4-1234-4567-890a-bcdef0123456';
    expect(uuidSchema.safeParse(nonHex).success).toBe(false);

    // Non-hex letter 'z' in upper case must be rejected
    const nonHexUpper = 'Z5B6C3D4-1234-4567-890A-BCDEF0123456';
    expect(uuidSchema.safeParse(nonHexUpper).success).toBe(false);
  });

  it('empirically confirms createTaskDependencySchema blocks mixed-case self-dependencies', () => {
    const testPairs = [
      { dep: baseUuid, pre: baseUuid },
      { dep: baseUuid, pre: upperUuid },
      { dep: upperUuid, pre: baseUuid },
      { dep: mixedUuid1, pre: mixedUuid2 },
      { dep: `  ${baseUuid}  `, pre: upperUuid },
    ];

    for (const pair of testPairs) {
      const res = createTaskDependencySchema.safeParse({
        dependent_task_id: pair.dep,
        prerequisite_task_id: pair.pre,
      });
      expect(
        res.success,
        `Expected self-dependency rejection for dep=[${pair.dep}], pre=[${pair.pre}]`
      ).toBe(false);
    }
  });

  it('empirically confirms mergeGuestsSchema blocks mixed-case self-merges', () => {
    const testPairs = [
      { retained: baseUuid, merged: baseUuid },
      { retained: baseUuid, merged: upperUuid },
      { retained: upperUuid, merged: baseUuid },
      { retained: mixedUuid1, merged: mixedUuid2 },
      { retained: `  ${baseUuid}  `, merged: upperUuid },
    ];

    for (const pair of testPairs) {
      const res = mergeGuestsSchema.safeParse({
        retained_guest_id: pair.retained,
        merged_guest_id: pair.merged,
        resolved_phone: null,
        resolved_email: null,
        resolved_address: null,
        attendance_conflict_resolutions: [],
      });
      expect(
        res.success,
        `Expected self-merge rejection for retained=[${pair.retained}], merged=[${pair.merged}]`
      ).toBe(false);
    }
  });
});

describe('CHALLENGER Probe 3: Storage Key Path Traversal Evasion Attacks', () => {
  const maliciousKeys = [
    '..',
    '../',
    '..\\',
    '../../',
    '../../../etc/passwd',
    '/data/uploads/../../../etc/passwd',
    '/data/uploads/..',
    '/data/uploads/../',
    '/data/uploads/2026/04/../../secret.txt',
    'data/uploads/../../../etc/passwd',
    '/data/uploads/2026/file.jpg\0.exe',
    'safe/path/\0nullbyte',
    '%2e%2e%2f',
    '%2e%2e/',
    '..%2f',
    '/data/uploads/%2e%2e/passwd',
    '/data/uploads/%2fetc%2fpasswd',
    '/data/uploads/%5cwindows%5cwin.ini',
    '..\\..\\windows\\win.ini',
    'C:\\boot.ini',
    '/etc/passwd',
    '/var/log/syslog',
    '/tmp/exploit.sh',
    '/root/.ssh/id_rsa',
    '/data/uploads/',
    '/data/uploads/2026/04/',
    '/data/uploads/file;rm -rf /',
    '/data/uploads/$(id).jpg',
    '/data/uploads/`whoami`.png',
    '/data/uploads/file with spaces.pdf', // spaces not in safe charset
  ];

  const legitimateKeys = [
    '/data/uploads/2026/04/contract_diamond.pdf',
    '/data/uploads/2026/11/receipt_123.jpg',
    '2026/04/contract_diamond.pdf',
    'attachments/invitation_card.png',
    'photos/pre_wedding_01.webp',
  ];

  it('empirically verifies validateStorageKey rejects ALL 30 malicious traversal and injection vectors', () => {
    for (const key of maliciousKeys) {
      const isAllowed = validateStorageKey(key);
      expect(
        isAllowed,
        `SECURITY BREACH: Traversal vector [${JSON.stringify(key)}] was NOT blocked!`
      ).toBe(false);
    }
  });

  it('empirically verifies validateStorageKey accepts legitimate canonical and relative storage keys', () => {
    for (const key of legitimateKeys) {
      const isAllowed = validateStorageKey(key);
      expect(
        isAllowed,
        `FALSE POSITIVE: Legitimate storage key [${key}] was blocked!`
      ).toBe(true);
    }
  });
});

describe('CHALLENGER Probe 4: Privacy Leakage Across Roles & DTOs', () => {
  const dummyTaskId = '77777777-7777-4777-8777-777777777777';
  const dummyEventId = '88888888-8888-4888-8888-888888888888';

  it('rejects raw database row when shared_with_family is false in taskFamilyDtoSchema', () => {
    const unsharedRow = {
      id: dummyTaskId,
      title: 'TOP SECRET INTERNAL: Chuẩn bị phong bì vàng',
      shared_with_family: false,
      shared_public_title: 'Công việc nội bộ',
      priority: 'high' as const,
      status: 'in_progress' as const,
      deadline_type: 'fixed_date' as const,
      is_waiting_official_date: false,
      notes: 'Ghi chú riêng tư',
    };

    expect(() => taskFamilyDtoSchema.parse(unsharedRow)).toThrow(
      'Công việc này không được chia sẻ cho người nhà'
    );
  });

  it('rejects unshared task in toTaskFamilyDto mapping helper', () => {
    const unsharedTask = {
      id: dummyTaskId,
      title: 'TOP SECRET INTERNAL',
      shared_with_family: false,
      priority: 'high' as const,
      status: 'in_progress' as const,
      deadline_type: 'fixed_date' as const,
    };

    expect(() => toTaskFamilyDto(unsharedTask)).toThrow(
      'Công việc này không được chia sẻ cho người nhà'
    );
  });

  it('neutralizes internal title, private_notes, and internal metadata when shared_with_family is true', () => {
    const rawDbRow = {
      id: dummyTaskId,
      title: 'INTERNAL HIGH RISK: Thương lượng giảm giá bí mật 50%',
      category: 'Tài chính tiệc',
      event_id: dummyEventId,
      in_charge_user_id: 'usr00000-0000-4000-8000-000000000001',
      support_contacts: ['Chú Rể', '0912345678'],
      priority: 'urgent' as const,
      status: 'in_progress' as const,
      deadline_type: 'fixed_date' as const,
      fixed_date: '2026-11-20',
      fixed_datetime: '2026-11-20T10:00:00Z',
      relative_event_id: dummyEventId,
      relative_offset_days: 10,
      relative_direction: 'before' as const,
      pinned_manual: true,
      private_notes: 'Tuyệt đối không để họ hàng biết số tiền này',
      shared_with_family: true,
      shared_public_title: 'PUBLIC: Đặt tiệc cưới nhà hàng Diamond',
      shared_public_notes: 'Thực đơn tiệc 10 bàn',
      computed_due_date: '2026-11-20T10:00:00Z',
      is_waiting_official_date: false,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsed = taskFamilyDtoSchema.parse(rawDbRow);
    const parsedObj = parsed as Record<string, unknown>;

    // 1. Title verification:
    expect(parsed.title).toBe('PUBLIC: Đặt tiệc cưới nhà hàng Diamond');
    expect(parsed.title).not.toContain('INTERNAL HIGH RISK');

    // 2. Notes verification:
    expect(parsed.notes).toBe('Thực đơn tiệc 10 bàn');
    expect(parsed.notes).not.toContain('Tuyệt đối không để họ hàng biết');

    // 3. Sensitive fields must be stripped (undefined):
    expect(parsedObj.private_notes).toBeUndefined();
    expect(parsedObj.in_charge_user_id).toBeUndefined();
    expect(parsedObj.support_contacts).toBeUndefined();
    expect(parsedObj.pinned_manual).toBeUndefined();
    expect(parsedObj.shared_with_family).toBeUndefined();
    expect(parsedObj.shared_public_title).toBeUndefined();
    expect(parsedObj.shared_public_notes).toBeUndefined();
    expect(parsedObj.fixed_date).toBeUndefined();
    expect(parsedObj.relative_offset_days).toBeUndefined();
  });

  it('neutralizes internal title when shared_public_title is null or empty', () => {
    const rawDbRow = {
      id: dummyTaskId,
      title: 'CONFIDENTIAL TITLE THAT MUST NEVER LEAK',
      shared_with_family: true,
      shared_public_title: null,
      shared_public_notes: null,
      priority: 'normal' as const,
      status: 'not_started' as const,
      deadline_type: 'fixed_date' as const,
      is_waiting_official_date: false,
      notes: null,
    };

    const parsed = taskFamilyDtoSchema.parse(rawDbRow);
    expect(parsed.title).toBe('Công việc chung');
    expect(parsed.title).not.toContain('CONFIDENTIAL');
  });

  it('masks private information in sanitizeGuestForRole for family_view, anonymous, revoked', () => {
    const guestData = {
      id: '99999999-9999-4999-8999-999999999999',
      displayName: 'Khách VIP',
      phone: '0909123456',
      email: 'vip@wedding.vn',
      address: '789 Nguyễn Huệ, Q1',
      privateNotes: 'Ghi chú lạc đà camelCase bí mật',
      private_notes: 'Ghi chú con rắn snake_case tuyệt mật',
    };

    // 1. Role: owner -> retains all
    const ownerView = sanitizeGuestForRole(guestData, 'owner');
    expect(ownerView.phone).toBe('0909123456');
    expect(ownerView.email).toBe('vip@wedding.vn');
    expect(ownerView.address).toBe('789 Nguyễn Huệ, Q1');
    expect(ownerView.privateNotes).toBe('Ghi chú lạc đà camelCase bí mật');
    expect(ownerView.private_notes).toBe('Ghi chú con rắn snake_case tuyệt mật');

    // 2. Role: family_view -> masked to null
    const familyView = sanitizeGuestForRole(guestData, 'family_view');
    expect(familyView.phone).toBeNull();
    expect(familyView.email).toBeNull();
    expect(familyView.address).toBeNull();
    expect(familyView.privateNotes).toBeNull();
    expect(familyView.private_notes).toBeNull();
    expect(familyView.displayName).toBe('Khách VIP');

    // 3. Role: revoked -> masked to null
    const revokedView = sanitizeGuestForRole(guestData, 'revoked');
    expect(revokedView.phone).toBeNull();
    expect(revokedView.email).toBeNull();
    expect(revokedView.privateNotes).toBeNull();
    expect(revokedView.private_notes).toBeNull();

    // 4. Role: anonymous -> masked to null
    const anonView = sanitizeGuestForRole(guestData, 'anonymous');
    expect(anonView.phone).toBeNull();
    expect(anonView.email).toBeNull();
    expect(anonView.privateNotes).toBeNull();
    expect(anonView.private_notes).toBeNull();
  });
});

describe('CHALLENGER Probe 5: Intensive 1,200-Iteration Adversarial Fuzzing Harness', () => {
  it('runs 1,200 intensive fuzz iterations combining formula, casing, traversal, and role privacy vectors', () => {
    let formulaBypasses = 0;
    let dependencyCasingBypasses = 0;
    let mergeCasingBypasses = 0;
    let traversalBypasses = 0;
    let privacyLeaks = 0;

    const schema = sanitizedTextSchema(255);
    const prefixes = ['=', '+', '-', '@', '\t', '\r', '\n'];
    const whitespaceHeaders = [' ', '  ', '   ', '\t', ' \t ', '  \r\n  ', ''];
    const payloads = ['cmd|\' /C calc\'!A0', 'SUM(A1:Z100)', '10+20', 'HYPERLINK("http://evil.com")'];

    for (let i = 0; i < 1200; i++) {
      const hex = i.toString(16).padStart(12, '0');
      const uuidLower = `a0000000-0000-4000-8000-${hex}`;
      const uuidUpper = uuidLower.toUpperCase();

      // 1. Formula Injection Fuzz:
      const ws = whitespaceHeaders[i % whitespaceHeaders.length];
      const pfx = prefixes[i % prefixes.length];
      const payload = payloads[i % payloads.length];
      const formulaCandidate = `${ws}${pfx}${payload}`;
      const sanitized = schema.parse(formulaCandidate);
      if (!sanitized.startsWith("'")) {
        formulaBypasses++;
      }

      // 2. Task Dependency Casing Fuzz:
      const depRes = createTaskDependencySchema.safeParse({
        dependent_task_id: uuidLower,
        prerequisite_task_id: uuidUpper,
      });
      if (depRes.success) {
        dependencyCasingBypasses++;
      }

      // 3. Guest Merge Casing Fuzz:
      const mergeRes = mergeGuestsSchema.safeParse({
        retained_guest_id: uuidUpper,
        merged_guest_id: uuidLower,
        resolved_phone: null,
        resolved_email: null,
        resolved_address: null,
        attendance_conflict_resolutions: [],
      });
      if (mergeRes.success) {
        mergeCasingBypasses++;
      }

      // 4. Storage Key Traversal Fuzz:
      const traversalCandidate = `/data/uploads/${'../'.repeat((i % 4) + 1)}etc/passwd`;
      if (validateStorageKey(traversalCandidate)) {
        traversalBypasses++;
      }

      // 5. Privacy Leak Fuzz:
      const taskRow = {
        id: uuidLower,
        title: `HIGH_SECURITY_LEAK_TARGET_${i}`,
        shared_with_family: true,
        shared_public_title: `Public Title ${i}`,
        private_notes: `Top Secret Note ${i}`,
        priority: 'normal' as const,
        status: 'not_started' as const,
        deadline_type: 'fixed_date' as const,
        is_waiting_official_date: false,
      };
      const parsedTask = taskFamilyDtoSchema.parse(taskRow) as {
        title: string;
        private_notes?: unknown;
      };
      if (
        parsedTask.title.includes('HIGH_SECURITY_LEAK_TARGET') ||
        parsedTask.private_notes !== undefined
      ) {
        privacyLeaks++;
      }
    }

    // Assert 0 bypasses and 0 leaks across 1,200 iterations:
    expect(formulaBypasses).toBe(0);
    expect(dependencyCasingBypasses).toBe(0);
    expect(mergeCasingBypasses).toBe(0);
    expect(traversalBypasses).toBe(0);
    expect(privacyLeaks).toBe(0);
  });
});
