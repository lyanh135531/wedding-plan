import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { stageGuestImport } from '@/lib/import/import.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const stageImportBodySchema = z.object({
  file_name: z.string().trim().min(1),
  rows: z.array(
    z.object({
      display_name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      side: z.string().optional(),
      age_tier: z.string().optional(),
      group_name: z.string().optional(),
      notes: z.string().optional(),
    })
  ).min(1, 'Dữ liệu nhập phải có ít nhất 1 dòng'),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can import data' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = stageImportBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const staged = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return stageGuestImport(
          txDb,
          parsed.data.file_name,
          parsed.data.rows,
          session.user.id
        );
      }
    );

    return NextResponse.json({ data: staged }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/v1/import/stage error]:', error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
