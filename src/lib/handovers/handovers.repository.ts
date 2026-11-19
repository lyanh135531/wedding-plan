import { eq, and, desc } from 'drizzle-orm';
import { handoverPackets } from '@/db/schema/handovers';
import { HandoverPacketDto, HandoverPacketFamilyDto } from '@/schemas/handovers';
import { TxDb } from './types';
import { HandoverPacketNotFoundError } from './errors';

export function mapToHandoverPacketDto(raw: any): HandoverPacketDto {
  return {
    id: raw.id,
    eventId: raw.eventId,
    version: raw.version,
    title: raw.title,
    scope: raw.scope,
    snapshotData: raw.snapshotData,
    handoverStatus: raw.handoverStatus,
    handedOverTo: raw.handedOverTo ?? null,
    handedOverAt: raw.handedOverAt ? new Date(raw.handedOverAt).toISOString() : null,
    handedOverChannel: raw.handedOverChannel ?? null,
    isSharedWithFamily: Boolean(raw.isSharedWithFamily),
    createdByUserId: raw.createdByUserId ?? null,
    createdAt: new Date(raw.createdAt).toISOString(),
    updatedAt: new Date(raw.updatedAt).toISOString(),
  };
}

/**
 * Invariant (AT26): Sanitizes financial data and private notes from family view.
 */
export function mapToHandoverPacketFamilyDto(raw: any): HandoverPacketFamilyDto {
  const full = mapToHandoverPacketDto(raw);
  const sanitizedSnapshot = { ...full.snapshotData };
  delete sanitizedSnapshot.financials;
  delete sanitizedSnapshot.budgets;
  delete sanitizedSnapshot.costs;
  delete sanitizedSnapshot.gifts;
  delete sanitizedSnapshot.readiness;
  for (const section of ['timeline', 'support', 'checklist']) {
    if (Array.isArray(sanitizedSnapshot[section])) {
      // Legacy snapshots without sharing metadata are deliberately not exposed.
      sanitizedSnapshot[section] = sanitizedSnapshot[section].filter((item: { isShared?: boolean }) => item.isShared === true);
    }
  }

  return {
    ...full,
    snapshotData: sanitizedSnapshot,
  };
}

export async function createHandoverPacketRecord(
  db: TxDb,
  values: {
    eventId: string;
    version: number;
    title: string;
    scope: any;
    snapshotData: any;
    isSharedWithFamily?: boolean;
    createdByUserId?: string | null;
  }
): Promise<HandoverPacketDto> {
  const [created] = await db
    .insert(handoverPackets)
    .values({
      eventId: values.eventId,
      version: values.version,
      title: values.title,
      scope: values.scope,
      snapshotData: values.snapshotData,
      isSharedWithFamily: values.isSharedWithFamily ?? false,
      createdByUserId: values.createdByUserId ?? null,
      handoverStatus: 'draft',
    })
    .returning();

  return mapToHandoverPacketDto(created);
}

export async function getHandoverPacketById(
  db: TxDb,
  id: string
): Promise<any | null> {
  const [packet] = await db
    .select()
    .from(handoverPackets)
    .where(eq(handoverPackets.id, id))
    .limit(1);

  return packet || null;
}

export async function listHandoverPacketsByEvent(
  db: TxDb,
  eventId: string,
  role?: string
): Promise<Array<HandoverPacketDto | HandoverPacketFamilyDto>> {
  const packets = await db
    .select()
    .from(handoverPackets)
    .where(eq(handoverPackets.eventId, eventId))
    .orderBy(desc(handoverPackets.version));

  if (role === 'family_view') {
    return packets
      .filter((p: any) => p.isSharedWithFamily)
      .map(mapToHandoverPacketFamilyDto);
  }

  return packets.map((p: any) => mapToHandoverPacketDto(p));
}

export async function updateHandoverDelivery(
  db: TxDb,
  id: string,
  handedOverTo: string,
  handedOverChannel?: string | null
): Promise<HandoverPacketDto> {
  const current = await getHandoverPacketById(db, id);
  if (!current) {
    throw new HandoverPacketNotFoundError(id);
  }

  const [updated] = await db
    .update(handoverPackets)
    .set({
      handoverStatus: 'handed_over',
      handedOverTo,
      handedOverAt: new Date(),
      handedOverChannel: handedOverChannel ?? null,
      updatedAt: new Date(),
    })
    .where(eq(handoverPackets.id, id))
    .returning();

  return mapToHandoverPacketDto(updated);
}
