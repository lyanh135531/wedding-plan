import { NextRequest } from 'next/server';
import { authenticatedRoute } from '@/lib/api/route';
import { mediaLinks } from '@/db/schema/media';
import { mediaVaultLinkSchema } from '@/schemas/archival';
import { desc } from 'drizzle-orm';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) { return authenticatedRoute(req, db => db.select().from(mediaLinks).orderBy(desc(mediaLinks.createdAt)), { owner: true }); }
export function POST(req: NextRequest) { return authenticatedRoute(req, async db => { const [row] = await db.insert(mediaLinks).values(mediaVaultLinkSchema.parse(await req.json())).returning(); return row; }); }
