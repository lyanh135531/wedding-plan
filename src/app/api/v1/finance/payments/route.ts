import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  listPayments,
  createPayment,
  createDirectThirdPartyPayment,
} from '@/lib/finance/payments.repository';
import { withIdempotency } from '@/lib/finance/idempotency.service';
import { createPaymentSchema } from '@/schemas/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Family role cannot view payments' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const costItemId = searchParams.get('costItemId') || undefined;
  const paymentType = (searchParams.get('paymentType') as any) || undefined;
  const includeVoided = searchParams.get('includeVoided') !== 'false';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  try {
    const data = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return listPayments(txDb, {
          costItemId,
          paymentType,
          includeVoided,
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
    console.error('[GET /api/v1/finance/payments error]:', error);
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
      { error: 'FORBIDDEN: Only owner can record payments' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createPaymentSchema.safeParse(body);
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

    const result = await withIdempotency({
      key: idempotencyKey,
      userId: session.user.id,
      operationType: 'RECORD_PAYMENT',
      payload: parsed.data,
      execute: async () => {
        const created = await withTransactionScopedContext(
          session.user.id,
          session.role,
          async (_client, txDb) => {
            // AT38: If direct third party ("Người khác góp bằng cách trả hộ")
            if (parsed.data.is_direct_third_party) {
              return createDirectThirdPartyPayment(
                txDb,
                {
                  costItemId: parsed.data.cost_item_id,
                  amount: BigInt(parsed.data.amount),
                  contributorName: parsed.data.payer_name || 'Người thân trả hộ',
                  transactionTime: parsed.data.transaction_time
                    ? new Date(parsed.data.transaction_time)
                    : undefined,
                  scheduleAllocations: parsed.data.schedule_allocations?.map((a) => ({
                    schedule_id: a.schedule_id,
                    amount: a.amount,
                  })),
                  notes: parsed.data.notes,
                },
                session.user.id
              );
            }

            // Normal outflow or refund (AT12, AT14)
            return createPayment(txDb, parsed.data, session.user.id);
          }
        );

        const serialized = JSON.parse(
          JSON.stringify(created, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          )
        );

        return { status: 201, body: { data: serialized } };
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    console.error('[POST /api/v1/finance/payments error]:', error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
