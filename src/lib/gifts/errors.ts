export class GiftNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'GIFT_NOT_FOUND';

  constructor(id: string) {
    super(`Không tìm thấy quà mừng với ID: ${id}`);
    this.name = 'GiftNotFoundError';
  }
}

export class GiftAlreadyVoidedError extends Error {
  readonly statusCode = 400;
  readonly code = 'GIFT_ALREADY_VOIDED';

  constructor(message = 'Quà mừng này đã được hủy bỏ trước đó.') {
    super(message);
    this.name = 'GiftAlreadyVoidedError';
  }
}

export class GiftReturnExceedsBalanceError extends Error {
  readonly statusCode = 400;
  readonly code = 'GIFT_RETURN_EXCEEDS_BALANCE';

  constructor(heldBalance: bigint, requestedReturn: bigint) {
    super(
      `Số tiền trả lại (${requestedReturn.toLocaleString('vi-VN')} ₫) vượt quá số tiền quà còn giữ (${heldBalance.toLocaleString('vi-VN')} ₫).`
    );
    this.name = 'GiftReturnExceedsBalanceError';
  }
}

export class PhysicalGiftReturnNotAllowedError extends Error {
  readonly statusCode = 400;
  readonly code = 'PHYSICAL_GIFT_RETURN_NOT_ALLOWED';

  constructor(message = 'Không thể ghi nhận hoàn tiền mặt đối với quà hiện vật.') {
    super(message);
    this.name = 'PhysicalGiftReturnNotAllowedError';
  }
}

export class OptimisticLockError extends Error {
  readonly statusCode = 409;
  readonly code = 'OPTIMISTIC_LOCK_CONFLICT';
  readonly currentVersion?: number;

  constructor(message = 'Dữ liệu quà mừng đã bị thay đổi bởi người khác.', currentVersion?: number) {
    super(message);
    this.name = 'OptimisticLockError';
    this.currentVersion = currentVersion;
  }
}
