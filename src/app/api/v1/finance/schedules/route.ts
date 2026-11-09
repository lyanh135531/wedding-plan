import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  createPaymentSchedule,
  updatePaymentSchedule,
} from '@/lib/finance/schedules.repository';
import { createPaymentScheduleSchema } from '@/schemas/finance';
import { z } from 'zod';
import { versionSchema } from '@/schemas/common';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can create payment schedules' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createPaymentScheduleSchema.safeParse(body);
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
        return createPaymentSchedule(txDb, parsed.data, session.user.id);
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(created, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/v1/finance/schedules error]:', error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}

const updateScheduleBodySchema = createPaymentScheduleSchema.partial().extend({
  id: z.string().uuid(),
  version: versionSchema,
});

export async function PATCH(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can update payment schedules' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateScheduleBodySchema.safeParse(body);
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
        return updatePaymentSchedule(txDb, parsed.data.id, parsed.data, session.user.id);
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(updated, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error('[PATCH /api/v1/finance/schedules error]:', error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
