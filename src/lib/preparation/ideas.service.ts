import {
  CreateIdeaInput,
  UpdateIdeaInput,
  PreparationItemDto,
  PreparationItemFamilyDto,
} from '@/schemas/preparation';
import { TxDb, IdeaMetadata } from './types';
import {
  createPreparationItemRecord,
  getPreparationItemById,
  updatePreparationItemRecord,
  deletePreparationItemRecord,
  listPreparationItemsByEvent,
  mapToPreparationItemDto,
} from './preparation.repository';
import {
  PreparationItemNotFoundError,
  InvalidStatusTransitionError,
  InvalidExternalUrlError,
} from './errors';

const VALID_IDEA_STATUSES = new Set(['reference', 'considering', 'decided', 'discarded']);

export function validateSafeUrl(url: string | null | undefined): void {
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new InvalidExternalUrlError('Chỉ hỗ trợ giao thức HTTP hoặc HTTPS.');
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '169.254.169.254' ||
      host === '[::1]' ||
      host.endsWith('.internal') ||
      host.endsWith('.local')
    ) {
      throw new InvalidExternalUrlError('URL bên ngoài thuộc dải mạng nội bộ bị chặn.');
    }
  } catch (err) {
    if (err instanceof InvalidExternalUrlError) throw err;
    throw new InvalidExternalUrlError('URL bên ngoài không hợp lệ.');
  }
}

export async function createIdea(db: TxDb, input: CreateIdeaInput): Promise<PreparationItemDto> {
  if (input.externalUrl) {
    validateSafeUrl(input.externalUrl);
  }

  const metadata: IdeaMetadata = {
    colorSwatches: input.colorSwatches || [],
    externalUrl: input.externalUrl ?? null,
    notes: input.notes ?? null,
    linkedVendorId: input.linkedVendorId ?? null,
    linkedTaskId: input.linkedTaskId ?? null,
  };

  return createPreparationItemRecord(db, {
    eventId: input.eventId,
    type: 'idea',
    title: input.title,
    category: input.category ?? null,
    status: input.status || 'reference',
    priority: null,
    metadata: metadata as Record<string, unknown>,
    isRental: false,
    returnDueDate: null,
    isBlacklisted: false,
    isShared: input.isShared,
  });
}

export async function updateIdea(
  db: TxDb,
  id: string,
  input: UpdateIdeaInput
): Promise<PreparationItemDto> {
  const existing = await getPreparationItemById(db, id);
  if (!existing || existing.type !== 'idea') {
    throw new PreparationItemNotFoundError(id);
  }

  if (input.status && !VALID_IDEA_STATUSES.has(input.status)) {
    throw new InvalidStatusTransitionError(`Trạng thái ý tưởng không hợp lệ: ${input.status}`);
  }

  if (input.externalUrl !== undefined && input.externalUrl !== null) {
    validateSafeUrl(input.externalUrl);
  }

  const currentMetadata = (existing.metadata as IdeaMetadata) || {};
  const updatedMetadata: IdeaMetadata = {
    ...currentMetadata,
  };

  if (input.colorSwatches !== undefined) {
    updatedMetadata.colorSwatches = input.colorSwatches;
  }
  if (input.externalUrl !== undefined) {
    updatedMetadata.externalUrl = input.externalUrl;
  }
  if (input.notes !== undefined) {
    updatedMetadata.notes = input.notes;
  }
  if (input.linkedVendorId !== undefined) {
    updatedMetadata.linkedVendorId = input.linkedVendorId;
  }
  if (input.linkedTaskId !== undefined) {
    updatedMetadata.linkedTaskId = input.linkedTaskId;
  }

  return updatePreparationItemRecord(
    db,
    id,
    {
      title: input.title,
      category: input.category,
      status: input.status || 'reference',
      metadata: updatedMetadata as Record<string, unknown>,
      isShared: input.isShared,
    },
    input.version
  );
}

export async function listIdeas(
  db: TxDb,
  eventId: string,
  role?: string
): Promise<Array<PreparationItemDto | PreparationItemFamilyDto>> {
  return listPreparationItemsByEvent(db, eventId, 'idea', role);
}

export async function getIdeaById(
  db: TxDb,
  id: string,
  role?: string
): Promise<PreparationItemDto | PreparationItemFamilyDto> {
  const item = await getPreparationItemById(db, id);
  if (!item || item.type !== 'idea') {
    throw new PreparationItemNotFoundError(id);
  }
  return mapToPreparationItemDto(item, role);
}

export async function deleteIdea(
  db: TxDb,
  id: string,
  version?: number
): Promise<{ success: true; id: string }> {
  const item = await getPreparationItemById(db, id);
  if (!item || item.type !== 'idea') {
    throw new PreparationItemNotFoundError(id);
  }
  return deletePreparationItemRecord(db, id, version);
}

/**
 * Preview idea promotion to task and cost item without auto-creating them (PLAN §15).
 */
export async function previewIdeaPromotion(
  db: TxDb,
  ideaId: string
): Promise<{
  ideaId: string;
  title: string;
  category: string | null;
  proposedTask: {
    title: string;
    description: string;
    category: string;
  };
  proposedCostItem: {
    name: string;
    category: string;
    estimatedAmount: string;
  };
  sourceIdeaId: string;
  message: string;
}> {
  const item = await getPreparationItemById(db, ideaId);
  if (!item || item.type !== 'idea') {
    throw new PreparationItemNotFoundError(ideaId);
  }

  const meta = (item.metadata as IdeaMetadata) || {};

  return {
    ideaId: item.id,
    title: item.title,
    category: item.category,
    proposedTask: {
      title: `Triển khai: ${item.title}`,
      description: `Khởi tạo từ ý tưởng tham khảo [${item.id}]. Ghi chú: ${meta.notes || 'Không có'}`,
      category: item.category || 'decor',
    },
    proposedCostItem: {
      name: item.title,
      category: item.category || 'decor',
      estimatedAmount: '0',
    },
    sourceIdeaId: item.id,
    message:
      'Xem trước dữ liệu chuyển đổi. Chốt ý tưởng KHÔNG tự động tạo chi phí hay công việc; cần xác nhận tạo riêng có liên kết nguồn để tránh trùng lặp.',
  };
}
