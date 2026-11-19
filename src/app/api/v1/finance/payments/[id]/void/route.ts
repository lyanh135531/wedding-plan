import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { voidPayment } from '@/lib/finance/payments.repository';
import { z } from 'zod';
import { requiredStringSchema, versionSchema } from '@/schemas/common';

export const dynamic = 'force-dynamic';

const voidBodySchema = z.object({
  voided_reason: requiredStringSchema('Lý do hủy giao dịch', 255),
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
      { error: 'FORBIDDEN: Only owner can void payments' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = voidBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const voided = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return voidPayment(
          txDb,
          {
            payment_id: params.id,
            voided_reason: parsed.data.voided_reason,
            version: parsed.data.version,
          },
          session.user.id
        );
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(voided, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error(`[POST /api/v1/finance/payments/${params.id}/void error]:`, error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
