import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listTasks, createTask } from '@/lib/tasks/tasks.repository';
import { createTaskSchema, taskStatusEnum, taskPriorityEnum } from '@/schemas/tasks';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get('status');
  const status = statusParam && taskStatusEnum.safeParse(statusParam).success ? (statusParam as any) : undefined;
  const priorityParam = searchParams.get('priority');
  const priority = priorityParam && taskPriorityEnum.safeParse(priorityParam).success ? (priorityParam as any) : undefined;
  const categoryId = searchParams.get('categoryId') || undefined;
  const eventId = searchParams.get('eventId') || undefined;
  const search = searchParams.get('search') || undefined;
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  try {
    const data = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return listTasks(txDb, {
          status,
          priority,
          categoryId,
          eventId,
          search,
          limit,
          offset,
          role: session.role,
          allowedEventIds: session.allowedEventIds,
        });
      }
    );

    return NextResponse.json({ data, total: data.length });
  } catch (error: any) {
    console.error('[GET /api/v1/tasks error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can create tasks' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createTaskSchema.safeParse(body);
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
        return createTask(txDb, parsed.data, session.user.id);
      }
    );

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/v1/tasks error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
