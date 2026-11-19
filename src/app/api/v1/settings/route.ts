import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getWeddingSettings, initializeWedding, updateWeddingTitle } from '@/lib/settings/settings';
import { setupSchema, updateSettingsSchema } from '@/schemas/settings';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  try {
    return NextResponse.json({ data: await getWeddingSettings(session) });
  } catch (error) {
    console.error('[GET settings]', error);
    return NextResponse.json({ error: 'Không thể tải cài đặt.' }, { status: 500 });
  }
}

async function write(req: NextRequest, initialize: boolean) {
  const session = await getCurrentSession(req);
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (session.role !== 'owner') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Dữ liệu JSON không hợp lệ.' }, { status: 400 });
  }
  try {
    if (initialize) {
      const parsed = setupSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 });
      const data = await initializeWedding(session, parsed.data);
      return NextResponse.json({ data }, { status: data.created ? 201 : 200 });
    }
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 });
    const data = await updateWeddingTitle(session, parsed.data.shortTitle, parsed.data.version);
    if (!data) return NextResponse.json({ error: 'Cài đặt đã thay đổi. Vui lòng tải lại trang trước khi lưu.' }, { status: 409 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[write settings]', error);
    return NextResponse.json({ error: 'Không thể lưu cài đặt. Vui lòng thử lại.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return write(req, true); }
export async function PATCH(req: NextRequest) { return write(req, false); }
