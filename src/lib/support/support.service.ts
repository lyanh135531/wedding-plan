import {
  CreateSupportAssignmentInput,
  UpdateSupportAssignmentInput,
  SupportAssignmentDto,
  SupportAssignmentFamilyDto,
} from '@/schemas/support';
import { TxDb } from './types';
import {
  createSupportAssignmentRecord,
  getSupportAssignmentById,
  updateSupportAssignmentRecord,
  deleteSupportAssignmentRecord,
  listSupportAssignmentsByEvent,
  mapToSupportAssignmentDto,
} from './support.repository';
import {
  SupportAssignmentNotFoundError,
  AccountCreationForbiddenError,
} from './errors';

/**
 * Creates a support party member assignment.
 * Invariant (PLAN §14.2): Vai trò hỗ trợ không tự cấp tài khoản hoặc quyền chỉnh sửa.
 * Strictly operates only on the support_assignments table — no users, accounts, or session records are created.
 */
export async function createSupportAssignment(
  db: TxDb,
  input: CreateSupportAssignmentInput
): Promise<SupportAssignmentDto> {
  return createSupportAssignmentRecord(db, {
    eventId: input.eventId,
    contactId: input.contactId ?? null,
    name: input.name,
    phone: input.phone,
    roles: input.roles,
    arrivalTime: input.arrivalTime ?? null,
    backupName: input.backupName ?? null,
    backupPhone: input.backupPhone ?? null,
    attireNotes: input.attireNotes ?? null,
    duties: input.duties ?? null,
    assignedTaskIds: input.assignedTaskIds ?? [],
    assignedItemIds: input.assignedItemIds ?? [],
    isShared: input.isShared ?? false,
  });
}

/**
 * Updates a support party member assignment.
 */
export async function updateSupportAssignment(
  db: TxDb,
  id: string,
  input: UpdateSupportAssignmentInput
): Promise<SupportAssignmentDto> {
  return updateSupportAssignmentRecord(
    db,
    id,
    {
      contactId: input.contactId,
      name: input.name,
      phone: input.phone,
      roles: input.roles,
      arrivalTime: input.arrivalTime,
      backupName: input.backupName,
      backupPhone: input.backupPhone,
      attireNotes: input.attireNotes,
      duties: input.duties,
      assignedTaskIds: input.assignedTaskIds,
      assignedItemIds: input.assignedItemIds,
      isShared: input.isShared,
    },
    input.version
  );
}

/**
 * Lists support party members for an event.
 * If role is 'family_view', only shared members are returned and attireNotes are redacted.
 */
export async function listSupportAssignments(
  db: TxDb,
  eventId: string,
  role?: string
): Promise<Array<SupportAssignmentDto | SupportAssignmentFamilyDto>> {
  return listSupportAssignmentsByEvent(db, eventId, role);
}

/**
 * Gets details of a single support party member.
 */
export async function getSupportAssignmentDetails(
  db: TxDb,
  id: string,
  role?: string
): Promise<SupportAssignmentDto | SupportAssignmentFamilyDto> {
  const record = await getSupportAssignmentById(db, id);
  if (!record) {
    throw new SupportAssignmentNotFoundError(id);
  }

  if (role === 'family_view' && !record.isShared) {
    throw new SupportAssignmentNotFoundError(id);
  }

  return mapToSupportAssignmentDto(record, role);
}

/**
 * Deletes a support party member assignment.
 */
export async function deleteSupportAssignment(
  db: TxDb,
  id: string,
  version?: number
): Promise<{ success: true; id: string }> {
  return deleteSupportAssignmentRecord(db, id, version);
}
