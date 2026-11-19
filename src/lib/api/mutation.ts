import type { NextRequest } from 'next/server';
import type { RouteDb } from './route';
import { withIdempotency } from '@/lib/finance/idempotency.service';
import { checkArchivalFreezeGuard } from '@/app/api/v1/g10-utils';

/** Cache a create result in the same scoped transaction as its business records. */
export async function runIdempotentCreate<T>(req: NextRequest, db: RouteDb, userId: string, payload: unknown, execute: () => Promise<T>): Promise<T> {
  await checkArchivalFreezeGuard(db);
  return (await withIdempotency({ transactionDb: db, key: req.headers.get('idempotency-key'), userId, operationType: `POST:${req.nextUrl.pathname}`, payload, execute: async () => ({ status: 201, body: await execute() }) })).body;
}
