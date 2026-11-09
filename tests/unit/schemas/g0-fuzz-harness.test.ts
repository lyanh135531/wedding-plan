import { describe, it, expect } from 'vitest';
import {
  sanitizedTextSchema,
  uuidSchema,
  weddingSettingsFamilyDtoSchema,
  guestFamilyDtoSchema,
  mergeGuestsSchema,
  taskFamilyDtoSchema,
  createTaskDependencySchema,
  attachmentFamilyDtoSchema,
} from '../../../src/schemas';
import { sanitizeCsvField } from '../../helpers/security';
import { sanitizeGuestForRole } from '../../helpers/auth';

describe('Empirical Fuzz Harness: Gate G0 Privacy & Security Fuzzing (1,000+ iterations)', () => {
  const SENSITIVE_STRINGS = [
    '0901234567',
    '+84987654321',
    'confidential@wedding.vn',
    'Secret private address 123',
    'Private note: Negotiate 20% discount secretly',
    '500000000',
    '/data/uploads/confidential/bank_statement.pdf',
    'Internal only: groom secret',
  ];

  it('Fuzz Generator 1: Role isolation fuzzing on Family DTOs (250 iterations)', () => {
    let guestCleanCount = 0;
    let weddingCleanCount = 0;
    let attachmentCleanCount = 0;
    let taskLeakCount = 0;
    let helperLeakCount = 0;

    for (let i = 0; i < 250; i++) {
      const uuidA = '11111111-1111-4111-8111-' + String(i).padStart(12, '0');
      const randomSensitive = SENSITIVE_STRINGS[i % SENSITIVE_STRINGS.length];

      // 1. Guest Family DTO
      const guestPayload = {
        id: uuidA,
        display_name: `Guest ${i}`,
        side: 'groom' as const,
        age_tier: 'adult' as const,
        phone: randomSensitive,
        email: 'test@example.com',
        address: randomSensitive,
        private_notes: randomSensitive,
        is_archived: false,
        archived_at: null,
        is_placeholder: false,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        budget_target: randomSensitive,
      };
      const parsedGuest = guestFamilyDtoSchema.parse(guestPayload) as Record<string, unknown>;
      if (
        parsedGuest.phone === undefined &&
        parsedGuest.email === undefined &&
        parsedGuest.address === undefined &&
        parsedGuest.private_notes === undefined &&
        parsedGuest.budget_target === undefined
      ) {
        guestCleanCount++;
      }

      // 2. Wedding Settings Family DTO
      const weddingPayload = {
        id: uuidA,
        bride_name: 'Lan',
        groom_name: 'Minh',
        tentative_date_note: 'Tháng 12',
        is_date_confirmed: true,
        budget_target: '300000000',
        contingency_budget: '50000000',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const parsedWedding = weddingSettingsFamilyDtoSchema.parse(weddingPayload) as Record<string, unknown>;
      if (parsedWedding.budget_target === undefined && parsedWedding.contingency_budget === undefined) {
        weddingCleanCount++;
      }

      // 3. Attachment Family DTO
      const attachmentPayload = {
        id: uuidA,
        original_name: 'file.pdf',
        mime_type: 'application/pdf',
        entity_type: 'cost_item' as const,
        storage_key: '/data/uploads/secret.pdf',
        file_size_bytes: 1024,
      };
      const parsedAttachment = attachmentFamilyDtoSchema.parse(attachmentPayload) as Record<string, unknown>;
      if (parsedAttachment.storage_key === undefined && parsedAttachment.file_size_bytes === undefined) {
        attachmentCleanCount++;
      }

      // 4. Task Family DTO Probe (Does it leak internal title?)
      const taskPayload = {
        id: uuidA,
        title: `INTERNAL SECRET TITLE #${i}`,
        priority: 'normal' as const,
        status: 'not_started' as const,
        deadline_type: 'fixed_date' as const,
        is_waiting_official_date: false,
        shared_with_family: true,
        shared_public_title: `PUBLIC TITLE #${i}`,
      };
      const parsedTask = taskFamilyDtoSchema.parse(taskPayload);
      if (parsedTask.title.includes('INTERNAL SECRET')) {
        taskLeakCount++;
      }

      // 5. sanitizeGuestForRole probe with snake_case private_notes
      const rawGuest = {
        phone: '0901234567',
        private_notes: `Confidential note ${i}`,
      };
      const sanitized = sanitizeGuestForRole(rawGuest as any, 'family_view') as any;
      if (sanitized.private_notes) {
        helperLeakCount++;
      }
    }

    expect(guestCleanCount).toBe(250);
    expect(weddingCleanCount).toBe(250);
    expect(attachmentCleanCount).toBe(250);
    // Verified 0% leak rate after remediation:
    expect(taskLeakCount).toBe(0); // 0% leak rate on task title
    expect(helperLeakCount).toBe(0); // 0% leak rate on snake_case private_notes
  });

  it('Fuzz Generator 2: Formula injection fuzzing on sanitizedTextSchema and CSV (300 iterations)', () => {
    const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
    const whitespaceBypasses = [' ', '  ', '\t', '\n', '\r\n', '   '];
    const formulaPayloads = ['1+1', 'SUM(A1:B10)', 'cmd|\' /C calc\'!A0', '2*3'];

    let neutralPrefixCount = 0;
    let spaceBypassCount = 0;
    let lfBypassCount = 0;
    const schema = sanitizedTextSchema(255);

    for (let i = 0; i < 300; i++) {
      const prefix = dangerousPrefixes[i % dangerousPrefixes.length];
      const formula = formulaPayloads[i % formulaPayloads.length];

      // Exact prefix:
      const exactPayload = `${prefix}${formula}`;
      const sanitizedExact = schema.parse(exactPayload);
      if (sanitizedExact.startsWith("'")) {
        neutralPrefixCount++;
      }

      // Leading space bypass:
      const spacePrefix = ' '.repeat((i % 5) + 1);
      const spacePayload = `${spacePrefix}${prefix}${formula}`;
      const sanitizedSpace = schema.parse(spacePayload);
      if (!sanitizedSpace.startsWith("'")) {
        spaceBypassCount++;
      }

      // LF bypass:
      const lfPayload = `\n${prefix}${formula}`;
      const sanitizedLf = schema.parse(lfPayload);
      if (!sanitizedLf.startsWith("'")) {
        lfBypassCount++;
      }
    }

    expect(neutralPrefixCount).toBe(300);
    // Bypasses eliminated after remediation:
    expect(spaceBypassCount).toBe(0);
    expect(lfBypassCount).toBe(0);
  });

  it('Fuzz Generator 3: Task dependency self-dependency casing fuzzing (250 iterations)', () => {
    let lowerRejectedCount = 0;
    let upperBypassCount = 0;

    for (let i = 0; i < 250; i++) {
      const hex = i.toString(16).padStart(12, '0');
      const taskIdLower = `c1c68f2e-3c94-4d22-b51f-${hex}`;
      const taskIdUpper = taskIdLower.toUpperCase();

      // Lower vs Lower (identical) -> Must be rejected
      const resLower = createTaskDependencySchema.safeParse({
        dependent_task_id: taskIdLower,
        prerequisite_task_id: taskIdLower,
      });
      if (!resLower.success) {
        lowerRejectedCount++;
      }

      // Lower vs Upper (same task, different case) -> Must be rejected
      const resUpper = createTaskDependencySchema.safeParse({
        dependent_task_id: taskIdLower,
        prerequisite_task_id: taskIdUpper,
      });
      if (resUpper.success) {
        upperBypassCount++;
      }
    }

    expect(lowerRejectedCount).toBe(250);
    expect(upperBypassCount).toBe(0); // 0% bypass rate due to case-insensitive comparison
  });

  it('Fuzz Generator 4: Guest self-merge casing and identity fuzzing (250 iterations)', () => {
    let lowerRejectedCount = 0;
    let upperBypassCount = 0;

    for (let i = 0; i < 250; i++) {
      const hex = i.toString(16).padStart(12, '0');
      const guestIdLower = `a1b2c3d4-e5f6-4a1b-8c2d-${hex}`;
      const guestIdUpper = guestIdLower.toUpperCase();

      // Lower vs Lower (identical) -> Must be rejected
      const resLower = mergeGuestsSchema.safeParse({
        retained_guest_id: guestIdLower,
        merged_guest_id: guestIdLower,
        resolved_phone: null,
        resolved_email: null,
        resolved_address: null,
        attendance_conflict_resolutions: [],
      });
      if (!resLower.success) {
        lowerRejectedCount++;
      }

      // Lower vs Upper (same guest, different case) -> Must be rejected
      const resUpper = mergeGuestsSchema.safeParse({
        retained_guest_id: guestIdLower,
        merged_guest_id: guestIdUpper,
        resolved_phone: null,
        resolved_email: null,
        resolved_address: null,
        attendance_conflict_resolutions: [],
      });
      if (resUpper.success) {
        upperBypassCount++;
      }
    }

    expect(lowerRejectedCount).toBe(250);
    expect(upperBypassCount).toBe(0); // 0% bypass rate due to case-insensitive comparison
  });
});
