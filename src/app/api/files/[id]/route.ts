import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { Readable } from 'node:stream';
import { db } from '@/db/client';
import { attachments, attachmentVariants } from '@/db/schema/files';
import { eq, and } from 'drizzle-orm';
import { getCurrentSession } from '@/lib/auth/session';
import { getUploadRootDir, safeResolvePath } from '@/lib/storage/storage';
import { SecurityPathError } from '@/lib/storage/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Kiểm tra UUID hợp lệ
  const parseResult = uuidParamSchema.safeParse(params.id);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Mã định danh tệp không hợp lệ.' },
      { status: 400 }
    );
  }
  const attachmentId = parseResult.data;

  // 2. Xác thực phiên người dùng (PLAN §5.1, AT03, AT41)
  const session = await getCurrentSession(req);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập để truy cập tệp.' },
      { status: 401 }
    );
  }

  const authUserId = session.user.id;
  const authUserRole = session.role;

  // 3. Phân giải query parameter variant (?variant=thumbnail | ?variant=preview)
  const variantParam = req.nextUrl.searchParams.get('variant');

  // 4. Truy vấn metadata tệp từ Database
  const [attachment] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, attachmentId))
    .limit(1);

  if (!attachment) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Không tìm thấy tệp yêu cầu.' },
      { status: 404 }
    );
  }

  // Nếu tệp đã bị lưu trữ mềm (soft-deleted)
  if (attachment.isArchived) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Tệp đã bị xóa hoặc lưu trữ.' },
      { status: 404 }
    );
  }

  // Nếu tệp chưa sẵn sàng hoặc bị lỗi xử lý
  if (attachment.processingStatus !== 'ready') {
    return NextResponse.json(
      {
        error: attachment.processingStatus === 'failed' ? 'FILE_FAILED' : 'FILE_NOT_READY',
        message: attachment.processingStatus === 'failed'
          ? 'Tệp bị lỗi trong quá trình xử lý.'
          : 'Tệp đang được xử lý, vui lòng thử lại sau giây lát.',
      },
      { status: attachment.processingStatus === 'failed' ? 410 : 409 }
    );
  }

  // 5. Kiểm tra quyền truy cập nghiêm ngặt theo vai trò (PLAN §5.1, §17.1, AT03, AT41)
  if (authUserRole !== 'owner') {
    // 5.1. Chặn tuyệt đối tệp tài chính và tệp riêng tư đối với Người nhà (AT03, AT41)
    if (attachment.ownerOnly || attachment.isPrivate || attachment.entityType === 'cost_item') {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Tài khoản Người nhà không có quyền truy cập tệp tài chính hoặc tài liệu riêng tư này.',
        },
        { status: 403 }
      );
    }

    // 5.2. Chặn Người nhà lấy ảnh gốc chứa siêu dữ liệu EXIF/GPS (PLAN §17.1, line 549, AT41)
    // Người nhà CHỈ ĐƯỢC PHÉP xem các biến thể hiển thị WebP (thumbnail hoặc preview)
    if (!variantParam || (variantParam !== 'thumbnail' && variantParam !== 'preview')) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Tài khoản Người nhà chỉ được phép xem các biến thể hiển thị đã loại bỏ siêu dữ liệu.',
        },
        { status: 403 }
      );
    }
  }

  // 6. Xác định khóa lưu trữ vật lý cần phục vụ
  let targetStorageKey = attachment.storageKey;
  let responseMimeType = attachment.mimeType;

  if (variantParam === 'thumbnail') {
    const [variant] = await db
      .select()
      .from(attachmentVariants)
      .where(
        and(
          eq(attachmentVariants.attachmentId, attachmentId),
          eq(attachmentVariants.variantType, 'thumbnail_320')
        )
      )
      .limit(1);

    if (!variant) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Không tìm thấy biến thể thumbnail.' },
        { status: 404 }
      );
    }
    targetStorageKey = variant.storageKey;
    responseMimeType = variant.mimeType;
  } else if (variantParam === 'preview') {
    const [variant] = await db
      .select()
      .from(attachmentVariants)
      .where(
        and(
          eq(attachmentVariants.attachmentId, attachmentId),
          eq(attachmentVariants.variantType, 'preview_1600')
        )
      )
      .limit(1);

    if (!variant) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Không tìm thấy biến thể preview.' },
        { status: 404 }
      );
    }
    targetStorageKey = variant.storageKey;
    responseMimeType = variant.mimeType;
  }

  // 7. Giải quyết đường dẫn vật lý an toàn chống Path Traversal (AT41)
  const rootUploadDir = getUploadRootDir();
  let absoluteFilePath: string;
  try {
    absoluteFilePath = safeResolvePath(rootUploadDir, targetStorageKey);
  } catch (pathErr: unknown) {
    if (pathErr instanceof SecurityPathError) {
      return NextResponse.json(
        { error: pathErr.code, message: pathErr.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Đường dẫn tệp không hợp lệ.' },
      { status: 403 }
    );
  }

  if (!fs.existsSync(absoluteFilePath)) {
    console.error(`[Storage Anomaly] Tệp ghi nhận trong DB nhưng mất trên filesystem: ${absoluteFilePath}`);
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Tệp không tồn tại trên hệ thống lưu trữ.' },
      { status: 404 }
    );
  }

  // 8. Đọc thông tin kích thước và tạo luồng đọc (Stream)
  const stat = await fs.promises.stat(absoluteFilePath);
  const nodeStream = fs.createReadStream(absoluteFilePath);

  // Chuyển đổi Node ReadStream sang Web ReadableStream cho Next.js Response có backpressure
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  // Tên tệp an toàn cho header Content-Disposition
  const safeFilename = encodeURIComponent(attachment.originalName);

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': responseMimeType,
      'Content-Length': stat.size.toString(),
      'Content-Disposition': `inline; filename*=UTF-8''${safeFilename}`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
