import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticatedRoute, RouteError } from '@/lib/api/route';
import { evaluateR2Readiness } from '@/lib/r2-signoff';
import { createHandoverSnapshot } from '@/lib/handovers';
import { createHash } from 'node:crypto';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) { return authenticatedRoute(req, async (db, session) => {
  const eventId = z.string().uuid().parse(req.nextUrl.searchParams.get('eventId'));
  const report = await evaluateR2Readiness(db, eventId, session.user.id);
  return { ...report, passedGates: report.checks.filter(c => c.status === 'passed' && c.id !== 'gate-8-immutable-snapshot').length, snapshot: { ...report.snapshot, isImmutable: false }, checks: report.checks.map(c => c.id === 'gate-8-immutable-snapshot' ? { ...c, status: 'warning', message: 'Chưa lưu bản chốt. Chọn Lưu bản chốt để tạo bản lưu cố định.' } : c) };
}, { owner: true, isolation: 'repeatable read' }); }
export function POST(req: NextRequest) { return authenticatedRoute(req, async (db, session) => {
  const input = z.object({ eventId: z.string().uuid(), title: z.string().trim().min(1).max(255).default('Bản chốt nghiệm thu') }).parse(await req.json());
  const report = await evaluateR2Readiness(db, input.eventId, session.user.id);
  if (report.failedGates > 0) throw new RouteError(409, 'Còn hạng mục chưa đạt. Hoàn thiện trước khi nghiệm thu.');
  const snapshot = await createHandoverSnapshot(db, { eventId: input.eventId, title: input.title }, session.user.id, { evaluatedAt: report.evaluatedAt, evaluatedBy: session.user.id, checks: report.checks.filter(c => c.id !== 'gate-8-immutable-snapshot') });
  const checksum = createHash('sha256').update(JSON.stringify(snapshot.snapshotData)).digest('hex');
  return { ...report, passedGates: report.passedGates + 1, checks: report.checks.map(c => c.id === 'gate-8-immutable-snapshot' ? { ...c, status: 'passed', message: 'Đã lưu bản chốt cố định trong hệ thống.', details: { snapshotId: snapshot.id, checksum } } : c), snapshot: { ...report.snapshot, checksum, snapshotId: snapshot.id, id: snapshot.id, version: snapshot.version, isImmutable: true } };
}, { isolation: 'repeatable read' }); }
