import { NextResponse } from 'next/server';
import { UserSession } from '@/lib/auth/session';
import {
  PreparationItemNotFoundError,
  OptimisticLockError as PrepOptimisticLockError,
  InvalidStatusTransitionError,
  RentalDueDateRequiredError,
  ImmutableHandoverError,
  InvalidExternalUrlError,
} from '@/lib/preparation/errors';
import {
  SupportAssignmentNotFoundError,
  OptimisticLockError as SupportOptimisticLockError,
  AccountCreationForbiddenError,
} from '@/lib/support/errors';
import { R2VerificationFailedError } from '@/lib/r2-signoff/errors';

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

export function handleG9Error(err: unknown): NextResponse {
  if (
    err instanceof PrepOptimisticLockError ||
    err instanceof SupportOptimisticLockError ||
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

  if (
    err instanceof PreparationItemNotFoundError ||
    err instanceof SupportAssignmentNotFoundError ||
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

  if (err instanceof RentalDueDateRequiredError || (err as any)?.code === 'RENTAL_DUE_DATE_REQUIRED') {
    return NextResponse.json(
      {
        error: 'RENTAL_DUE_DATE_REQUIRED',
        message: (err as Error).message,
      },
      { status: 422 }
    );
  }

  if (err instanceof R2VerificationFailedError || (err as any)?.code === 'R2_VERIFICATION_FAILED') {
    return NextResponse.json(
      {
        error: 'R2_VERIFICATION_FAILED',
        message: (err as Error).message,
        failedChecks: (err as any)?.failedChecks,
      },
      { status: 422 }
    );
  }

  if (err instanceof AccountCreationForbiddenError || (err as any)?.code === 'SUPPORT_ACCOUNT_CREATION_FORBIDDEN') {
    return NextResponse.json(
      {
        error: 'FORBIDDEN',
        message: (err as Error).message,
      },
      { status: 403 }
    );
  }

  if (
    err instanceof ImmutableHandoverError ||
    (err as any)?.code === 'IMMUTABLE_HANDOVER_TIMESTAMP' ||
    err instanceof InvalidStatusTransitionError ||
    err instanceof InvalidExternalUrlError ||
    (err as any)?.code === 'INVALID_EXTERNAL_URL'
  ) {
    return NextResponse.json(
      {
        error: (err as any)?.code || 'BAD_REQUEST',
        message: (err as Error).message,
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
