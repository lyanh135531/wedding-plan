export class AttendanceNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'ATTENDANCE_NOT_FOUND';

  constructor(message = 'Không tìm thấy thông tin điểm danh của khách mời.') {
    super(message);
    this.name = 'AttendanceNotFoundError';
  }
}

export class CheckInDisabledError extends Error {
  readonly statusCode = 400;
  readonly code = 'CHECK_IN_DISABLED';

  constructor(message = 'Tính năng điểm danh chưa được bật cho sự kiện này.') {
    super(message);
    this.name = 'CheckInDisabledError';
  }
}

export class DeclinedGuestConfirmationRequiredError extends Error {
  readonly statusCode = 400;
  readonly code = 'DECLINED_GUEST_CONFIRMATION_REQUIRED';

  constructor(message = 'Khách này từng báo Từ chối tham dự. Vui lòng xác nhận để tiếp tục điểm danh.') {
    super(message);
    this.name = 'DeclinedGuestConfirmationRequiredError';
  }
}

export class TableCapacityExceededError extends Error {
  readonly statusCode = 409;
  readonly code = 'TABLE_CAPACITY_EXCEEDED';

  constructor(tableName: string, maxSeats: number) {
    super(`Bàn "${tableName}" đã đủ chỗ (${maxSeats}/${maxSeats}). Vui lòng chọn bàn khác.`);
    this.name = 'TableCapacityExceededError';
  }
}
