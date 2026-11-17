export class SupportAssignmentNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'SUPPORT_ASSIGNMENT_NOT_FOUND';

  constructor(id: string) {
    super(`Không tìm thấy thành viên đội hỗ trợ với ID: ${id}`);
    this.name = 'SupportAssignmentNotFoundError';
  }
}

export class OptimisticLockError extends Error {
  readonly statusCode = 409;
  readonly code = 'OPTIMISTIC_LOCK_CONFLICT';
  readonly currentVersion: number;

  constructor(currentVersion: number) {
    super('Dữ liệu đã bị thay đổi bởi thao tác khác. Vui lòng tải lại trang.');
    this.name = 'OptimisticLockError';
    this.currentVersion = currentVersion;
  }
}

export class AccountCreationForbiddenError extends Error {
  readonly statusCode = 403;
  readonly code = 'SUPPORT_ACCOUNT_CREATION_FORBIDDEN';

  constructor(message?: string) {
    super(
      message ||
        'Quy tắc bất biến: Vai trò hỗ trợ không tự cấp tài khoản hoặc quyền chỉnh sửa hệ thống (PLAN §14.2).'
    );
    this.name = 'AccountCreationForbiddenError';
  }
}
