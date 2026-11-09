import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getCostItemById,
  updateCostItem,
  deleteCostItem,
} from '@/lib/finance/costs.repository';
import { updateCostItemSchema } from '@/schemas/finance';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Family role cannot view cost item details' },
      { status: 403 }
    );
  }

  try {
    const data = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return getCostItemById(txDb, params.id);
      }
    );

    if (!data) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const serialized = JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error(`[GET /api/v1/finance/costs/${params.id} error]:`, error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

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
      { error: 'FORBIDDEN: Only owner can update cost items' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateCostItemSchema.safeParse(body);
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
        return updateCostItem(txDb, params.id, parsed.data, session.user.id);
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(updated, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error(`[PATCH /api/v1/finance/costs/${params.id} error]:`, error);
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
      { error: 'FORBIDDEN: Only owner can delete cost items' },
      { status: 403 }
    );
  }

  try {
    const result = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return deleteCostItem(txDb, params.id, session.user.id);
      }
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[DELETE /api/v1/finance/costs/${params.id} error]:`, error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
