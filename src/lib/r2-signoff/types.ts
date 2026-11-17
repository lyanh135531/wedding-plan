import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';

export type TxDb = NodePgDatabase<typeof schema>;

export interface R2GateCheck {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: Record<string, unknown>;
}

export interface R2SignoffSnapshot {
  snapshotId: string;
  checksum: string;
  signedBy: string;
  signedAt: string;
  isImmutable: boolean;
}

export interface R2SignoffReport {
  eventId: string;
  evaluatedAt: string;
  overallStatus: 'READY' | 'NOT_READY';
  totalGates: number;
  passedGates: number;
  failedGates: number;
  checks: R2GateCheck[];
  snapshot: R2SignoffSnapshot;
}
