import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const gone = () =>
  NextResponse.json(
    { error: 'FEATURE_DISABLED', message: 'Tính năng chia sẻ quyền Người nhà đã được tắt.' },
    { status: 410 }
  );

export const GET = gone;
export const POST = gone;
export const PATCH = gone;
export const DELETE = gone;
