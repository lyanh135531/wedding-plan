import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { addTaskDependency, removeTaskDependency } from '@/lib/tasks/tasks.repository';
import { z } from 'zod';
import { uuidSchema } from '@/schemas/common';

export const dynamic = 'force-dynamic';

const addDependencyBodySchema = z.object({
  prerequisite_task_id: uuidSchema,
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
      { error: 'FORBIDDEN: Only owner can manage task dependencies' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = addDependencyBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return addTaskDependency(
          txDb,
          params.id,
          parsed.data.prerequisite_task_id,
          session.user.id
        );
      }
    );

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    console.error(`[POST /api/v1/tasks/${params.id}/dependencies error]:`, error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can manage task dependencies' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const dependencyId = searchParams.get('dependencyId');
  if (!dependencyId) {
    return NextResponse.json({ error: 'MISSING_DEPENDENCY_ID' }, { status: 400 });
  }

  try {
    const result = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return removeTaskDependency(txDb, dependencyId, session.user.id);
      }
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[DELETE /api/v1/tasks/${params.id}/dependencies error]:`, error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
