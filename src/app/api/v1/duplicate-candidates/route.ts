import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listGuests, findDuplicateCandidates } from '@/lib/guests';
import { GuestOwnerDto } from '@/schemas/guests';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'FORBIDDEN: Owner role required' }, { status: 403 });
  }

  try {
    const candidates = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        // Fetch all active guests (owner view)
        const allGuests = (await listGuests(txDb, {
          isArchived: false,
          limit: 1000,
          role: 'owner',
        })) as GuestOwnerDto[];

        const inputList = allGuests.map((g) => ({
          id: g.id,
          displayName: g.display_name,
          phone: g.phone,
          email: g.email,
          groupId: g.group_id,
          address: g.address,
          side: g.side,
          subTags: g.sub_tags,
          isArchived: g.is_archived,
        }));

        const results = findDuplicateCandidates(inputList);

        // Map back to DTO format with full guest details
        const guestMap = new Map<string, GuestOwnerDto>(allGuests.map((g) => [g.id, g]));

        return results.map((r) => ({
          guest_a: guestMap.get(r.guestA.id)!,
          guest_b: guestMap.get(r.guestB.id)!,
          match_reasons: r.matchReasons,
          similarity_score: r.similarityScore,
        }));
      }
    );

    return NextResponse.json({ data: candidates, total: candidates.length });
  } catch (error: any) {
    console.error('[GET /api/v1/duplicate-candidates error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
