import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  listFundingEntries,
  createFundingEntry,
} from '@/lib/finance/funds.repository';
import { createFundingEntrySchema } from '@/schemas/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Family role cannot view funding entries' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const includeVoided = searchParams.get('includeVoided') !== 'false';

  try {
    const data = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return listFundingEntries(txDb, includeVoided);
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized, total: serialized.length });
  } catch (error: any) {
    console.error('[GET /api/v1/finance/funding-entries error]:', error);
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
      { error: 'FORBIDDEN: Only owner can create funding entries' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createFundingEntrySchema.safeParse(body);
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
        return createFundingEntry(txDb, parsed.data, session.user.id);
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(created, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/v1/finance/funding-entries error]:', error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
