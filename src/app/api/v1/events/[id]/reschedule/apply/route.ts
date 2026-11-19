import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { applyReschedule } from '@/lib/tasks/reschedule.service';
import { z } from 'zod';
import { dateStringSchema } from '@/schemas/common';

export const dynamic = 'force-dynamic';

const rescheduleApplyBodySchema = z.object({
  new_date: dateStringSchema,
});

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can apply event rescheduling' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = rescheduleApplyBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const updated = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return applyReschedule(txDb, params.id, parsed.data.new_date, session.user.id);
      }
    );

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error(`[POST /api/v1/events/${params.id}/reschedule/apply error]:`, error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
