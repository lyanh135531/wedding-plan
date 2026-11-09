import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { generateRescheduleImpactPreview } from '@/lib/tasks/reschedule.service';
import { z } from 'zod';
import { dateStringSchema } from '@/schemas/common';

export const dynamic = 'force-dynamic';

const reschedulePreviewBodySchema = z.object({
  new_date: dateStringSchema,
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can preview event rescheduling' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = reschedulePreviewBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const preview = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return generateRescheduleImpactPreview(txDb, params.id, parsed.data.new_date);
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(preview, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error(`[POST /api/v1/events/${params.id}/reschedule/preview error]:`, error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
