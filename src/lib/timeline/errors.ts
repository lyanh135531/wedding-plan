export class TimelineItemNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'TIMELINE_ITEM_NOT_FOUND';

  constructor(id: string) {
    super(`Không tìm thấy mục lịch trình với ID: ${id}`);
    this.name = 'TimelineItemNotFoundError';
  }
}

export class OptimisticLockError extends Error {
  readonly statusCode = 409;
  readonly code = 'OPTIMISTIC_LOCK_CONFLICT';
  readonly currentVersion?: number;

  constructor(message = 'Dữ liệu lịch trình đã bị thay đổi bởi người khác. Vui lòng tải lại trang.', currentVersion?: number) {
    super(message);
    this.name = 'OptimisticLockError';
    this.currentVersion = currentVersion;
  }
}

export class InvalidTimelineShiftError extends Error {
  readonly statusCode = 400;
  readonly code = 'INVALID_TIMELINE_SHIFT';

  constructor(message = 'Không thể dời lịch cho mục đã bắt đầu hoặc hoàn thành.') {
    super(message);
    this.name = 'InvalidTimelineShiftError';
  }
}

export class TimelineTimeOrderError extends Error {
  readonly statusCode = 400;
  readonly code = 'TIMELINE_TIME_ORDER_INVALID';

  constructor(message = 'Thời gian kết thúc phải sau hoặc bằng thời gian bắt đầu.') {
    super(message);
    this.name = 'TimelineTimeOrderError';
  }
}
