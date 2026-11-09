import { describe, it, expect } from 'vitest';
import {
  // Common
  sanitizedTextSchema,
  uuidSchema,
  // Auth
  weddingSettingsFamilyDtoSchema,
  weddingSettingsOwnerDtoSchema,
  // Guests
  guestFamilyDtoSchema,
  guestOwnerDtoSchema,
  mergeGuestsSchema,
  // Tasks
  taskFamilyDtoSchema,
  taskOwnerDtoSchema,
  toTaskFamilyDto,
  createTaskDependencySchema,
  // Files
  attachmentFamilyDtoSchema,
  attachmentOwnerDtoSchema,
} from '../../../src/schemas';
import { sanitizeCsvField, FORMULA_DANGEROUS_PREFIXES, validateStorageKey } from '../../helpers/security';
import { sanitizeGuestForRole, TEST_USERS } from '../../helpers/auth';

describe('Adversarial Stress Test: Area 1 - Role Isolation & DTO Privacy Projections', () => {
  it('fuzzes guestFamilyDtoSchema: strips sensitive fields when present in input', () => {
    const sensitivePayload = {
      id: '11111111-1111-4111-8111-111111111111',
      display_name: 'Nguyễn Văn VIP',
      side: 'groom' as const,
      group_id: '22222222-2222-4222-8222-222222222222',
      sub_tags: ['VIP', 'Họ nhà trai'],
      age_tier: 'adult' as const,
      phone: '0901234567',
      email: 'vip@example.com',
      address: '123 Đường VIP, Phường 1, TP.HCM',
      private_notes: 'Ghi chú tối mật: Khách không uống rượu, mừng phong bì 50 triệu',
      is_archived: false,
      archived_at: null,
      is_placeholder: false,
      placeholder_for: null,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Injected rogue fields:
      budget_target: '500000000',
      storage_key: '/data/uploads/confidential/guest_id_card.jpg',
      credit_card: '4111222233334444',
    };

    const parsed = guestFamilyDtoSchema.parse(sensitivePayload);
    const parsedObj = parsed as Record<string, unknown>;

    // Verify 100% masking of sensitive fields:
    expect(parsedObj.phone).toBeUndefined();
    expect(parsedObj.email).toBeUndefined();
    expect(parsedObj.address).toBeUndefined();
    expect(parsedObj.private_notes).toBeUndefined();
    expect(parsedObj.is_archived).toBeUndefined();
    expect(parsedObj.archived_at).toBeUndefined();
    expect(parsedObj.budget_target).toBeUndefined();
    expect(parsedObj.storage_key).toBeUndefined();
    expect(parsedObj.credit_card).toBeUndefined();

    // Verify public fields are retained:
    expect(parsed.display_name).toBe('Nguyễn Văn VIP');
    expect(parsed.side).toBe('groom');
    expect(parsed.age_tier).toBe('adult');
  });

  it('fuzzes weddingSettingsFamilyDtoSchema: strips budget_target and contingency_budget', () => {
    const sensitiveSettings = {
      id: '33333333-3333-4333-8333-333333333333',
      bride_name: 'Trần Thị Cô Dâu',
      groom_name: 'Nguyễn Văn Chú Rể',
      short_title: 'Đám Cưới Minh & Lan',
      tentative_date_note: 'Dự kiến tháng 12/2026',
      is_date_confirmed: true,
      representative_event_id: '44444444-4444-4444-8444-444444444444',
      budget_target: '300000000',
      contingency_budget: '50000000',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Injected sensitive fields:
      bank_account: '999988887777',
      storage_key: '/data/uploads/contracts/wedding_venue.pdf',
    };

    const parsed = weddingSettingsFamilyDtoSchema.parse(sensitiveSettings);
    const parsedObj = parsed as Record<string, unknown>;

    expect(parsedObj.budget_target).toBeUndefined();
    expect(parsedObj.contingency_budget).toBeUndefined();
    expect(parsedObj.bank_account).toBeUndefined();
    expect(parsedObj.storage_key).toBeUndefined();

    expect(parsed.bride_name).toBe('Trần Thị Cô Dâu');
    expect(parsed.groom_name).toBe('Nguyễn Văn Chú Rể');
  });

  it('fuzzes attachmentFamilyDtoSchema: strips server storage_key and internal metadata', () => {
    const sensitiveAttachment = {
      id: '55555555-5555-4555-8555-555555555555',
      storage_key: '/data/uploads/2026/11/secret_contract.pdf',
      original_name: 'HopDong_TiecCuoi.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 1048576,
      width: null,
      height: null,
      checksum_sha256: 'a'.repeat(64),
      is_private: true,
      owner_only: true,
      entity_type: 'cost_item' as const,
      entity_id: '66666666-6666-4666-8666-666666666666',
      processing_status: 'ready' as const,
      error_message: null,
      uploader_user_id: 'usr00000-0000-4000-8000-000000000001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsed = attachmentFamilyDtoSchema.parse(sensitiveAttachment);
    const parsedObj = parsed as Record<string, unknown>;

    expect(parsedObj.storage_key).toBeUndefined();
    expect(parsedObj.file_size_bytes).toBeUndefined();
    expect(parsedObj.uploader_user_id).toBeUndefined();
    expect(parsedObj.checksum_sha256).toBeUndefined();
    expect(parsed.original_name).toBe('HopDong_TiecCuoi.pdf');
  });

  it('neutralizes internal title and private notes in taskFamilyDtoSchema when fed task record directly (AT59)', () => {
    const internalTaskRecord = {
      id: '77777777-7777-4777-8777-777777777777',
      title: 'INTERNAL PRIVATE: Thương lượng giảm giá bí mật với nhà hàng tiệc cưới',
      category: 'Tiệc Cưới',
      event_id: '88888888-8888-4888-8888-888888888888',
      in_charge_user_id: 'usr00000-0000-4000-8000-000000000001',
      priority: 'high' as const,
      status: 'in_progress' as const,
      deadline_type: 'fixed_date' as const,
      computed_due_date: '2026-11-20T00:00:00Z',
      is_waiting_official_date: false,
      private_notes: 'Bí mật không cho người nhà biết: Sẽ ép giá thêm 5%',
      shared_with_family: true,
      shared_public_title: 'PUBLIC: Chốt thực đơn tiệc cưới',
      shared_public_notes: 'Thực đơn 10 món cho họ hàng',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsed = taskFamilyDtoSchema.parse(internalTaskRecord);

    // Verify internal title is completely hidden, public title is mapped:
    expect(parsed.title).not.toContain('INTERNAL PRIVATE');
    expect(parsed.title).toBe('PUBLIC: Chốt thực đơn tiệc cưới');
    expect(parsed.notes).toBe('Thực đơn 10 món cho họ hàng');
    expect((parsed as Record<string, unknown>).private_notes).toBeUndefined();
    expect((parsed as Record<string, unknown>).in_charge_user_id).toBeUndefined();

    // Verify toTaskFamilyDto mapping helper:
    const helperMapped = toTaskFamilyDto(internalTaskRecord);
    expect(helperMapped.title).toBe('PUBLIC: Chốt thực đơn tiệc cưới');
    expect(helperMapped.notes).toBe('Thực đơn 10 món cho họ hàng');
  });

  it('masks snake_case private_notes to Family role in sanitizeGuestForRole (AT03)', () => {
    // Database and DTO records use snake_case `private_notes`.
    const dbGuestRecord = {
      id: '99999999-9999-4999-8999-999999999999',
      displayName: 'Khách Họ Nhà Gái',
      phone: '0912345678',
      email: 'khach@example.com',
      address: '456 Le Loi, Q1',
      private_notes: 'Ghi chú tuyệt mật từ DB: Cần xếp xa bàn họ nhà trai',
    };

    const sanitized = sanitizeGuestForRole(dbGuestRecord as any, 'family_view') as any;

    expect(sanitized.phone).toBeNull();
    expect(sanitized.email).toBeNull();
    expect(sanitized.address).toBeNull();
    expect(sanitized.private_notes).toBeNull();
  });
});

describe('Adversarial Stress Test: Area 2 - Formula Injection Payload Fuzzing', () => {
  const dangerousBasicPayloads = [
    '=1+1',
    '@SUM(A1:A10)',
    '+cmd|\' /C calc\'!A0',
    '-2+3',
    '\t=cmd',
    '\r\n=1+1',
  ];

  it('neutralizes standard dangerous formula prefixes in sanitizedTextSchema', () => {
    const schema = sanitizedTextSchema(255);
    for (const payload of dangerousBasicPayloads) {
      const sanitized = schema.parse(payload);
      expect(sanitized.startsWith("'")).toBe(true);
    }
  });

  it('neutralizes standard dangerous formula prefixes in sanitizeCsvField', () => {
    for (const payload of dangerousBasicPayloads) {
      const sanitized = sanitizeCsvField(payload);
      expect(sanitized.startsWith("'")).toBe(true);
    }
  });

  it('neutralizes leading space in sanitizedTextSchema formula defense (AT29)', () => {
    const schema = sanitizedTextSchema(255);

    const spacePayloads = [
      ' =1+1',
      '   =1+1',
      '  @SUM(A1:A10)',
      '  +cmd|\' /C calc\'!A0',
      '  -2+3',
    ];

    for (const payload of spacePayloads) {
      const result = schema.parse(payload);
      expect(result.startsWith("'")).toBe(true);
    }
  });

  it('neutralizes leading space in sanitizeCsvField formula defense (AT29)', () => {
    const spacePayloads = [
      ' =1+1',
      '   =1+1',
      '  @SUM(A1:A10)',
      '  +cmd|\' /C calc\'!A0',
    ];

    for (const payload of spacePayloads) {
      const result = sanitizeCsvField(payload);
      expect(result.startsWith("'")).toBe(true);
    }
  });

  it('neutralizes lone newline (LF: \\n) in sanitizedTextSchema formula defense (AT29)', () => {
    const schema = sanitizedTextSchema(255);
    const lfPayload = '\n=1+1';

    const result = schema.parse(lfPayload);
    expect(result).toBe("'=1+1");
    expect(result.startsWith("'")).toBe(true);
  });

  it('VULNERABILITY PROBE: Unicode lookalike formulas are not neutralized', () => {
    const schema = sanitizedTextSchema(255);
    const unicodeLookalikes = [
      { name: 'Fullwidth Equals', payload: '\uFF1D1+1' },        // ＝1+1
      { name: 'Fullwidth Plus', payload: '\uFF0B1+1' },          // ＋1+1
      { name: 'Fullwidth Hyphen', payload: '\uFF0D1+1' },        // －1+1
      { name: 'Fullwidth Commercial At', payload: '\uFF20SUM(A1:A10)' }, // ＠SUM(A1:A10)
      { name: 'Small Equals', payload: '\uFE661+1' },            // ﹦1+1
      { name: 'Small Hyphen', payload: '\uFE631+1' },            // ﹣1+1
      { name: 'Small Plus', payload: '\uFE621+1' },              // ﹢1+1
    ];

    for (const item of unicodeLookalikes) {
      const sanitized = schema.parse(item.payload);
      // None of the unicode lookalikes are neutralized
      expect(sanitized.startsWith("'")).toBe(false);
      expect(sanitizeCsvField(item.payload).startsWith("'")).toBe(false);
    }
  });

  it('VULNERABILITY PROBE: Multiline CRLF cell splits into unescaped formula in CSV', () => {
    const multilinePayload = 'Safe text\r\n=1+1';
    const csvSanitized = sanitizeCsvField(multilinePayload);

    // Because firstChar is 'S' (safe), sanitizeCsvField does nothing
    expect(csvSanitized).toBe('Safe text\r\n=1+1');
    // When saved to CSV and opened in Excel, line 2 begins with '=1+1' and executes!
    const lines = csvSanitized.split(/\r?\n/);
    expect(lines[1].startsWith('=')).toBe(true);
    expect(lines[1].startsWith("'")).toBe(false);
  });
});

describe('Adversarial Stress Test: Area 3 - Task Self-Dependencies & Cycles', () => {
  it('correctly rejects identical lowercase UUID in createTaskDependencySchema', () => {
    const taskId = 'c1c68f2e-3c94-4d22-b51f-6be6f2dca587';
    const res = createTaskDependencySchema.safeParse({
      dependent_task_id: taskId,
      prerequisite_task_id: taskId,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('Một công việc không thể phụ thuộc vào chính nó');
    }
  });

  it('rejects self-dependency with uppercase/mixed-case UUID variation in createTaskDependencySchema', () => {
    const lowerId = 'c1c68f2e-3c94-4d22-b51f-6be6f2dca587';
    const upperId = 'C1C68F2E-3C94-4D22-B51F-6BE6F2DCA587';

    expect(uuidSchema.safeParse(lowerId).success).toBe(true);
    expect(uuidSchema.safeParse(upperId).success).toBe(true);
    expect(uuidSchema.parse(upperId)).toBe(lowerId);

    const res = createTaskDependencySchema.safeParse({
      dependent_task_id: lowerId,
      prerequisite_task_id: upperId,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('Một công việc không thể phụ thuộc vào chính nó');
    }
  });
});

describe('Adversarial Stress Test: Area 4 - Guest Self-Merges', () => {
  it('correctly rejects identical lowercase UUID in mergeGuestsSchema', () => {
    const guestId = '10000000-0000-4000-8000-000000000001';
    const res = mergeGuestsSchema.safeParse({
      retained_guest_id: guestId,
      merged_guest_id: guestId,
      resolved_phone: null,
      resolved_email: null,
      resolved_address: null,
      attendance_conflict_resolutions: [],
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('Bản ghi giữ lại và bản ghi gộp phải là hai người khác nhau');
    }
  });

  it('rejects self-merge with uppercase/mixed-case UUID variation in mergeGuestsSchema', () => {
    const lowerId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
    const upperId = 'A1B2C3D4-E5F6-4A1B-8C2D-3E4F5A6B7C8D';

    expect(uuidSchema.safeParse(lowerId).success).toBe(true);
    expect(uuidSchema.safeParse(upperId).success).toBe(true);
    expect(uuidSchema.parse(upperId)).toBe(lowerId);

    const res = mergeGuestsSchema.safeParse({
      retained_guest_id: lowerId,
      merged_guest_id: upperId,
      resolved_phone: null,
      resolved_email: null,
      resolved_address: null,
      attendance_conflict_resolutions: [],
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('Bản ghi giữ lại và bản ghi gộp phải là hai người khác nhau');
    }
  });

  it('rejects payload when source_guest_id / target_guest_id naming mismatch occurs', () => {
    const guestId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
    const res = mergeGuestsSchema.safeParse({
      source_guest_id: guestId,
      target_guest_id: guestId,
    });
    // Schema expects retained_guest_id and merged_guest_id
    expect(res.success).toBe(false);
  });
});

describe('Adversarial Stress Test: Area 5 - UUID Format & Storage Security Projections', () => {
  it('rejects non-hexadecimal characters in uuidSchema to prevent PostgreSQL crash', () => {
    // PostgreSQL UUID requires valid hex characters [0-9a-fA-F].
    const nonHexUuid = 'zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz';
    const res = uuidSchema.safeParse(nonHexUuid);

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('Định dạng ID không hợp lệ (yêu cầu UUID v4)');
    }
  });

  it('validates validateStorageKey against canonical upload path in tests and system', () => {
    const canonicalKey = '/data/uploads/2026/04/contract_diamond.pdf';

    const isValid = validateStorageKey(canonicalKey);
    expect(isValid).toBe(true);

    // Meanwhile, relative safe keys pass:
    expect(validateStorageKey('2026/04/contract_diamond.pdf')).toBe(true);
    // Path traversal is blocked:
    expect(validateStorageKey('../../../etc/passwd')).toBe(false);
    expect(validateStorageKey('safe/path/\0nullbyte')).toBe(false);
    expect(validateStorageKey('/absolute/path/file.jpg')).toBe(false);
  });
});

