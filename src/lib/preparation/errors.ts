export class PreparationItemNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'PREPARATION_ITEM_NOT_FOUND';

  constructor(id: string) {
    super(`Không tìm thấy mục chuẩn bị với ID: ${id}`);
    this.name = 'PreparationItemNotFoundError';
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

export class InvalidStatusTransitionError extends Error {
  readonly statusCode = 400;
  readonly code = 'INVALID_STATUS_TRANSITION';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidStatusTransitionError';
  }
}

export class RentalDueDateRequiredError extends Error {
  readonly statusCode = 422;
  readonly code = 'RENTAL_DUE_DATE_REQUIRED';

  constructor() {
    super('Đồ thuê bắt buộc phải có hạn trả (returnDueDate).');
    this.name = 'RentalDueDateRequiredError';
  }
}

export class ImmutableHandoverError extends Error {
  readonly statusCode = 400;
  readonly code = 'IMMUTABLE_HANDOVER_TIMESTAMP';

  constructor(message?: string) {
    super(message || 'Bản ghi thời điểm bàn giao không thể sửa đổi hoặc xóa sau khi đã thiết lập.');
    this.name = 'ImmutableHandoverError';
  }
}

export class InvalidExternalUrlError extends Error {
  readonly statusCode = 400;
  readonly code = 'INVALID_EXTERNAL_URL';

  constructor(message?: string) {
    super(message || 'URL bên ngoài không hợp lệ hoặc thuộc dải mạng nội bộ bị chặn.');
    this.name = 'InvalidExternalUrlError';
  }
}
