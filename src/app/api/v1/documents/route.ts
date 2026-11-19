import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { withTransactionScopedContext } from '@/db/client';
import { attachments } from '@/db/schema/files';
import { getCurrentSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const offset = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get('offset') || '0') || 0);
  const archived = session.role === 'owner' && req.nextUrl.searchParams.get('archived') === 'true';
  const query = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 255).replace(/[\\%_]/g, '\\$&');
  try {
    const data = await withTransactionScopedContext(session.user.id, session.role, async (_client, db) =>
      db.select({ id: attachments.id, originalName: attachments.originalName, mimeType: attachments.mimeType,
        fileSizeBytes: attachments.fileSizeBytes, createdAt: attachments.createdAt, isArchived: attachments.isArchived, updatedAt: attachments.updatedAt,
      }).from(attachments).where(and(eq(attachments.isArchived, archived), eq(attachments.processingStatus, 'ready'), query ? ilike(attachments.originalName, `%${query}%`) : undefined))
        .orderBy(desc(attachments.createdAt), desc(attachments.id)).limit(100).offset(offset));
    return NextResponse.json({ data: data.filter((file) => session.role === 'owner' || file.mimeType.startsWith('image/'))
      .map((file) => ({ ...file, fileSizeBytes: file.fileSizeBytes.toString() })), hasMore: data.length === 100 });
  } catch (error) {
    console.error('[documents]', error);
    return NextResponse.json({ error: 'Không thể tải danh sách tài liệu.' }, { status: 500 });
  }
}
