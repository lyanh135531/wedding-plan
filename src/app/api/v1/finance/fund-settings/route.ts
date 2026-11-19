import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getFundSettings, updateFundSettings } from '@/lib/finance/funds.repository';
import { updateFundSettingsSchema } from '@/schemas/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Family role cannot view fund settings' },
      { status: 403 }
    );
  }

  try {
    const settings = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return getFundSettings(txDb);
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(settings, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error('[GET /api/v1/finance/fund-settings error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can update fund settings' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateFundSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const updated = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (client, txDb) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('wedding-fund-settings'))");
        return updateFundSettings(txDb, parsed.data, session.user.id);
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(updated, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error('[PUT /api/v1/finance/fund-settings error]:', error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
