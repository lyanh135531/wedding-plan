import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  PIN_REGEX,
  PinAuthError,
  attachSessionCookie,
  checkPinRateLimit,
  clearAllSessionCookies,
  clearPinRateLimit,
  createOwnerPinSession,
  ensurePrimaryOwnerId,
  getClientIp,
  recordFailedPinAttempt,
  revokeCurrentSession,
  verifyConfiguredPin,
} from '@/lib/auth/pin';

export const dynamic = 'force-dynamic';

const loginPinSchema = z.object({
  pin: z.string().trim().regex(PIN_REGEX, 'Mã PIN phải gồm đúng 6 chữ số.'),
});

function formatRetryWait(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Nhập sai mã PIN quá nhiều lần. Vui lòng thử lại sau ${minutes} phút.`;
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: 'Dữ liệu gửi lên không hợp lệ.' },
      { status: 400 }
    );
  }

  const parsed = loginPinSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Mã PIN phải gồm đúng 6 chữ số.' },
      { status: 400 }
    );
  }

  try {
    const rate = await checkPinRateLimit(clientIp);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: 'RATE_LIMITED',
          retryAfterSeconds: rate.retryAfterSeconds,
          message: formatRetryWait(rate.retryAfterSeconds),
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        }
      );
    }

    const result = await verifyConfiguredPin(parsed.data.pin);
    if (!result.configured) {
      return NextResponse.json(
        {
          error: 'PIN_NOT_CONFIGURED',
          message: 'Hệ thống chưa được cấu hình mã PIN đăng nhập.',
        },
        { status: 503 }
      );
    }

    if (!result.valid) {
      const updated = await recordFailedPinAttempt(clientIp);
      if (updated.blocked) {
        return NextResponse.json(
          {
            error: 'RATE_LIMITED',
            retryAfterSeconds: updated.retryAfterSeconds,
            message: formatRetryWait(updated.retryAfterSeconds),
          },
          {
            status: 429,
            headers: { 'Retry-After': String(updated.retryAfterSeconds) },
          }
        );
      }

      return NextResponse.json(
        {
          error: 'INVALID_PIN',
          remainingAttempts: updated.remainingAttempts,
          message: `Mã PIN chưa đúng. Còn ${updated.remainingAttempts} lần thử trước khi tạm khóa.`,
        },
        { status: 401 }
      );
    }

    await clearPinRateLimit(clientIp);
    const ownerUserId = await ensurePrimaryOwnerId();
    const { signedCookieValue, expiresAt } = await createOwnerPinSession(ownerUserId, req);

    const response = NextResponse.json({
      data: { authenticated: true, expiresAt: expiresAt.toISOString() },
    });
    attachSessionCookie(response, signedCookieValue, req);
    return response;
  } catch (error) {
    if (error instanceof PinAuthError) {
      return NextResponse.json({ error: 'PIN_AUTH_ERROR', message: error.message }, { status: error.statusCode });
    }
    console.error('[POST /api/v1/auth/pin]', error);
    return NextResponse.json(
      { error: 'AUTH_UNAVAILABLE', message: 'Không thể kiểm tra mã PIN lúc này. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await revokeCurrentSession(req);
  } catch (error) {
    console.error('[DELETE /api/v1/auth/pin]', error);
  }
  const response = NextResponse.json({ data: { signedOut: true } });
  clearAllSessionCookies(response);
  return response;
}
