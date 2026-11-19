import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { authenticatedRoute, RouteError } from '@/lib/api/route';
import { events, weddingSettings } from '@/db/schema/events';
import { uuidSchema, versionSchema, nullableVndCurrencyStringSchema } from '@/schemas/common';
const inputSchema = z.object({ groomName: z.string().trim().min(1).max(200), brideName: z.string().trim().min(1).max(200), tentativeDateNote: z.string().trim().max(1000).nullable().transform(value => value || ''), representativeEventId: uuidSchema.nullable(), budgetTarget: nullableVndCurrencyStringSchema, contingencyBudget: nullableVndCurrencyStringSchema, version: versionSchema });
const serialize = <T,>(data: T) => JSON.parse(JSON.stringify(data, (_, value) => typeof value === 'bigint' ? value.toString() : value));
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) { return authenticatedRoute(req, async db => serialize((await db.select().from(weddingSettings).limit(1))[0] || null), { owner: true }); }
export function PATCH(req: NextRequest) { return authenticatedRoute(req, async (db, session) => {
  const input = inputSchema.parse(await req.json()); let confirmed = false;
  if (input.representativeEventId) { const [event] = await db.select().from(events).where(eq(events.id, input.representativeEventId)); if (!event || event.status === 'cancelled') throw new RouteError(400, 'Chọn một buổi lễ đang hoạt động.'); confirmed = !!event.startTime && event.status === 'confirmed'; }
  const [current] = await db.select().from(weddingSettings).limit(1);
  if (!current) throw new RouteError(404, 'Hãy hoàn tất thiết lập ban đầu.');
  const [row] = await db.update(weddingSettings).set({ ...input, budgetTarget: input.budgetTarget == null ? null : BigInt(input.budgetTarget), contingencyBudget: input.contingencyBudget == null ? null : BigInt(input.contingencyBudget), isDateConfirmed: confirmed, version: sql`${weddingSettings.version} + 1`, updatedAt: new Date() }).where(and(eq(weddingSettings.id, current.id), eq(weddingSettings.version, input.version))).returning();
  if (!row) throw new RouteError(409, 'Cài đặt đã thay đổi. Hãy tải lại.');
  const { auditLogs } = await import('@/db/schema/system'); await db.insert(auditLogs).values({ userId: session.user.id, action: 'UPDATE_CONFIGURATION', entityType: 'wedding_settings', entityId: row.id, beforeState: serialize(current), afterState: serialize(row) });
  return serialize(row);
}); }
