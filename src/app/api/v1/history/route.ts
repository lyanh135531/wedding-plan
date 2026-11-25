import { NextRequest, NextResponse } from 'next/server';
import { count, desc } from 'drizzle-orm';
import { withTransactionScopedContext } from '@/db/client';
import { auditLogs } from '@/db/schema/system';
import { getCurrentSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (session.role !== 'owner') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const offset = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get('offset') || '0') || 0);
  const limitParam = Number.parseInt(req.nextUrl.searchParams.get('limit') || '100');
  const limit = Number.isFinite(limitParam) ? Math.min(100, Math.max(1, limitParam)) : 100;

  try {
    const { total, rows } = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, db) => {
        const [countRow] = await db.select({ total: count() }).from(auditLogs);
        const rows = await db
          .select({
            id: auditLogs.id,
            action: auditLogs.action,
            entityType: auditLogs.entityType,
            entityId: auditLogs.entityId,
            userId: auditLogs.userId,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
          .limit(limit)
          .offset(offset);
        return { total: Number(countRow?.total ?? 0), rows };
      }
    );

    return NextResponse.json({
      data: rows,
      total,
      hasMore: offset + rows.length < total,
    });
  } catch (error) {
    console.error('[history]', error);
    return NextResponse.json({ error: 'Không thể tải nhật ký hoạt động.' }, { status: 500 });
  }
}
