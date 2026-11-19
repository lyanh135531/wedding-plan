import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { authenticatedRoute, RouteError } from '@/lib/api/route';
import { users, memberInvites, memberEventAccess, sessions } from '@/db/schema/auth';
import { events } from '@/db/schema/events';
import { auditLogs } from '@/db/schema/system';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) { return authenticatedRoute(req, async db => ({
  invites: await db.select({ id: memberInvites.id, email: memberInvites.email, status: memberInvites.status, expiresAt: memberInvites.expiresAt, allowedEventIds: memberInvites.allowedEventIds }).from(memberInvites),
  members: await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.role, 'family_view')),
  access: await db.select().from(memberEventAccess),
}), { owner: true }); }
export function POST(req: NextRequest) { return authenticatedRoute(req, async (db, session) => {
  const body = z.object({ email: z.string().trim().toLowerCase().email(), allowedEventIds: z.array(z.string().uuid()).min(1) }).parse(await req.json());
  const active = await db.select().from(events).where(inArray(events.id, body.allowedEventIds));
  if (active.length !== new Set(body.allowedEventIds).size || active.some(e => e.status === 'cancelled')) throw new RouteError(400, 'Chọn các buổi lễ đang hoạt động.');
  const token = crypto.randomBytes(32).toString('hex');
  const [invite] = await db.insert(memberInvites).values({ ...body, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 7 * 86400000), invitedByUserId: session.user.id }).returning();
  await db.insert(auditLogs).values({ userId: session.user.id, action: 'CREATE_MEMBER_INVITE', entityType: 'member_invites', entityId: invite.id, afterState: { email: body.email, allowedEventIds: body.allowedEventIds } });
  const base = process.env.APP_URL || req.nextUrl.origin;
  return { inviteUrl: `${base}/invite?token=${token}`, expiresAt: invite.expiresAt };
}); }
export function PATCH(req: NextRequest) { return authenticatedRoute(req, async (db, session) => {
  const body = z.object({ inviteId: z.string().uuid().optional(), memberId: z.string().min(1).optional() }).parse(await req.json());
  if (body.inviteId) {
    await db.update(memberInvites).set({ status: 'revoked' }).where(and(eq(memberInvites.id, body.inviteId), eq(memberInvites.status, 'pending')));
    await db.insert(auditLogs).values({ userId: session.user.id, action: 'REVOKE_INVITE', entityType: 'member_invites', entityId: body.inviteId });
  } else if (body.memberId) {
    const [target] = await db.select().from(users).where(eq(users.id, body.memberId)).for('update');
    if (!target || target.role !== 'family_view') throw new RouteError(400, 'Chỉ được thu hồi quyền tài khoản người nhà.');
    await db.delete(memberEventAccess).where(eq(memberEventAccess.userId, target.id));
    await db.delete(sessions).where(eq(sessions.userId, target.id));
    await db.update(memberInvites).set({ status: 'revoked' }).where(eq(memberInvites.email, target.email));
    await db.insert(auditLogs).values({ userId: session.user.id, action: 'REVOKE_MEMBER_ACCESS', entityType: 'member_event_access', entityId: crypto.randomUUID(), afterState: { userId: target.id } });
  } else throw new RouteError(400, 'Thiếu người hoặc lời mời cần thu hồi.');
  return { success: true };
}); }
