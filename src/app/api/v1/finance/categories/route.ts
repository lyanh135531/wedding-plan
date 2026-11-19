import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { budgetCategories, categoryBudgets } from '@/db/schema/finance';
import { createBudgetCategorySchema } from '@/schemas/finance';
import { eq, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const { authenticatedRoute, RouteError } = await import('@/lib/api/route');
  const { z } = await import('zod');
  const { auditLogs } = await import('@/db/schema/system');
  return authenticatedRoute(req, async (db, session) => {
    const body = createBudgetCategorySchema.extend({ id: z.string().uuid(), expectedUpdatedAt: z.string().datetime({offset:true}) }).parse(await req.json());
    const [current] = await db.select().from(budgetCategories).where(eq(budgetCategories.id, body.id)).for('update');
    if (!current || current.updatedAt.toISOString() !== body.expectedUpdatedAt) throw new RouteError(409, 'Danh mục đã thay đổi. Hãy tải lại trước khi lưu.');
    await db.update(budgetCategories).set({ name: body.name, defaultOrder: body.default_order, updatedAt: new Date() }).where(eq(budgetCategories.id, body.id));
    await db.insert(categoryBudgets).values({ categoryId: body.id, allocatedAmount: BigInt(body.allocated_budget), notes: body.notes }).onConflictDoUpdate({ target: categoryBudgets.categoryId, set: { allocatedAmount: BigInt(body.allocated_budget), notes: body.notes, updatedAt: new Date() } });
    await db.insert(auditLogs).values({ userId: session.user.id, action: 'UPDATE_CATEGORY_BUDGET', entityType: 'budget_categories', entityId: body.id, afterState: { name: body.name, allocatedAmount: body.allocated_budget } });
    return { id: body.id };
  });
}

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Family role cannot view financial categories' },
      { status: 403 }
    );
  }

  try {
    const data = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        const categories = await txDb
          .select({
            id: budgetCategories.id,
            name: budgetCategories.name,
            defaultOrder: budgetCategories.defaultOrder,
            allocatedAmount: categoryBudgets.allocatedAmount,
            createdAt: budgetCategories.createdAt,
            updatedAt: budgetCategories.updatedAt,
          })
          .from(budgetCategories)
          .leftJoin(categoryBudgets, eq(budgetCategories.id, categoryBudgets.categoryId))
          .orderBy(asc(budgetCategories.defaultOrder));

        return categories;
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error('[GET /api/v1/finance/categories error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Only owner can create budget categories' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createBudgetCategorySchema.safeParse(body);
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
        const [cat] = await txDb
          .insert(budgetCategories)
          .values({
            name: parsed.data.name,
            defaultOrder: parsed.data.default_order,
          })
          .returning();

        const allocatedAmount = BigInt(parsed.data.allocated_budget || '0');
        if (allocatedAmount > 0n) {
          await txDb.insert(categoryBudgets).values({
            categoryId: cat.id,
            allocatedAmount,
            notes: parsed.data.notes || null,
          });
        }

        return { ...cat, allocatedAmount };
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(created, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/v1/finance/categories error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
