import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import {
  PIN_REGEX,
  PinAuthError,
  checkPinRateLimit,
  clearPinRateLimit,
  recordFailedPinAttempt,
  updateWeddingPin,
} from '@/lib/auth/pin';

export const dynamic = 'force-dynamic';

const changePinSchema = z
  .object({
    currentPin: z.string().trim().regex(PIN_REGEX, 'Mã PIN hiện tại phải gồm đúng 6 chữ số.'),
    newPin: z.string().trim().regex(PIN_REGEX, 'Mã PIN mới phải gồm đúng 6 chữ số.'),
    confirmPin: z.string().trim().regex(PIN_REGEX, 'Xác nhận mã PIN phải gồm đúng 6 chữ số.'),
  })
  .refine((data) => data.newPin === data.confirmPin, {
    message: 'Mã PIN mới và xác nhận chưa khớp.',
    path: ['confirmPin'],
  });

export async function PATCH(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập lại trước khi đổi mã PIN.' },
      { status: 401 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: 'Dữ liệu JSON không hợp lệ.' },
      { status: 400 }
    );
  }

  const parsed = changePinSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Dữ liệu mã PIN không hợp lệ.',
      },
      { status: 400 }
    );
  }

  const rateKey = `user:${session.user.id}`;
  try {
    const rate = await checkPinRateLimit(rateKey);
    if (!rate.allowed) {
      const minutes = Math.max(1, Math.ceil(rate.retryAfterSeconds / 60));
      return NextResponse.json(
        {
          error: 'RATE_LIMITED',
          message: `Nhập sai mã PIN hiện tại quá nhiều lần. Vui lòng thử lại sau ${minutes} phút.`,
        },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      );
    }

    const result = await updateWeddingPin(session, parsed.data.currentPin, parsed.data.newPin);
    await clearPinRateLimit(rateKey);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof PinAuthError) {
      if (error.message === 'Mã PIN hiện tại không đúng.') {
        await recordFailedPinAttempt(rateKey).catch(() => {});
      }
      return NextResponse.json(
        { error: 'PIN_UPDATE_FAILED', message: error.message },
        { status: error.statusCode }
      );
    }
    console.error('[PATCH /api/v1/settings/pin]', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Không thể cập nhật mã PIN. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
