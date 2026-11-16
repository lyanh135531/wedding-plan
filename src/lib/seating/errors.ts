export class CapacityExceededError extends Error {
  readonly code: string = 'CAPACITY_EXCEEDED';
  readonly statusCode: number = 409;
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'CapacityExceededError';
  }
}

export class OptimisticLockError extends Error {
  readonly code: string = 'VERSION_CONFLICT';
  readonly statusCode: number = 409;
  constructor(message: string, public readonly currentVersion?: number) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}

export class InvalidCapacityReductionError extends CapacityExceededError {
  readonly code: string = 'INVALID_CAPACITY_REDUCTION';
  readonly statusCode: number = 422;
  constructor(
    message: string,
    public readonly currentAssigned: number,
    public readonly requestedCapacity: number
  ) {
    super(message, { currentAssigned, requestedCapacity });
    this.name = 'InvalidCapacityReductionError';
  }
}

export class TableNotFoundError extends Error {
  readonly code = 'TABLE_NOT_FOUND';
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy thông tin bàn') {
    super(message);
    this.name = 'TableNotFoundError';
  }
}

export class SeatAssignmentNotFoundError extends Error {
  readonly code = 'SEAT_ASSIGNMENT_NOT_FOUND';
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy phân bổ chỗ ngồi') {
    super(message);
    this.name = 'SeatAssignmentNotFoundError';
  }
}
