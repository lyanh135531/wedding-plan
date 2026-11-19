import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db, withTransactionScopedContext } from '@/db/client';
import { users, sessions, accounts, verifications } from '@/db/schema/auth';

const config = { provider: 'pg' as const, schema: { users, sessions, accounts, verifications }, usePlural: true, transaction: false };
type Options = Parameters<ReturnType<typeof drizzleAdapter>>[0];

/**
 * Better Auth runs before a user session exists. Its trusted server adapter needs
 * a transaction-local service context for OAuth/account/session persistence.
 * Business APIs keep their separately authenticated user context and FORCE RLS.
 */
export function createAuthDatabaseAdapter() {
  return (options: Options) => {
    const makeAdapter = (database: Omit<typeof db, '$client'>) => drizzleAdapter(database, config)(options);
    const base = makeAdapter(db);
    const scoped = <T,>(operation: (adapter: typeof base) => Promise<T>) => withTransactionScopedContext('trusted-auth-service', 'owner', async (_client, database) => operation(makeAdapter(database)));
    return new Proxy(base, {
      get(target, property, receiver) {
        if (property === 'transaction') return (callback: (adapter: typeof base) => Promise<unknown>) => scoped(callback);
        const original = Reflect.get(target, property, receiver);
        if (typeof original !== 'function') return original;
        return (...args: unknown[]) => scoped(async adapter => Reflect.apply(Reflect.get(adapter, property), adapter, args));
      },
    });
  };
}
