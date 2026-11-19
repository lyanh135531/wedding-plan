import { NextRequest } from 'next/server';
import { authenticatedRoute, RouteError } from '@/lib/api/route';
import { updateInvitationSchema } from '@/schemas/guests';
import { updateInvitation, getInvitationById } from '@/lib/guests/invitations.repository';

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  return authenticatedRoute(req, async (db, session) => {
    const { id } = await props.params;
    const input = updateInvitationSchema.parse(await req.json());
    const current = await getInvitationById(db, id);
    if (!current) throw new RouteError(404, 'Thiệp mời không tồn tại.');
    if (current.event_id !== input.event_id) throw new RouteError(400, 'Không thể chuyển thiệp sang buổi lễ khác.');
    return updateInvitation(db, id, input, session.user.id);
  });
}
