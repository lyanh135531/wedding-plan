import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import crypto from 'crypto';
import { StorageError, SecurityPathError, DetectedFileType } from './types';

/**
 * Lấy thư mục gốc lưu trữ ngoài web root (PLAN §17.1, §21.4)
 */
export function getUploadRootDir(): string {
  const configuredDir = process.env.UPLOAD_DIR;
  if (configuredDir && configuredDir.trim().length > 0) {
    return path.resolve(configuredDir.trim());
  }

  if (process.env.NODE_ENV === 'production') {
    return path.resolve('/data/uploads');
  }

  // Môi trường dev / test
  return path.resolve(process.cwd(), '.uploads_dev');
}

/**
 * Đảm bảo thư mục lưu trữ tồn tại
 */
export function ensureUploadDirExists(dirPath: string = getUploadRootDir()): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Sinh khóa lưu trữ máy chủ kiểm soát theo phân cấp thời gian:
 * <year>/<month>/<attachment_uuid>.<ext>
 */
export function generateStorageKey(uuid: string, ext: string, date: Date = new Date()): string {
  const year = date.getUTCFullYear().toString();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
  return `${year}/${month}/${uuid}${normalizedExt}`;
}

/**
 * Xác thực rằng khóa lưu trữ không chứa điều hướng thư mục nguy hiểm (AT41)
 * Chấp nhận khóa tương đối an toàn hoặc đường dẫn canonical bắt đầu bằng /data/uploads/
 * Chặn đứng '..', null-bytes '\0', dấu gạch chéo ngược Windows '\\', và các URL-encoded traversals (%2e, %2f, %5c).
 */
export function validateStorageKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;

  // 1. Chặn điều hướng thư mục cha, null byte, backslash, hoặc URL-encoded traversals
  if (key.includes('..') || key.includes('\0') || key.includes('\\')) {
    return false;
  }
  if (/%2e|%2f|%5c/i.test(key)) {
    return false;
  }

  // 2. Chính sách đường dẫn tuyệt đối: chỉ cho phép canonical storage root '/data/uploads/'
  if (key.startsWith('/')) {
    if (!key.startsWith('/data/uploads/')) {
      return false;
    }
  }

  // 3. Giới hạn tập ký tự cho phép: chữ cái, số, gạch dưới, gạch ngang, dấu chấm, dấu gạch chéo
  if (!/^[a-zA-Z0-9_\-./]+$/.test(key)) {
    return false;
  }

  // 4. Chặn trailing slash (khóa lưu trữ phải trỏ tới một file object, không phải thư mục)
  if (key.endsWith('/')) {
    return false;
  }

  return true;
}

/**
 * Giải quyết đường dẫn tệp an toàn tuyệt đối chống tấn công Path Traversal (AT41)
 */
export function safeResolvePath(rootDir: string, storageKey: string): string {
  if (!storageKey || typeof storageKey !== 'string') {
    throw new SecurityPathError('Khóa lưu trữ không hợp lệ.');
  }

  // 1. Xác thực bảo mật khóa lưu trữ
  if (!validateStorageKey(storageKey)) {
    throw new SecurityPathError(
      `Khóa lưu trữ '${storageKey}' chứa ký tự nguy hiểm hoặc vi phạm nguyên tắc bảo mật đường dẫn.`
    );
  }

  // 2. Chuẩn hóa đường dẫn tương đối so với rootDir
  const rootCanonical = path.resolve(rootDir);
  let relativeKey = storageKey;
  if (relativeKey.startsWith('/data/uploads/')) {
    relativeKey = relativeKey.substring('/data/uploads/'.length);
  } else {
    relativeKey = relativeKey.replace(/^\/+/, '');
  }

  const resolvedTarget = path.resolve(rootCanonical, relativeKey);

  // 3. Đảm bảo đường dẫn đích nằm nghiêm ngặt bên trong thư mục gốc
  const expectedPrefix = rootCanonical.endsWith(path.sep) ? rootCanonical : rootCanonical + path.sep;
  if (!resolvedTarget.startsWith(expectedPrefix) && resolvedTarget !== rootCanonical) {
    throw new SecurityPathError('Phát hiện hành vi điều hướng ra ngoài thư mục lưu trữ cho phép.');
  }

  return resolvedTarget;
}

/**
 * Kiểm tra Magic Bytes đầu tệp và trả về loại MIME chính xác kèm thông báo lỗi cụ thể (AT39)
 */
