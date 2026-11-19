import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { bulkMarkInvitationsSent } from '@/lib/guests';
import { z } from 'zod';
import { runIdempotentCreate } from '@/lib/api/mutation';

export const dynamic = 'force-dynamic';

const bulkMarkSentSchema = z.object({
  invitationIds: z.array(z.string().uuid()).min(1, 'Danh sách thiệp không được để trống').max(2000),
  sentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày phải là YYYY-MM-DD').optional(),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'FORBIDDEN: Owner role required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = bulkMarkSentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const todayDate = new Date().toISOString().slice(0, 10);
    const effectiveSentDate = parsed.data.sentDate || todayDate;

    const count = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return runIdempotentCreate(req, txDb, session.user.id, body, async () => bulkMarkInvitationsSent(
          txDb,
          parsed.data.invitationIds,
          effectiveSentDate,
          session.user.id
        ));
      }
    );

    return NextResponse.json({
      success: true,
      updatedCount: count,
      message: `Đã đánh dấu ${count} thiệp ở trạng thái Đã gửi. Trạng thái phản hồi tham dự (RSVP) của khách không bị thay đổi.`,
    });
  } catch (error: any) {
    console.error('[POST /api/v1/invitations/bulk-sent error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: error?.statusCode || 500 });
  }
}
