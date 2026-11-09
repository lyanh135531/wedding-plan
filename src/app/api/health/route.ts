import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbHealth = await checkDatabaseHealth();
    if (!dbHealth.ok) {
      return NextResponse.json(
        { status: 'error', db: false, message: 'Database health check failed' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { status: 'ok', db: true, latencyMs: dbHealth.latencyMs },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { status: 'error', db: false, error: message },
      { status: 503 }
    );
  }
}
