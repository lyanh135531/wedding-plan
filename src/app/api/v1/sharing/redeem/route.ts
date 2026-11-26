import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    { error: 'FEATURE_DISABLED', message: 'Tính năng lời mời Người nhà đã được tắt.' },
    { status: 410 }
  );
}
