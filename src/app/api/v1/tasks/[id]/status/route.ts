import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { updateTaskStatus } from '@/lib/tasks/tasks.repository';
import { taskStatusEnum } from '@/schemas/tasks';
import { versionSchema } from '@/schemas/common';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateStatusBodySchema = z.object({
  status: taskStatusEnum,
  version: versionSchema,
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can update task status' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateStatusBodySchema.safeParse(body);
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
        return updateTaskStatus(
          txDb,
          params.id,
          parsed.data.status,
          parsed.data.version,
          session.user.id
        );
      }
    );

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error(`[PATCH /api/v1/tasks/${params.id}/status error]:`, error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
