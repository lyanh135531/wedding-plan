import { eq, and, inArray } from 'drizzle-orm';
import { preparationItems } from '@/db/schema';
import {
  CreateMusicTrackInput,
  UpdateMusicTrackInput,
  PreparationItemDto,
  PreparationItemFamilyDto,
} from '@/schemas/preparation';
import { TxDb, MusicMetadata } from './types';
import {
  createPreparationItemRecord,
  getPreparationItemById,
  updatePreparationItemRecord,
  deletePreparationItemRecord,
  listPreparationItemsByEvent,
  mapToPreparationItemDto,
} from './preparation.repository';
import { PreparationItemNotFoundError } from './errors';
import { validateSafeUrl } from './ideas.service';

export async function createMusicTrack(
  db: TxDb,
  input: CreateMusicTrackInput
): Promise<PreparationItemDto> {
  if (input.externalUrl) {
    validateSafeUrl(input.externalUrl);
  }

  const metadata: MusicMetadata = {
    artist: input.artist ?? null,
    moment: input.moment,
    externalUrl: input.externalUrl ?? null,
    durationSeconds: input.durationSeconds ?? null,
    cueNotes: input.cueNotes ?? null,
    trackOrder: input.trackOrder ?? 0,
  };

  return createPreparationItemRecord(db, {
    eventId: input.eventId,
    type: 'music',
    title: input.title,
    category: input.moment,
    status: 'active',
    priority: null,
    metadata: metadata as Record<string, unknown>,
    isRental: false,
    returnDueDate: null,
    isBlacklisted: input.isBlacklisted ?? false,
    isShared: input.isShared,
  });
}

export async function updateMusicTrack(
  db: TxDb,
  id: string,
  input: UpdateMusicTrackInput
): Promise<PreparationItemDto> {
  const existing = await getPreparationItemById(db, id);
  if (!existing || existing.type !== 'music') {
    throw new PreparationItemNotFoundError(id);
  }

  if (input.externalUrl !== undefined && input.externalUrl !== null) {
    validateSafeUrl(input.externalUrl);
  }

  const currentMetadata = (existing.metadata as MusicMetadata) || {};
  const updatedMetadata: MusicMetadata = { ...currentMetadata };

  if (input.artist !== undefined) updatedMetadata.artist = input.artist;
  if (input.moment !== undefined) updatedMetadata.moment = input.moment;
  if (input.externalUrl !== undefined) updatedMetadata.externalUrl = input.externalUrl;
  if (input.durationSeconds !== undefined) updatedMetadata.durationSeconds = input.durationSeconds;
  if (input.cueNotes !== undefined) updatedMetadata.cueNotes = input.cueNotes;
  if (input.trackOrder !== undefined) updatedMetadata.trackOrder = input.trackOrder;

  return updatePreparationItemRecord(
    db,
    id,
    {
      title: input.title,
      category: input.moment !== undefined ? input.moment : existing.category,
      metadata: updatedMetadata as Record<string, unknown>,
      isBlacklisted: input.isBlacklisted,
      isShared: input.isShared,
    },
    input.version
  );
}

export async function listMusicTracks(
  db: TxDb,
  eventId: string,
  role?: string
): Promise<Array<PreparationItemDto | PreparationItemFamilyDto>> {
  const tracks = await listPreparationItemsByEvent(db, eventId, 'music', role);
  return tracks.sort((a, b) => {
    const orderA = (a.metadata as MusicMetadata)?.trackOrder ?? 0;
    const orderB = (b.metadata as MusicMetadata)?.trackOrder ?? 0;
    return orderA - orderB;
  });
}

export async function getMusicTrackById(
  db: TxDb,
  id: string,
  role?: string
): Promise<PreparationItemDto | PreparationItemFamilyDto> {
  const item = await getPreparationItemById(db, id);
  if (!item || item.type !== 'music') {
    throw new PreparationItemNotFoundError(id);
  }
  return mapToPreparationItemDto(item, role);
}

export async function deleteMusicTrack(
  db: TxDb,
  id: string,
  version?: number
): Promise<{ success: true; id: string }> {
  const item = await getPreparationItemById(db, id);
  if (!item || item.type !== 'music') {
    throw new PreparationItemNotFoundError(id);
  }
  return deletePreparationItemRecord(db, id, version);
}

/**
 * Reorder tracks in playlist according to an array of track IDs.
 */
export async function reorderPlaylist(
  db: TxDb,
  eventId: string,
  orderedTrackIds: string[]
): Promise<Array<PreparationItemDto | PreparationItemFamilyDto>> {
  for (let i = 0; i < orderedTrackIds.length; i++) {
    const trackId = orderedTrackIds[i];
    const track = await getPreparationItemById(db, trackId);
    if (track && track.eventId === eventId && track.type === 'music') {
      const meta = (track.metadata as MusicMetadata) || {};
      meta.trackOrder = i;
      await db
        .update(preparationItems)
        .set({
          metadata: meta as Record<string, unknown>,
          version: track.version + 1,
        })
        .where(eq(preparationItems.id, trackId));
    }
  }

  return listMusicTracks(db, eventId, 'owner');
}
