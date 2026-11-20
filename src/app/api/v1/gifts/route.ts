import { withIdempotency } from '@/lib/finance/idempotency.service';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listGifts, createGift, getGiftSummary } from '@/lib/gifts';
import { createGiftSchema } from '@/schemas/gifts';
import { enforceNoFamilyViewForGifts, enforceOwnerRole, checkArchivalFreezeGuard, handleG10Error } from '../g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/gifts?eventId=<uuid>
 * Invariant (AT03, AT25): Người nhà (family_view) bị CHẶN HOÀN TOÀN (403 Forbidden).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceNoFamilyViewForGifts(session);
    if (authError) return authError;

    const { searchParams } = req.nextUrl;
    const eventId = searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Thiếu tham số bắt buộc: eventId.' },
        { status: 400 }
      );
    }

    const giftTypeParam = searchParams.get('giftType');
    if (giftTypeParam && giftTypeParam !== 'cash' && giftTypeParam !== 'physical') {
      return NextResponse.json({ message: 'Loại quà mừng không hợp lệ.' }, { status: 400 });
    }
    const giftType = giftTypeParam === 'cash' || giftTypeParam === 'physical' ? giftTypeParam : undefined;
    const isThankedParam = searchParams.get('isThanked');
    const isThanked = isThankedParam !== null ? isThankedParam === 'true' : undefined;
    const isSenderIdentifiedParam = searchParams.get('isSenderIdentified');
    const isSenderIdentified = isSenderIdentifiedParam !== null ? isSenderIdentifiedParam === 'true' : undefined;
    const isVoidedParam = searchParams.get('isVoided');
    const isVoided = isVoidedParam !== null ? isVoidedParam === 'true' : undefined;

    const [giftsList, summary] = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        const items = await listGifts(scopedDb, eventId, {
          giftType,
          isThanked,
          isSenderIdentified,
          isVoided,
        });
        const sum = await getGiftSummary(scopedDb, eventId);
        return [items, sum];
      }
    );

    return NextResponse.json({
      data: giftsList,
      summary,
      total: giftsList.length,
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}

/**
 * POST /api/v1/gifts
 * Ghi nhận quà mừng (tiền mặt hoặc hiện vật, phong bì chung AT25).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session) || enforceNoFamilyViewForGifts(session);
    if (authError) return authError;

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu JSON không hợp lệ.' },
        { status: 400 }
      );
    }

    const parseResult = createGiftSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu quà mừng không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        await checkArchivalFreezeGuard(scopedDb);
        return (await withIdempotency({ transactionDb: scopedDb, userId: session!.user.id, key: req.headers.get('idempotency-key'), operationType: 'CREATE_GIFT', payload: parseResult.data, execute: async () => ({ status: 201, body: { data: await createGift(scopedDb, parseResult.data, session!.user.id) } }) })).body.data;
      }
    );

    return NextResponse.json(
      {
        data: created,
        message: 'Ghi nhận quà mừng thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
