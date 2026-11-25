import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq, ilike } from 'drizzle-orm';
import { withTransactionScopedContext } from '@/db/client';
import { attachments } from '@/db/schema/files';
import { getCurrentSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const offset = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get('offset') || '0') || 0);
  const limitParam = Number.parseInt(req.nextUrl.searchParams.get('limit') || '100');
  const limit = Number.isFinite(limitParam) ? Math.min(100, Math.max(1, limitParam)) : 100;
  const archived = session.role === 'owner' && req.nextUrl.searchParams.get('archived') === 'true';
  const query = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 255).replace(/[\\%_]/g, '\\$&');

  const whereClause = and(
    eq(attachments.isArchived, archived),
    eq(attachments.processingStatus, 'ready'),
    session.role === 'owner' ? undefined : ilike(attachments.mimeType, 'image/%'),
    query ? ilike(attachments.originalName, `%${query}%`) : undefined
  );

  try {
    const { total, rows } = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, db) => {
        const [countRow] = await db.select({ total: count() }).from(attachments).where(whereClause);
        const rows = await db
          .select({
            id: attachments.id,
            originalName: attachments.originalName,
            mimeType: attachments.mimeType,
            fileSizeBytes: attachments.fileSizeBytes,
            createdAt: attachments.createdAt,
            isArchived: attachments.isArchived,
            updatedAt: attachments.updatedAt,
          })
          .from(attachments)
          .where(whereClause)
          .orderBy(desc(attachments.createdAt), desc(attachments.id))
          .limit(limit)
          .offset(offset);
        return { total: Number(countRow?.total ?? 0), rows };
      }
    );

    return NextResponse.json({
      data: rows.map((file) => ({ ...file, fileSizeBytes: file.fileSizeBytes.toString() })),
      total,
      hasMore: offset + rows.length < total,
    });
  } catch (error) {
    console.error('[documents]', error);
    return NextResponse.json({ error: 'Không thể tải danh sách tài liệu.' }, { status: 500 });
  }
}
