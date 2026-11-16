export class CapacityExceededError extends Error {
  readonly code: string = 'CAPACITY_EXCEEDED';
  readonly statusCode: number = 409;
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'CapacityExceededError';
  }
}

export class TripCapacityExceededError extends CapacityExceededError {
  constructor(message = 'Chuyến xe đã hết chỗ') {
    super(message);
    this.name = 'TripCapacityExceededError';
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

export class AccommodationNotFoundError extends Error {
  readonly code = 'ACCOMMODATION_NOT_FOUND';
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy nơi lưu trú') {
    super(message);
    this.name = 'AccommodationNotFoundError';
  }
}

export class RoomAssignmentNotFoundError extends Error {
  readonly code = 'ROOM_ASSIGNMENT_NOT_FOUND';
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy thông tin gán phòng') {
    super(message);
    this.name = 'RoomAssignmentNotFoundError';
  }
}

export class TripNotFoundError extends Error {
  readonly code = 'TRIP_NOT_FOUND';
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy chuyến xe') {
    super(message);
    this.name = 'TripNotFoundError';
  }
}

export class TripPassengerNotFoundError extends Error {
  readonly code = 'TRIP_PASSENGER_NOT_FOUND';
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy thông tin hành khách') {
    super(message);
    this.name = 'TripPassengerNotFoundError';
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
