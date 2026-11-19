import { eq, and, sql } from 'drizzle-orm';
import { preparationItems } from '@/db/schema';
import {
  CreatePhotoShotInput,
  UpdatePhotoShotInput,
  HandoverShotListInput,
  PreparationItemDto,
  PreparationItemFamilyDto,
} from '@/schemas/preparation';
import { TxDb, PhotoMetadata } from './types';
import {
  createPreparationItemRecord,
  getPreparationItemById,
  updatePreparationItemRecord,
  deletePreparationItemRecord,
  listPreparationItemsByEvent,
  mapToPreparationItemDto,
} from './preparation.repository';
import { PreparationItemNotFoundError, ImmutableHandoverError } from './errors';

export async function createPhotoShot(
  db: TxDb,
  input: CreatePhotoShotInput
): Promise<PreparationItemDto> {
  const metadata: PhotoMetadata = {
    subjectGroup: input.subjectGroup ?? null,
    sessionName: input.sessionName ?? null,
    timeLocation: input.timeLocation ?? null,
    gatheringLead: input.gatheringLead ?? null,
    isExecuted: false,
    notes: input.notes ?? null,
  };

  return createPreparationItemRecord(db, {
    eventId: input.eventId,
    type: 'photo',
    title: input.title,
    category: input.sessionName ?? 'general',
    status: 'pending',
    priority: input.priority,
    metadata: metadata as Record<string, unknown>,
    isRental: false,
    returnDueDate: null,
    isBlacklisted: false,
    isShared: input.isShared,
  });
}

export async function updatePhotoShot(
  db: TxDb,
  id: string,
  input: UpdatePhotoShotInput
): Promise<PreparationItemDto> {
  const existing = await getPreparationItemById(db, id);
  if (!existing || existing.type !== 'photo') {
    throw new PreparationItemNotFoundError(id);
  }

  const currentMetadata = (existing.metadata as PhotoMetadata) || {};
  const updatedMetadata: PhotoMetadata = { ...currentMetadata };

  if (input.subjectGroup !== undefined) updatedMetadata.subjectGroup = input.subjectGroup;
  if (input.sessionName !== undefined) updatedMetadata.sessionName = input.sessionName;
  if (input.timeLocation !== undefined) updatedMetadata.timeLocation = input.timeLocation;
  if (input.gatheringLead !== undefined) updatedMetadata.gatheringLead = input.gatheringLead;
  if (input.notes !== undefined) updatedMetadata.notes = input.notes;
  if (input.isExecuted !== undefined) updatedMetadata.isExecuted = input.isExecuted;

  const newStatus = input.isExecuted === undefined ? existing.status : input.isExecuted ? 'completed' : 'pending';

  return updatePreparationItemRecord(
    db,
    id,
    {
      title: input.title,
      category: input.sessionName !== undefined ? input.sessionName : existing.category,
      status: newStatus,
      priority: input.priority,
      metadata: updatedMetadata as Record<string, unknown>,
      isShared: input.isShared,
    },
    input.version
  );
}

export async function listPhotoShots(
  db: TxDb,
  eventId: string,
  role?: string
): Promise<Array<PreparationItemDto | PreparationItemFamilyDto>> {
  return listPreparationItemsByEvent(db, eventId, 'photo', role);
}

export async function getPhotoShotById(
  db: TxDb,
  id: string,
  role?: string
): Promise<PreparationItemDto | PreparationItemFamilyDto> {
  const item = await getPreparationItemById(db, id);
  if (!item || item.type !== 'photo') {
    throw new PreparationItemNotFoundError(id);
  }
  return mapToPreparationItemDto(item, role);
}

export async function deletePhotoShot(
  db: TxDb,
  id: string,
  version?: number
): Promise<{ success: true; id: string }> {
  const item = await getPreparationItemById(db, id);
  if (!item || item.type !== 'photo') {
    throw new PreparationItemNotFoundError(id);
  }
  return deletePreparationItemRecord(db, id, version);
}

/**
 * Record manual handover of shot list to photographer (PLAN §15).
 * Invariant: Once handedOverAt is recorded, attempting to rewrite or reset it is rejected.
 */
export async function recordShotListHandover(
  db: TxDb,
  shotIdOrEventId: string,
  input: HandoverShotListInput
): Promise<{
  success: true;
  handedOverAt: string;
  recipient: string;
  channel: string;
  updatedCount: number;
}> {
  const handoverDate = input.handedOverAt ? new Date(input.handedOverAt) : new Date();

  // Check if target is a specific shot or an entire event
  const singleShot = await getPreparationItemById(db, shotIdOrEventId);

  if (singleShot && singleShot.type === 'photo') {
    if (singleShot.handedOverAt !== null) {
      throw new ImmutableHandoverError(
        `Cảnh chụp [${singleShot.title}] đã được bàn giao lúc ${singleShot.handedOverAt.toISOString()}. Bản ghi bàn giao là bất biến (immutable).`
      );
    }

    const channel = input.channel || 'direct_handover';
    const meta = (singleShot.metadata as PhotoMetadata) || {};
    meta.recipient = input.recipient;
    meta.handoverChannel = channel;
    if (input.notes) meta.notes = `${meta.notes ? meta.notes + ' | ' : ''}Bàn giao: ${input.notes}`;

    await db
      .update(preparationItems)
      .set({
        handedOverAt: handoverDate,
        metadata: meta as Record<string, unknown>,
        version: singleShot.version + 1,
        updatedAt: sql`clock_timestamp()`,
      })
      .where(eq(preparationItems.id, singleShot.id));

    return {
      success: true,
      handedOverAt: handoverDate.toISOString(),
      recipient: input.recipient,
      channel,
      updatedCount: 1,
    };
  }

  // Otherwise, batch handover for the event's shots
  const eventShots = await db
    .select()
    .from(preparationItems)
    .where(
      and(
        eq(preparationItems.eventId, shotIdOrEventId),
        eq(preparationItems.type, 'photo')
      )
    );

  const channel = input.channel || 'direct_handover';
  let updatedCount = 0;
  for (const shot of eventShots) {
    if (!shot.handedOverAt) {
      const meta = (shot.metadata as PhotoMetadata) || {};
      meta.recipient = input.recipient;
      meta.handoverChannel = channel;

      await db
        .update(preparationItems)
        .set({
          handedOverAt: handoverDate,
          metadata: meta as Record<string, unknown>,
          version: shot.version + 1,
          updatedAt: sql`clock_timestamp()`,
        })
        .where(eq(preparationItems.id, shot.id));

      updatedCount++;
    }
  }

  return {
    success: true,
    handedOverAt: handoverDate.toISOString(),
    recipient: input.recipient,
    channel,
    updatedCount,
  };
}
