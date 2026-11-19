import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSession, UserSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { checkArchivalFreezeGuard } from '@/app/api/v1/g10-utils';
import { withIdempotency } from '@/lib/finance/idempotency.service';

export type RouteDb = Parameters<Parameters<typeof withTransactionScopedContext>[2]>[1];
export class RouteError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function authenticatedRoute(req: NextRequest, action: (db: RouteDb, session: UserSession) => Promise<unknown>, options: { owner?: boolean; unarchive?: boolean; memberWrite?: boolean; isolation?: 'read committed' | 'repeatable read' } = {}) {
  try {
    const session = await getCurrentSession(req);
    if (!session) throw new RouteError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    const write = !['GET', 'HEAD'].includes(req.method);
    if (((write && !options.memberWrite) || options.owner) && session.role !== 'owner') throw new RouteError(403, 'Chỉ chủ sở hữu được thực hiện thao tác này.');
    const key = req.method === 'POST' && !options.memberWrite ? req.headers.get('idempotency-key') : null;
    if (key && key.length > 255) throw new RouteError(400, 'Khóa yêu cầu không hợp lệ.');
    const rawPayload = key ? await req.clone().text() : '';
    const payload = rawPayload ? JSON.parse(rawPayload) : null;
    const serializable = (value: unknown) => value === undefined ? null : JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item));
    const data = await withTransactionScopedContext(session.user.id, session.role, async (_client, db) => {
      if (write && !options.unarchive) await checkArchivalFreezeGuard(db);
      if (key) return (await withIdempotency({ transactionDb: db, key, userId: session.user.id, operationType: `POST:${req.nextUrl.pathname}`, payload, execute: async () => ({ status: 201, body: serializable(await action(db, session)) }) })).body;
      return serializable(await action(db, session));
    }, undefined, options.isolation);
    return NextResponse.json({ data }, { status: req.method === 'POST' ? 201 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: error.issues.map(i => i.message).join('\n'), issues: error.issues }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ message: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
    const e = error as { status?: number; statusCode?: number; code?: string; message?: string; name?: string };
    const status = e.status || e.statusCode || (e.code === '23505' || /Optimistic|Version|thay đổi bởi/.test(`${e.name} ${e.message}`) ? 409 : /Archived/.test(e.name || '') ? 403 : 500);
    if (status === 500) console.error('[API]', e.name || 'Error', e.code || '');
    return NextResponse.json({ message: status === 500 ? 'Không thể hoàn tất thao tác. Vui lòng thử lại.' : e.message }, { status });
  }
}
