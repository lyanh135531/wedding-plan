import sharp, { type Metadata } from 'sharp';
import { ImageProcessingError, ProcessedImageResult, ImageRenditionResult, StorageError } from './types';

// Vô hiệu hóa cache libvips trong RAM để tránh giữ file handle trên Windows/Linux và giải phóng bộ nhớ ngay
sharp.cache(false);
sharp.concurrency(1);

/**
 * Giới hạn tối đa 40 megapixel sau giải mã (PLAN §17.1, RV11, AT39)
 * 40 MP tương đương độ phân giải ~7745 x 5164 px
 */
export const MAX_ALLOWED_PIXELS = 40_000_000;

/**
 * Async Semaphore điều phối tối đa 2 tác vụ Sharp đồng thời trên toàn ứng dụng (PLAN §17.1, RV11)
 */
export class AsyncSemaphore {
  private maxConcurrent: number;
  private currentActive: number = 0;
  private waitQueue: Array<() => void> = [];

  constructor(maxConcurrent: number = 2) {
    this.maxConcurrent = maxConcurrent;
  }

  async acquire(): Promise<() => void> {
    if (this.currentActive < this.maxConcurrent) {
      this.currentActive++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    return new Promise<() => void>((resolve) => {
      this.waitQueue.push(() => {
        this.currentActive++;
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.release();
          }
        });
      });
    });
  }

  private release(): void {
    this.currentActive--;
    if (this.waitQueue.length > 0 && this.currentActive < this.maxConcurrent) {
      const nextTask = this.waitQueue.shift();
      if (nextTask) {
        nextTask();
      }
    }
  }

  getActiveCount(): number {
    return this.currentActive;
  }

  getQueueLength(): number {
    return this.waitQueue.length;
  }
}

export const globalSharpLimiter = new AsyncSemaphore(2);

/**
 * Pipeline xử lý ảnh Sharp:
 * 1. Kiểm tra giới hạn 40 Megapixel trước khi decode toàn diện
 * 2. Tự động xoay theo EXIF orientation (.rotate())
 * 3. Loại bỏ toàn bộ EXIF/GPS/Device metadata khỏi các biến thể hiển thị
 * 4. Sinh biến thể preview_1600 (WebP, max long edge 1600px, withoutEnlargement: true, quality 80)
 * 5. Sinh biến thể thumbnail_320 (WebP, max long edge 320px, withoutEnlargement: true, quality 75)
 * 6. Quản lý đồng thời qua globalSharpLimiter (tối đa 2 slots)
 */
export async function processImageWithSharp(
  inputBuffer: Buffer,
  baseStoragePrefix: string,
  attachmentUuid: string
): Promise<ProcessedImageResult> {
  const releaseSlot = await globalSharpLimiter.acquire();

  try {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new ImageProcessingError(
            'PROCESSING_TIMEOUT',
            'Thời gian xử lý ảnh vượt quá thời gian tối đa cho phép (30 giây).'
          )
        );
      }, 30000);
      if (timer.unref) timer.unref();
    });

    const executionPromise = (async (): Promise<ProcessedImageResult> => {
      // Khởi tạo Sharp instance với cấu hình chặn decompression bomb ở tầng libvips
    let metadata: Metadata;
    try {
      const probePipeline = sharp(inputBuffer, {
        limitInputPixels: MAX_ALLOWED_PIXELS,
        failOn: 'error',
      });
      metadata = await probePipeline.metadata();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.toLowerCase().includes('exceeds pixel limit') || errMsg.toLowerCase().includes('pixel limit')) {
        throw new ImageProcessingError(
          'DECOMPRESSION_BOMB_LIMIT_EXCEEDED',
          'Ảnh vượt quá giới hạn tối đa 40 megapixel cho phép.'
        );
      }
      throw new ImageProcessingError(
        'IMAGE_DECODE_FAILED',
        `Không thể giải mã hoặc đọc thông tin tệp ảnh: ${errMsg}`
      );
    }

    if (!metadata.width || !metadata.height) {
      throw new ImageProcessingError(
        'INVALID_IMAGE_DIMENSIONS',
        'Không thể xác định kích thước hợp lệ của tệp ảnh.'
      );
    }

    const totalPixels = metadata.width * metadata.height;
    if (totalPixels > MAX_ALLOWED_PIXELS) {
      throw new ImageProcessingError(
        'DECOMPRESSION_BOMB_LIMIT_EXCEEDED',
        `Ảnh có độ phân giải ${metadata.width}x${metadata.height} (${(totalPixels / 1_000_000).toFixed(1)} MP), vượt quá giới hạn tối đa 40 megapixel cho phép.`
      );
    }

    // 1. Pipeline tự động xoay theo EXIF orientation tag (.rotate())
    const rotatedPipeline = sharp(inputBuffer, {
      limitInputPixels: MAX_ALLOWED_PIXELS,
      failOn: 'error',
    }).rotate();

    // 2. Tạo bản Preview 1600px WebP (EXIF/GPS stripped, quality 80)
    const previewStorageKey = `${baseStoragePrefix}/${attachmentUuid}-preview.webp`;
    let previewBuffer: Buffer;
    try {
      previewBuffer = await rotatedPipeline
        .clone()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: 80,
          effort: 4,
        })
        .toBuffer();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new ImageProcessingError(
        'IMAGE_DECODE_FAILED',
        `Lỗi khi sinh bản preview 1600px: ${errMsg}`
      );
    }

    const previewMeta = await sharp(previewBuffer).metadata();

    const previewRendition: ImageRenditionResult = {
      variantType: 'preview_1600',
      storageKey: previewStorageKey,
      buffer: previewBuffer,
      width: previewMeta.width || metadata.width,
      height: previewMeta.height || metadata.height,
      fileSizeBytes: BigInt(previewBuffer.byteLength),
      mimeType: 'image/webp',
    };

    // 3. Tạo bản Thumbnail 320px WebP (EXIF/GPS stripped, quality 75)
    const thumbStorageKey = `${baseStoragePrefix}/${attachmentUuid}-thumb.webp`;
    let thumbBuffer: Buffer;
    try {
      thumbBuffer = await rotatedPipeline
        .clone()
        .resize({
          width: 320,
          height: 320,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: 75,
          effort: 4,
        })
        .toBuffer();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new ImageProcessingError(
        'IMAGE_DECODE_FAILED',
        `Lỗi khi sinh bản thumbnail 320px: ${errMsg}`
      );
    }

    const thumbMeta = await sharp(thumbBuffer).metadata();

    const thumbRendition: ImageRenditionResult = {
      variantType: 'thumbnail_320',
      storageKey: thumbStorageKey,
      buffer: thumbBuffer,
      width: thumbMeta.width || metadata.width,
      height: thumbMeta.height || metadata.height,
      fileSizeBytes: BigInt(thumbBuffer.byteLength),
      mimeType: 'image/webp',
    };

    return {
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      renditions: [previewRendition, thumbRendition],
    };
  })();

  try {
    return await Promise.race([executionPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  } catch (err: unknown) {
    if (err instanceof StorageError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Lỗi xử lý ảnh Sharp không xác định.';
    throw new ImageProcessingError('IMAGE_DECODE_FAILED', `Không thể giải mã hoặc xử lý tệp ảnh: ${message}`);
  } finally {
    releaseSlot();
  }
}
