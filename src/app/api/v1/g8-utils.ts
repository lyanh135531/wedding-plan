import { NextResponse } from 'next/server';
import { UserSession } from '@/lib/auth/session';
import {
  CapacityExceededError as SeatingCapacityError,
  InvalidCapacityReductionError as SeatingCapacityReductionError,
  OptimisticLockError as SeatingOptimisticLockError,
  TableNotFoundError,
  SeatAssignmentNotFoundError,
} from '@/lib/seating';
import {
  MenuNotFoundError,
  MenuItemNotFoundError,
  CateringSnapshotLockedError,
  OptimisticLockError as CateringOptimisticLockError,
} from '@/lib/catering';
import {
  CapacityExceededError as LogisticsCapacityError,
  InvalidCapacityReductionError as LogisticsCapacityReductionError,
  OptimisticLockError as LogisticsOptimisticLockError,
  TripNotFoundError,
  TripPassengerNotFoundError,
  AccommodationNotFoundError,
  RoomAssignmentNotFoundError,
} from '@/lib/logistics';

export function enforceOwnerRole(session: UserSession | null): NextResponse | null {
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
      { status: 401 }
    );
  }
  if (session.role === 'family_view' || session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Người nhà (family_view) chỉ có quyền xem, không được chỉnh sửa.' },
      { status: 403 }
    );
  }
  return null;
}

export function handleG8Error(err: unknown): NextResponse {
  if (
    err instanceof SeatingCapacityReductionError ||
    err instanceof LogisticsCapacityReductionError ||
    (err as any)?.code === 'INVALID_CAPACITY_REDUCTION' ||
    (err as any)?.name === 'InvalidCapacityReductionError'
  ) {
    const errorObj = err as any;
    return NextResponse.json(
      {
        error: 'INVALID_CAPACITY_REDUCTION',
        message: errorObj.message || 'Không thể giảm sức chứa dưới số lượng đã phân bổ',
        currentAssigned: errorObj.currentAssigned,
        requestedCapacity: errorObj.requestedCapacity,
      },
      { status: 422 }
    );
  }

  if (
    err instanceof SeatingOptimisticLockError ||
    err instanceof CateringOptimisticLockError ||
    err instanceof LogisticsOptimisticLockError ||
    (err as any)?.code === 'OPTIMISTIC_LOCK_CONFLICT' ||
    (err as any)?.code === 'VERSION_CONFLICT' ||
    (err as any)?.name === 'OptimisticLockError'
  ) {
    const errorObj = err as any;
    return NextResponse.json(
      {
        error: 'OPTIMISTIC_LOCK_CONFLICT',
        message: errorObj.message || 'Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng tải lại.',
        currentVersion: errorObj.currentVersion,
      },
      { status: 409 }
    );
  }

  if (
    err instanceof SeatingCapacityError ||
    err instanceof LogisticsCapacityError ||
    (err as any)?.code === 'CAPACITY_EXCEEDED' ||
    (err as any)?.name === 'CapacityExceededError' ||
    (err as any)?.name === 'TripCapacityExceededError'
  ) {
    const errorObj = err as any;
    return NextResponse.json(
      {
        error: 'CAPACITY_EXCEEDED',
        message: errorObj.message || 'Đã vượt quá sức chứa tối đa.',
        details: errorObj.details,
      },
      { status: 409 }
    );
  }

  if (
    err instanceof TableNotFoundError ||
    err instanceof SeatAssignmentNotFoundError ||
    err instanceof MenuNotFoundError ||
    err instanceof MenuItemNotFoundError ||
    err instanceof TripNotFoundError ||
    err instanceof TripPassengerNotFoundError ||
    err instanceof AccommodationNotFoundError ||
    err instanceof RoomAssignmentNotFoundError ||
    (err as any)?.statusCode === 404 ||
    (err as any)?.code?.endsWith('_NOT_FOUND')
  ) {
    return NextResponse.json(
      {
        error: 'NOT_FOUND',
        message: (err as Error).message || 'Không tìm thấy dữ liệu yêu cầu.',
      },
      { status: 404 }
    );
  }

  if (err instanceof CateringSnapshotLockedError) {
    return NextResponse.json(
      {
        error: 'SNAPSHOT_LOCKED',
        message: err.message,
      },
      { status: 400 }
    );
  }

  const statusCode = (err as { statusCode?: number })?.statusCode;
  if (statusCode && statusCode >= 400 && statusCode < 500) return NextResponse.json({ error: 'REQUEST_REJECTED', message: (err as Error).message }, { status: statusCode });
  const message = err instanceof Error ? err.message : 'Lỗi hệ thống không xác định.';
  return NextResponse.json(
    {
      error: 'INTERNAL_ERROR',
      message,
    },
    { status: 500 }
  );
}
