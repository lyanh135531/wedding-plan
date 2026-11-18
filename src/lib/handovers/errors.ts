export class HandoverPacketNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'HANDOVER_PACKET_NOT_FOUND';

  constructor(id: string) {
    super(`Không tìm thấy bộ bàn giao với ID: ${id}`);
    this.name = 'HandoverPacketNotFoundError';
  }
}

export class HandoverAlreadyDeliveredError extends Error {
  readonly statusCode = 400;
  readonly code = 'HANDOVER_ALREADY_DELIVERED';

  constructor(message = 'Bộ bàn giao này đã được ghi nhận bàn giao trước đó.') {
    super(message);
    this.name = 'HandoverAlreadyDeliveredError';
  }
}

export class HandoverOutdatedError extends Error {
  readonly statusCode = 409;
  readonly code = 'OUTDATED_HANDOVER';
  constructor() { super('Dữ liệu đã thay đổi sau bản chốt. Hãy tạo bản chốt mới trước khi bàn giao.'); }
}
