import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { commitGuestImport } from '@/lib/import/import.service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can commit data imports' },
      { status: 403 }
    );
  }

  try {
    const result = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return commitGuestImport(txDb, params.batchId, session.user.id);
      }
    );

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error(`[POST /api/v1/import/${params.batchId}/commit error]:`, error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
