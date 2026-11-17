import { PgTransaction } from 'drizzle-orm/pg-core';
import { NodePgDatabase, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';

export type TxDb = NodePgDatabase<typeof schema> | PgTransaction<NodePgQueryResultHKT, typeof schema, any> | any;
