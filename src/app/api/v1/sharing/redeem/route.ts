import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { memberInvites, memberEventAccess } from '@/db/schema/auth';
import { auditLogs } from '@/db/schema/system';
export async function POST(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session) return NextResponse.json({ message: 'Đăng nhập Google bằng đúng email được mời trước khi chấp nhận.' }, { status: 401 });
  try {
    const { token } = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(await req.json());
    // A validated invitation is the capability to grant access. The privilege is scoped
    // to this transaction and only used after binding token, email, status and expiry.
    const data = await withTransactionScopedContext(session.user.id, 'owner', async (_client, db) => {
      const [invite] = await db.select().from(memberInvites).where(eq(memberInvites.tokenHash, crypto.createHash('sha256').update(token).digest('hex'))).for('update');
      if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date() || invite.email.toLowerCase() !== session.user.email.toLowerCase()) return null;
      await db.update(memberInvites).set({ status: 'accepted' }).where(eq(memberInvites.id, invite.id));
      for (const eventId of invite.allowedEventIds) await db.insert(memberEventAccess).values({ userId: session.user.id, eventId }).onConflictDoNothing();
      await db.insert(auditLogs).values({ userId: session.user.id, action: 'ACCEPT_MEMBER_INVITE', entityType: 'member_invites', entityId: invite.id });
      return { accepted: true };
    });
    if (!data) return NextResponse.json({ message: 'Lời mời sai email, đã hết hạn, đã dùng hoặc bị thu hồi.' }, { status: 403 });
    return NextResponse.json({ data });
  } catch { return NextResponse.json({ message: 'Không thể nhận lời mời. Kiểm tra liên kết và thử lại.' }, { status: 400 }); }
}
