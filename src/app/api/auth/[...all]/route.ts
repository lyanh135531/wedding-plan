import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { toNextJsHandler } from 'better-auth/next-js';

const baseHandler = toNextJsHandler(auth);

function isLegacyOAuthOrSignupPath(pathname: string): boolean {
  return (
    pathname.includes('/sign-in') ||
    pathname.includes('/sign-up') ||
    pathname.includes('/callback')
  );
}

const disabledResponse = () =>
  NextResponse.json(
    {
      error: 'AUTH_METHOD_DISABLED',
      message: 'Đăng nhập Google đã tắt. Vui lòng sử dụng mã PIN 6 số.',
    },
    { status: 410 }
  );

export async function GET(req: NextRequest) {
  if (isLegacyOAuthOrSignupPath(req.nextUrl.pathname)) {
    return disabledResponse();
  }
  return baseHandler.GET(req);
}

export async function POST(req: NextRequest) {
  if (isLegacyOAuthOrSignupPath(req.nextUrl.pathname)) {
    return disabledResponse();
  }
  return baseHandler.POST(req);
}
