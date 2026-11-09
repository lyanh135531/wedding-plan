import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getGuestById, updateGuest, softDeleteGuest } from '@/lib/guests';
import { updateGuestSchema } from '@/schemas/guests';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = params;

  try {
    const guest = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return getGuestById(txDb, id, session.role, session.allowedEventIds);
      }
    );

    if (!guest) {
      return NextResponse.json({ error: 'NOT_FOUND: Guest not found or not accessible' }, { status: 404 });
    }

    return NextResponse.json({ data: guest });
  } catch (error: any) {
    console.error(`[GET /api/v1/guests/${id} error]:`, error);
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
    return NextResponse.json({ error: 'FORBIDDEN: Owner role required' }, { status: 403 });
  }

  const { id } = params;

  try {
    const body = await req.json();
    const parsed = updateGuestSchema.safeParse(body);
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
        return updateGuest(txDb, id, parsed.data, session.user.id);
      }
    );

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error(`[PATCH /api/v1/guests/${id} error]:`, error);
    const status = error?.message?.includes('bị thay đổi bởi người khác') ? 409 : 500;
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status });
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
    return NextResponse.json({ error: 'FORBIDDEN: Owner role required' }, { status: 403 });
  }

  const { id } = params;

  try {
    const success = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return softDeleteGuest(txDb, id, session.user.id);
      }
    );

    if (!success) {
      return NextResponse.json({ error: 'NOT_FOUND: Guest not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Đã lưu trữ hồ sơ khách mời' });
  } catch (error: any) {
    console.error(`[DELETE /api/v1/guests/${id} error]:`, error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
