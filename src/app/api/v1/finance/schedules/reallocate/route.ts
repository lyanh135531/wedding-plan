import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { reallocateAdvancePayment } from '@/lib/finance/schedules.repository';
import { z } from 'zod';
import { uuidSchema, vndCurrencyStringSchema } from '@/schemas/common';

export const dynamic = 'force-dynamic';

const reallocateBodySchema = z.object({
  cost_item_id: uuidSchema,
  allocation_id: uuidSchema,
  target_schedule_id: uuidSchema,
  amount_to_reallocate: vndCurrencyStringSchema,
});

export async function POST(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can reallocate payments' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = reallocateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return reallocateAdvancePayment(
          txDb,
          {
            costItemId: parsed.data.cost_item_id,
            allocationId: parsed.data.allocation_id,
            targetScheduleId: parsed.data.target_schedule_id,
            amountToReallocate: BigInt(parsed.data.amount_to_reallocate),
          },
          session.user.id
        );
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(result, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error('[POST /api/v1/finance/schedules/reallocate error]:', error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
