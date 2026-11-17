export class WeddingArchivedReadOnlyError extends Error {
  readonly statusCode = 403;
  readonly code = 'WEDDING_ARCHIVED_READ_ONLY';

  constructor(message = 'Đám cưới đã được lưu trữ (chỉ đọc). Vui lòng mở lại đám cưới để chỉnh sửa.') {
    super(message);
    this.name = 'WeddingArchivedReadOnlyError';
  }
}

export class WeddingAlreadyArchivedError extends Error {
  readonly statusCode = 400;
  readonly code = 'WEDDING_ALREADY_ARCHIVED';

  constructor(message = 'Đám cưới đã ở trạng thái lưu trữ.') {
    super(message);
    this.name = 'WeddingAlreadyArchivedError';
  }
}

export class WeddingNotArchivedError extends Error {
  readonly statusCode = 400;
  readonly code = 'WEDDING_NOT_ARCHIVED';

  constructor(message = 'Đám cưới chưa được lưu trữ.') {
    super(message);
    this.name = 'WeddingNotArchivedError';
  }
}

export class UnarchiveReasonRequiredError extends Error {
  readonly statusCode = 400;
  readonly code = 'UNARCHIVE_REASON_REQUIRED';

  constructor(message = 'Cần cung cấp lý do mở lại đám cưới đã lưu trữ để phục vụ kiểm toán.') {
    super(message);
    this.name = 'UnarchiveReasonRequiredError';
  }
}
