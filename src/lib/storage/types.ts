import { AttachmentEntityType, ImageVariantType, ProcessingStatus } from '@/schemas/files';

export class StorageError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ImageProcessingError extends StorageError {
  constructor(code: string, message: string) {
    super(code, message, 400);
    this.name = 'ImageProcessingError';
  }
}

export class SecurityPathError extends StorageError {
  constructor(message: string) {
    super('PATH_TRAVERSAL_DETECTED', message, 403);
    this.name = 'SecurityPathError';
  }
}

export type DetectedFileType =
  | { kind: 'image'; mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; ext: '.jpg' | '.png' | '.webp' }
  | { kind: 'pdf'; mimeType: 'application/pdf'; ext: '.pdf' };

export interface ImageRenditionResult {
  variantType: ImageVariantType;
  storageKey: string;
  buffer: Buffer;
  width: number;
  height: number;
  fileSizeBytes: bigint;
  mimeType: 'image/webp';
}

export interface ProcessedImageResult {
  originalWidth: number;
  originalHeight: number;
  renditions: ImageRenditionResult[];
}
