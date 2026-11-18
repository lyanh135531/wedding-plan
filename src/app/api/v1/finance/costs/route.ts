import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listCostItems, createCostItem } from '@/lib/finance/costs.repository';
import { withIdempotency } from '@/lib/finance/idempotency.service';
import { createCostItemSchema } from '@/schemas/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Family role cannot view cost items' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('categoryId') || undefined;
  const eventId = searchParams.get('eventId') || undefined;
  const status = (searchParams.get('status') as any) || undefined;
  const search = searchParams.get('search') || undefined;
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  try {
    const data = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return listCostItems(txDb, {
          categoryId,
          eventId,
          status,
          search,
          limit,
          offset,
        });
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized, total: serialized.length });
  } catch (error: any) {
    console.error('[GET /api/v1/finance/costs error]:', error);
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
      { error: 'FORBIDDEN: Only owner can create cost items' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createCostItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      body.idempotency_key ||
      null;

    const result = await withTransactionScopedContext(session.user.id, session.role, async (_client, txDb) => withIdempotency({
      transactionDb: txDb,
      key: idempotencyKey,
      userId: session.user.id,
      operationType: 'CREATE_COST_ITEM',
      payload: parsed.data,
      execute: async () => {
        const created = await (async () => {
            return createCostItem(txDb, parsed.data, session.user.id);
        })();

        const serialized = JSON.parse(
          JSON.stringify(created, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          )
        );

        return { status: 201, body: { data: serialized } };
      },
    }));

    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    console.error('[POST /api/v1/finance/costs error]:', error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
