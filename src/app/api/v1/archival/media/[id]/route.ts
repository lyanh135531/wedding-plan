import { NextRequest } from 'next/server';
import { authenticatedRoute, RouteError } from '@/lib/api/route';
import { mediaLinks } from '@/db/schema/media';
import { mediaVaultLinkSchema } from '@/schemas/archival';
import { and, eq, sql } from 'drizzle-orm';
import { uuidSchema, versionSchema } from '@/schemas/common';
export function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) { return authenticatedRoute(req, async db => {
  const id = uuidSchema.parse((await props.params).id); const body = await req.json(); const version = versionSchema.parse(body.version);
  const [row] = await db.update(mediaLinks).set({ ...mediaVaultLinkSchema.parse(body), version: sql`${mediaLinks.version} + 1`, updatedAt: new Date() }).where(and(eq(mediaLinks.id, id), eq(mediaLinks.version, version))).returning();
  if (!row) throw new RouteError(409, 'Liên kết đã thay đổi. Hãy tải lại.'); return row;
}); }
export function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) { return authenticatedRoute(req, async db => {
  const id = uuidSchema.parse((await props.params).id); const version = versionSchema.parse(Number(req.nextUrl.searchParams.get('version')));
  const [row] = await db.delete(mediaLinks).where(and(eq(mediaLinks.id, id), eq(mediaLinks.version, version))).returning();
  if (!row) throw new RouteError(409, 'Liên kết đã thay đổi. Hãy tải lại.'); return { id };
}); }
