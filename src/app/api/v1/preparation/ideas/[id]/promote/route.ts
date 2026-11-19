import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { authenticatedRoute, RouteError } from '@/lib/api/route';
import { preparationItems } from '@/db/schema/preparation';
import { tasks } from '@/db/schema/tasks';
import { budgetCategories, costItems } from '@/db/schema/finance';
import { auditLogs } from '@/db/schema/system';
import { uuidSchema } from '@/schemas/common';
export function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) { return authenticatedRoute(req, async (db, session) => {
  const id = uuidSchema.parse((await props.params).id);
  const body = z.object({ kind: z.enum(['task','cost']), title: z.string().trim().min(1).max(200), categoryId: uuidSchema.nullable().optional() }).parse(await req.json());
  const [idea] = await db.select().from(preparationItems).where(eq(preparationItems.id, id)).for('update');
  if (!idea || idea.type !== 'idea') throw new RouteError(404, 'Không tìm thấy ý tưởng.');
  const metadata = idea.metadata as Record<string, unknown>;
  const key = body.kind === 'task' ? 'linkedTaskId' : 'linkedCostItemId';
  if (metadata[key]) return { id: metadata[key], kind: body.kind, existing: true };
  let target: { id: string };
  if (body.kind === 'task') {
    [target] = await db.insert(tasks).values({ title: body.title, eventId: idea.eventId, deadlineType: 'relative_to_event', relativeEventId: idea.eventId, relativeOffsetDays: 0, privateNotes: `Từ ý tưởng: ${idea.id}`, sharedWithFamily: false }).returning({ id: tasks.id });
  } else {
    if (!body.categoryId || !(await db.select().from(budgetCategories).where(eq(budgetCategories.id, body.categoryId))).length) throw new RouteError(400, 'Chọn danh mục ngân sách trước khi tạo khoản chi.');
    [target] = await db.insert(costItems).values({ name: body.title, eventId: idea.eventId, categoryId: body.categoryId, status: 'draft', notes: `Từ ý tưởng: ${idea.id}` }).returning({ id: costItems.id });
  }
  await db.update(preparationItems).set({ metadata: { ...metadata, [key]: target.id }, version: idea.version + 1, updatedAt: new Date() }).where(eq(preparationItems.id,id));
  await db.insert(auditLogs).values({ userId: session.user.id, action: 'PROMOTE_IDEA', entityType: 'preparation_items', entityId: idea.id, afterState: { kind: body.kind, targetId: target.id } });
  return { id: target.id, kind: body.kind, existing: false };
}); }