export function inspectFileMagicBytes(buffer: Buffer): DetectedFileType {
  if (buffer.length < 4) {
    throw new StorageError(
      'CORRUPT_OR_EMPTY_FILE',
      'Tệp rỗng hoặc dung lượng quá nhỏ không thể xác định định dạng.',
      400
    );
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { kind: 'image', mimeType: 'image/jpeg', ext: '.jpg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { kind: 'image', mimeType: 'image/png', ext: '.png' };
  }

  // 3. WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { kind: 'image', mimeType: 'image/webp', ext: '.webp' };
  }

  // 4. PDF: %PDF (bytes 0..4)
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return { kind: 'pdf', mimeType: 'application/pdf', ext: '.pdf' };
  }

  // 5. Kiểm tra các định dạng bị từ chối chủ động kèm thông báo hướng dẫn cụ thể (PLAN §17.1, RV11, AT39)

  // HEIC/HEIF: offset 4..11 chứa ftyp và brand heic, mif1, msf1, heix, hevc
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (['heic', 'mif1', 'msf1', 'heix', 'hevc'].includes(brand)) {
      throw new StorageError(
        'UNSUPPORTED_HEIC_FORMAT',
        'Định dạng ảnh HEIC/HEIF từ iPhone chưa được hỗ trợ trực tiếp. Vui lòng chuyển đổi sang JPEG hoặc PNG trước khi tải lên. Các định dạng được hỗ trợ: JPEG, PNG, WebP, PDF.',
        400
      );
    }
    // Video MP4 / QuickTime: isom, mp41, mp42, avc1, qt
    if (['isom', 'mp41', 'mp42', 'avc1', 'qt  '].includes(brand)) {
      throw new StorageError(
        'UNSUPPORTED_VIDEO_FORMAT',
        'Hệ thống chỉ hỗ trợ lưu trữ ảnh và chứng từ tài liệu (PDF). Định dạng video không được hỗ trợ. Các định dạng được hỗ trợ: JPEG, PNG, WebP, PDF.',
        400
      );
    }
  }

  // WebM / MKV (EBML signature: \x1A\x45\xDF\xA3)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    throw new StorageError(
      'UNSUPPORTED_VIDEO_FORMAT',
      'Hệ thống chỉ hỗ trợ lưu trữ ảnh và chứng từ tài liệu (PDF). Định dạng video không được hỗ trợ. Các định dạng được hỗ trợ: JPEG, PNG, WebP, PDF.',
      400
    );
  }

  // SVG: chuỗi chứa <?xml hoặc <svg trong 256 byte đầu
  const headerPreview = buffer.toString('utf8', 0, Math.min(buffer.length, 256)).toLowerCase().trim();
  if (headerPreview.includes('<svg') || (headerPreview.includes('<?xml') && headerPreview.includes('<svg'))) {
    throw new StorageError(
      'UNSUPPORTED_SVG_FORMAT',
      'Định dạng SVG không được hỗ trợ để đảm bảo an toàn bảo mật. Các định dạng được hỗ trợ: JPEG, PNG, WebP, PDF.',
      400
    );
  }

  // GIF: GIF87a hoặc GIF89a
  if (buffer.length >= 6) {
    const gifHeader = buffer.toString('ascii', 0, 6);
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
      throw new StorageError(
        'UNSUPPORTED_GIF_FORMAT',
        'Định dạng GIF động không được hỗ trợ. Các định dạng được hỗ trợ: JPEG, PNG, WebP, PDF.',
        400
      );
    }
  }

  // RAW: TIFF headers II*\0 hoặc MM\0* (Canon CR2, Nikon NEF, Sony ARW)
  if (buffer.length >= 4) {
    if (
      (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
      (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
    ) {
      throw new StorageError(
        'UNSUPPORTED_RAW_FORMAT',
        'Tệp ảnh gốc RAW dung lượng lớn chưa được hỗ trợ. Vui lòng xuất ảnh sang định dạng JPEG hoặc PNG trước khi tải lên. Các định dạng được hỗ trợ: JPEG, PNG, WebP, PDF.',
        400
      );
    }
  }

  // Mặc định từ chối các định dạng không rõ
  throw new StorageError(
    'INVALID_FILE_SIGNATURE',
    'Định dạng tệp không hợp lệ hoặc không được hỗ trợ. Chỉ chấp nhận các định dạng: JPEG, PNG, WebP, PDF.',
    400
  );
}

/**
 * Tính mã băm SHA-256 của buffer
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Ghi tệp an toàn nguyên tử (Atomic write via .tmp rename)
 */
export async function writeAtomicFile(absolutePath: string, buffer: Buffer): Promise<void> {
  const dir = path.dirname(absolutePath);
  await fs.mkdir(dir, { recursive: true });

  const tempPath = `${absolutePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(tempPath, buffer);
    await fs.rename(tempPath, absolutePath);
  } catch (err) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup error of temp file
    }
    throw err;
  }
}

/**
 * Xóa tệp an toàn nếu tồn tại (không quăng lỗi nếu tệp không tồn tại)
 */
export async function safeUnlinkFile(absolutePath: string): Promise<void> {
  try {
    await fs.unlink(absolutePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`Không thể xóa tệp ${absolutePath}:`, err);
    }
  }
}
