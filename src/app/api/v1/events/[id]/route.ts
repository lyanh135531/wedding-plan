import { NextRequest } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { authenticatedRoute, RouteError } from '@/lib/api/route';
import { events, weddingSettings } from '@/db/schema/events';
import { eventInputSchema } from '@/schemas/events';
import { uuidSchema, versionSchema } from '@/schemas/common';
import { generateRescheduleImpactPreview } from '@/lib/tasks/reschedule.service';
import { weddingDateKey } from '@/lib/dates';
export function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) { return authenticatedRoute(req, async (db, session) => {
  const id = uuidSchema.parse((await props.params).id); const body = await req.json(); const version = versionSchema.parse(body.version); const input = eventInputSchema.parse(body);
  const [current] = await db.select().from(events).where(eq(events.id, id)).for('update');
  if (!current) throw new RouteError(404, 'Không tìm thấy buổi lễ.');
  if (version !== current.version) throw new RouteError(409, 'Buổi lễ đã thay đổi. Hãy tải lại.');
  const dateChanged = input.startTime !== undefined && (current.startTime?.toISOString() || null) !== input.startTime;
  if (dateChanged && body.confirmDateChange !== true) {
    const preview = input.startTime ? await generateRescheduleImpactPreview(db, id, weddingDateKey(new Date(input.startTime))) : null;
    throw new RouteError(409, preview ? `Thay đổi ngày ảnh hưởng ${preview.affectedRelativeTasks.length} công việc; ${preview.pinnedTasksSkipped.length} việc ghim/đã xong được giữ; ${preview.fixedPaymentSchedulesRequiringManualReview.length} hạn thanh toán cần rà soát. Xác nhận thay đổi ngày để lưu.` : 'Bỏ ngày chính thức sẽ làm các hạn tương đối chờ ngày. Xác nhận thay đổi ngày để lưu.');
  }
  const startTime = input.startTime ? new Date(input.startTime) : null; const endTime = input.endTime ? new Date(input.endTime) : null;
  if (startTime && endTime && endTime < startTime) throw new RouteError(400, 'Giờ kết thúc phải sau giờ bắt đầu.');
  const [row] = await db.update(events).set({ ...input, startTime, endTime, version: sql`${events.version} + 1`, updatedAt: new Date() }).where(and(eq(events.id, id), eq(events.version, version))).returning();
  await db.update(weddingSettings).set({ isDateConfirmed: !!startTime && input.status === 'confirmed', version: sql`${weddingSettings.version}+1`, updatedAt: new Date() }).where(eq(weddingSettings.representativeEventId, id));
  const { auditLogs } = await import('@/db/schema/system'); await db.insert(auditLogs).values({ userId: session.user.id, action: 'UPDATE_EVENT', entityType: 'events', entityId: id, beforeState: current, afterState: row });
  return row;
}); }
