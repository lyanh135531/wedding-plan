import { NextResponse } from 'next/server';
import { UserSession } from '@/lib/auth/session';
import { isWeddingArchived } from '@/lib/archival';
import { TxDb } from '@/lib/archival/types';
import {
  WeddingArchivedReadOnlyError,
  WeddingAlreadyArchivedError,
  WeddingNotArchivedError,
  UnarchiveReasonRequiredError,
} from '@/lib/archival/errors';
import {
  TimelineItemNotFoundError,
  OptimisticLockError as TimelineOptimisticLockError,
  InvalidTimelineShiftError,
  TimelineTimeOrderError,
} from '@/lib/timeline/errors';
import {
  AttendanceNotFoundError,
  CheckInDisabledError,
  DeclinedGuestConfirmationRequiredError,
  TableCapacityExceededError,
} from '@/lib/attendance/errors';
import {
  GiftNotFoundError,
  GiftAlreadyVoidedError,
  GiftReturnExceedsBalanceError,
  PhysicalGiftReturnNotAllowedError,
  OptimisticLockError as GiftOptimisticLockError,
} from '@/lib/gifts/errors';
import {
  HandoverPacketNotFoundError,
  HandoverAlreadyDeliveredError,
} from '@/lib/handovers/errors';

export function enforceOwnerRole(session: UserSession | null): NextResponse | null {
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
      { status: 401 }
    );
  }
  if (session.role === 'family_view' || (session.role !== 'owner' && session.role !== 'planner')) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Người nhà (family_view) chỉ có quyền xem, không được chỉnh sửa.' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Invariants AT03 & AT25:
 * Family view is strictly forbidden from accessing gifts (both read and write).
 */
export function enforceNoFamilyViewForGifts(session: UserSession | null): NextResponse | null {
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
      { status: 401 }
    );
  }
  if (session.role === 'family_view') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Người nhà (family_view) không có quyền truy cập thông tin quà mừng và tài chính.' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Invariant (AT35, FL20):
 * If the wedding is archived, all mutations across the app are blocked server-side,
 * returning HTTP 403 Forbidden.
 */
export async function checkArchivalFreezeGuard(db: TxDb, isUnarchiving = false): Promise<void> {
  if (isUnarchiving) return;
  const archived = await isWeddingArchived(db);
  if (archived) {
    throw new WeddingArchivedReadOnlyError();
  }
}

export function handleG10Error(err: unknown): NextResponse {
  if ((err as { code?: string })?.code === 'OUTDATED_HANDOVER') {
    return NextResponse.json({ error: 'OUTDATED_HANDOVER', message: (err as Error).message }, { status: 409 });
  }
  if (
    err instanceof TimelineOptimisticLockError ||
    err instanceof GiftOptimisticLockError ||
    (err as any)?.code === 'OPTIMISTIC_LOCK_CONFLICT' ||
    (err as any)?.code === 'VERSION_CONFLICT' ||
    (err as any)?.name === 'OptimisticLockError'
  ) {
    const errorObj = err as any;
    return NextResponse.json(
      {
        error: 'OPTIMISTIC_LOCK_CONFLICT',
        message: errorObj.message || 'Dữ liệu đã bị thay đổi bởi thao tác khác. Vui lòng tải lại trang.',
        currentVersion: errorObj.currentVersion,
      },
      { status: 409 }
    );
  }

  if (err instanceof TableCapacityExceededError) {
    return NextResponse.json(
      {
        error: 'TABLE_CAPACITY_EXCEEDED',
        message: err.message,
      },
      { status: 409 }
    );
  }

  if (
    err instanceof TimelineItemNotFoundError ||
    err instanceof AttendanceNotFoundError ||
    err instanceof GiftNotFoundError ||
    err instanceof HandoverPacketNotFoundError ||
    (err as any)?.statusCode === 404 ||
    (err as any)?.code?.endsWith('_NOT_FOUND')
  ) {
    return NextResponse.json(
      {
        error: (err as any)?.code || 'NOT_FOUND',
        message: (err as any)?.message || 'Không tìm thấy tài nguyên yêu cầu.',
      },
      { status: 404 }
    );
  }

  if (err instanceof WeddingArchivedReadOnlyError) {
    return NextResponse.json(
      {
        error: 'WEDDING_ARCHIVED_READ_ONLY',
        message: err.message,
      },
      { status: 403 }
    );
  }

  if (
    err instanceof InvalidTimelineShiftError ||
    err instanceof TimelineTimeOrderError ||
    err instanceof CheckInDisabledError ||
    err instanceof DeclinedGuestConfirmationRequiredError ||
    err instanceof GiftAlreadyVoidedError ||
    err instanceof GiftReturnExceedsBalanceError ||
    err instanceof PhysicalGiftReturnNotAllowedError ||
    err instanceof HandoverAlreadyDeliveredError ||
    err instanceof WeddingAlreadyArchivedError ||
    err instanceof WeddingNotArchivedError ||
    err instanceof UnarchiveReasonRequiredError ||
    (err as any)?.statusCode === 400
  ) {
    return NextResponse.json(
      {
        error: (err as any)?.code || 'BAD_REQUEST',
        message: (err as any)?.message || 'Yêu cầu không hợp lệ.',
      },
      { status: 400 }
    );
  }

  const statusCode = (err as { statusCode?: number })?.statusCode;
  if (statusCode && statusCode >= 400 && statusCode < 500) return NextResponse.json({ error: 'REQUEST_REJECTED', message: (err as Error).message }, { status: statusCode });
  console.error('[G10 API Error]:', err);
  return NextResponse.json(
    {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
    },
    { status: 500 }
  );
}
