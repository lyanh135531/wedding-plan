import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { withTransactionScopedContext } from '@/db/client';
import { attachments } from '@/db/schema/files';
import { getCurrentSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const offset = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get('offset') || '0') || 0);
  try {
    const data = await withTransactionScopedContext(session.user.id, session.role, async (_client, db) =>
      db.select({ id: attachments.id, originalName: attachments.originalName, mimeType: attachments.mimeType,
        fileSizeBytes: attachments.fileSizeBytes, createdAt: attachments.createdAt,
      }).from(attachments).where(and(eq(attachments.isArchived, false), eq(attachments.processingStatus, 'ready')))
        .orderBy(desc(attachments.createdAt), desc(attachments.id)).limit(100).offset(offset));
    return NextResponse.json({ data: data.filter((file) => session.role === 'owner' || file.mimeType.startsWith('image/'))
      .map((file) => ({ ...file, fileSizeBytes: file.fileSizeBytes.toString() })), hasMore: data.length === 100 });
  } catch (error) {
    console.error('[documents]', error);
    return NextResponse.json({ error: 'Không thể tải danh sách tài liệu.' }, { status: 500 });
  }
}
