import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { cancelCostItem } from '@/lib/finance/costs.repository';
import { z } from 'zod';
import { vndCurrencyStringSchema, notesSchema, versionSchema } from '@/schemas/common';

export const dynamic = 'force-dynamic';

const cancelCostItemBodySchema = z.object({
  cancellation_fee: vndCurrencyStringSchema, // 0 is valid (AT48)
  cancellation_notes: notesSchema,
  version: versionSchema,
});

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can cancel cost items' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = cancelCostItemBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const cancelled = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return cancelCostItem(
          txDb,
          params.id,
          {
            cancellationFee: BigInt(parsed.data.cancellation_fee),
            cancellationNotes: parsed.data.cancellation_notes,
            version: parsed.data.version,
          },
          session.user.id
        );
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(cancelled, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error(`[POST /api/v1/finance/costs/${params.id}/cancel error]:`, error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
