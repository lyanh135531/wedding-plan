export class MenuNotFoundError extends Error {
  readonly code = 'MENU_NOT_FOUND';
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy thực đơn') {
    super(message);
    this.name = 'MenuNotFoundError';
  }
}

export class MenuItemNotFoundError extends Error {
  readonly code = 'MENU_ITEM_NOT_FOUND';
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy món ăn trong thực đơn') {
    super(message);
    this.name = 'MenuItemNotFoundError';
  }
}

export class CateringSnapshotLockedError extends Error {
  readonly code = 'SNAPSHOT_LOCKED';
  readonly statusCode = 409;
  constructor(message = 'Bản chốt thực đơn đã bị khóa, không thể chỉnh sửa') {
    super(message);
    this.name = 'CateringSnapshotLockedError';
  }
}

export class OptimisticLockError extends Error {
  readonly code = 'VERSION_CONFLICT';
  readonly statusCode = 409;
  constructor(message: string, public readonly currentVersion?: number) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}
