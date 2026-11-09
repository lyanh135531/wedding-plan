import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { addChecklistItem, toggleChecklistItem } from '@/lib/tasks/tasks.repository';
import { z } from 'zod';
import { requiredStringSchema, uuidSchema } from '@/schemas/common';

export const dynamic = 'force-dynamic';

const addChecklistBodySchema = z.object({
  title: requiredStringSchema('Tiêu đề mục kiểm tra', 150),
  sort_order: z.number().int().default(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can manage task checklists' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = addChecklistBodySchema.safeParse(body);
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
        return addChecklistItem(txDb, params.id, parsed.data.title, parsed.data.sort_order);
      }
    );

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    console.error(`[POST /api/v1/tasks/${params.id}/checklist error]:`, error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

const toggleChecklistBodySchema = z.object({
  item_id: uuidSchema,
  is_completed: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can toggle checklist items' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = toggleChecklistBodySchema.safeParse(body);
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
        return toggleChecklistItem(txDb, parsed.data.item_id, parsed.data.is_completed);
      }
    );

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error(`[PATCH /api/v1/tasks/${params.id}/checklist error]:`, error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
