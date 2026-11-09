import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db/client';
import { attachments, attachmentVariants } from '@/db/schema/files';
import { eq } from 'drizzle-orm';
import { getCurrentSession } from '@/lib/auth/session';
import {
  getUploadRootDir,
  ensureUploadDirExists,
  safeResolvePath,
  inspectFileMagicBytes,
  computeSha256,
  writeAtomicFile,
  safeUnlinkFile,
} from '@/lib/storage/storage';
import { processImageWithSharp } from '@/lib/storage/sharp';
import { StorageError } from '@/lib/storage/types';
import {
  attachmentEntityTypeEnum,
  MAX_IMAGE_FILE_SIZE,
  MAX_PDF_FILE_SIZE,
} from '@/schemas/files';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Giới hạn request tối đa: 21 MiB cho ảnh (20 MiB tệp + 1 MiB multipart overhead)
 */
const MAX_REQUEST_SIZE = 21 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // 1. Kiểm tra kích thước Content-Length sơ bộ để bảo vệ server (RV11, AT44)
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(contentLength) && contentLength > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        {
          error: 'PAYLOAD_TOO_LARGE',
          message: 'Dung lượng yêu cầu tải lên vượt quá giới hạn tối đa cho phép (21 MiB).',
        },
        { status: 413 }
      );
    }
  }

  // 2. Xác thực phiên người dùng & Phân quyền (PLAN §5.1, §17.1)
  const session = await getCurrentSession(req);

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: 'UNAUTHORIZED',
        message: 'Bạn phải đăng nhập để thực hiện tải tệp lên.',
      },
      { status: 401 }
    );
  }

  const authUserId = session.user.id;
  const authUserRole = session.role;

  // Người nhà chỉ xem TUYỆT ĐỐI không được phép upload (PLAN §5.1, §17.1, AT41)
  if (authUserRole !== 'owner') {
    return NextResponse.json(
      {
        error: 'FORBIDDEN',
        message: 'Tài khoản Người nhà chỉ có quyền xem, không được phép tải lên tệp.',
      },
      { status: 403 }
    );
  }

  // 3. Phân giải Multipart Form-Data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      {
        error: 'BAD_REQUEST',
        message: 'Yêu cầu không phải multipart/form-data hợp lệ hoặc luồng truyền bị gián đoạn.',
      },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      {
        error: 'BAD_REQUEST',
        message: 'Thiếu trường tệp tải lên (file).',
      },
      { status: 400 }
    );
  }

  const entityTypeRaw = formData.get('entity_type');
  const entityIdRaw = formData.get('entity_id');
  const isPrivateRaw = formData.get('is_private');
  const ownerOnlyRaw = formData.get('owner_only');

  const entityTypeParsed = attachmentEntityTypeEnum.safeParse(entityTypeRaw);
  if (!entityTypeParsed.success) {
    return NextResponse.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Trường entity_type không hợp lệ (phải là cost_item, vendor, wedding, hoặc task).',
      },
      { status: 400 }
    );
  }

  const entityType = entityTypeParsed.data;
  let entityId: string | null = null;
  if (entityIdRaw && typeof entityIdRaw === 'string' && entityIdRaw.trim() !== '') {
    const trimmed = entityIdRaw.trim();
    if (!z.string().uuid().safeParse(trimmed).success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Trường entity_id không phải định dạng UUID hợp lệ.',
        },
        { status: 400 }
      );
    }
    entityId = trimmed;
  }
  const isPrivate = isPrivateRaw === 'false' ? false : true;
  // Tệp thuộc cost_item (tài chính) luôn luôn là ownerOnly = true (AT03)
  const ownerOnly = entityType === 'cost_item' ? true : (ownerOnlyRaw === 'false' ? false : true);

  // 4. Đọc buffer tệp và kiểm tra kích thước nghiêm ngặt
  const fileArrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(fileArrayBuffer);
  const fileSizeBytes = BigInt(fileBuffer.byteLength);

  // 5. Kiểm tra Magic Bytes đầu tệp
  let detectedType;
  try {
    detectedType = inspectFileMagicBytes(fileBuffer);
  } catch (err: unknown) {
    if (err instanceof StorageError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { error: 'INVALID_FILE', message: 'Tệp không hợp lệ.' },
      { status: 400 }
    );
  }

  // 6. Kiểm tra giới hạn kích thước theo loại tệp thực tế (20 MiB ảnh / 10 MiB PDF)
  if (detectedType.kind === 'image' && fileBuffer.byteLength > MAX_IMAGE_FILE_SIZE) {
    return NextResponse.json(
      {
        error: 'PAYLOAD_TOO_LARGE',
        message: `Dung lượng tệp ảnh ${(fileBuffer.byteLength / (1024 * 1024)).toFixed(1)} MiB vượt quá giới hạn tối đa 20 MiB cho phép.`,
      },
      { status: 413 }
    );
  }

  if (detectedType.kind === 'pdf' && fileBuffer.byteLength > MAX_PDF_FILE_SIZE) {
    return NextResponse.json(
      {
        error: 'PAYLOAD_TOO_LARGE',
        message: `Dung lượng tệp tài liệu PDF ${(fileBuffer.byteLength / (1024 * 1024)).toFixed(1)} MiB vượt quá giới hạn tối đa 10 MiB cho phép.`,
      },
      { status: 413 }
    );
  }

  // 7. Chuẩn bị định danh và đường dẫn lưu trữ
  const now = new Date();
  const year = now.getUTCFullYear().toString();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const baseStoragePrefix = `${year}/${month}`;

  const attachmentUuid = crypto.randomUUID();
  const canonicalStorageKey = `${baseStoragePrefix}/${attachmentUuid}${detectedType.ext}`;
  const checksumSha256 = computeSha256(fileBuffer);

  const rootUploadDir = getUploadRootDir();
  ensureUploadDirExists(rootUploadDir);

  const absoluteOriginalPath = safeResolvePath(rootUploadDir, canonicalStorageKey);
  const writtenFilePaths: string[] = [];

  // 8. Phase 1: Tạo bản ghi attachments với trạng thái pending (Two-Phase Commit - AT42)
  const leaseExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút lease

  try {
    await db.insert(attachments).values({
      id: attachmentUuid,
      storageKey: canonicalStorageKey,
      originalName: file.name || `file_${attachmentUuid}${detectedType.ext}`,
      mimeType: detectedType.mimeType,
      fileSizeBytes: fileSizeBytes,
      checksumSha256: checksumSha256,
      isPrivate: isPrivate,
      ownerOnly: ownerOnly,
      entityType: entityType,
      entityId: entityId,
      processingStatus: 'pending',
      uploaderUserId: authUserId,
      leaseExpiresAt: leaseExpiresAt,
      createdAt: now,
      updatedAt: now,
    });
  } catch (dbErr: unknown) {
    const errMessage = dbErr instanceof Error ? dbErr.message : String(dbErr);
    return NextResponse.json(
      {
        error: 'DB_ERROR',
        message: `Không thể khởi tạo bản ghi đính kèm trong cơ sở dữ liệu: ${errMessage}`,
      },
      { status: 500 }
    );
  }

  // 9. Phase 2 & 3: Ghi filesystem, xử lý Sharp và hoàn tất cơ sở dữ liệu
  try {
    // 9.1. Ghi tệp gốc ra đĩa
    await writeAtomicFile(absoluteOriginalPath, fileBuffer);
    writtenFilePaths.push(absoluteOriginalPath);

    let originalWidth: number | null = null;
    let originalHeight: number | null = null;
    const variantsToInsert: Array<{
      attachmentId: string;
      variantType: 'thumbnail_320' | 'preview_1600';
      storageKey: string;
      fileSizeBytes: bigint;
      width: number;
      height: number;
    }> = [];

    // 9.2. Nếu là ảnh, chạy Sharp Pipeline
    if (detectedType.kind === 'image') {
      const sharpResult = await processImageWithSharp(fileBuffer, baseStoragePrefix, attachmentUuid);
      originalWidth = sharpResult.originalWidth;
      originalHeight = sharpResult.originalHeight;

      // Ghi các biến thể WebP ra đĩa
      for (const rendition of sharpResult.renditions) {
        const absoluteRenditionPath = safeResolvePath(rootUploadDir, rendition.storageKey);
        await writeAtomicFile(absoluteRenditionPath, rendition.buffer);
        writtenFilePaths.push(absoluteRenditionPath);

        variantsToInsert.push({
          attachmentId: attachmentUuid,
          variantType: rendition.variantType,
          storageKey: rendition.storageKey,
          fileSizeBytes: rendition.fileSizeBytes,
          width: rendition.width,
          height: rendition.height,
        });
      }
    }

    // 9.3. Hoàn tất cập nhật DB: Thêm variants và cập nhật status = 'ready'
    if (variantsToInsert.length > 0) {
      await db.insert(attachmentVariants).values(variantsToInsert);
    }

    await db
      .update(attachments)
      .set({
        width: originalWidth,
        height: originalHeight,
        processingStatus: 'ready',
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(attachments.id, attachmentUuid));

    // 10. Trả về DTO Owner thành công (HTTP 201)
    return NextResponse.json(
      {
        id: attachmentUuid,
        storage_key: canonicalStorageKey,
        original_name: file.name || `file_${attachmentUuid}${detectedType.ext}`,
        mime_type: detectedType.mimeType,
        file_size_bytes: Number(fileSizeBytes),
        width: originalWidth,
        height: originalHeight,
        checksum_sha256: checksumSha256,
        is_private: isPrivate,
        owner_only: ownerOnly,
        entity_type: entityType,
        entity_id: entityId,
        processing_status: 'ready',
        uploader_user_id: authUserId,
        created_at: now.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    // ═══════════════════════════════════════════════════════════════
    // COMPENSATION ROLLBACK (BÙ TRỪ KHI GẶP LỖI - AT42)
    // ═══════════════════════════════════════════════════════════════
    // Xóa toàn bộ các tệp vật lý đã ghi dở trên đĩa
    for (const filePath of writtenFilePaths) {
      await safeUnlinkFile(filePath);
    }

    const errorMessage = err instanceof Error ? err.message : 'Lỗi xử lý tệp.';

    // Cập nhật DB sang trạng thái failed để phục vụ đối soát, không để ready mồ côi
    try {
      await db
        .update(attachments)
        .set({
          processingStatus: 'failed',
          errorMessage: errorMessage,
          leaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(attachments.id, attachmentUuid));
    } catch {
      // Bỏ qua lỗi cập nhật DB failed
    }

    if (err instanceof StorageError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      {
        error: 'PROCESSING_FAILED',
        message: `Xử lý tệp tải lên thất bại: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
