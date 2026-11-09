import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { createHousehold } from '@/lib/guests';
import { z } from 'zod';
import { guestSideEnum, ageTierEnum, deliveryMethodEnum, rsvpStatusEnum, dietaryTierEnum } from '@/schemas/guests';

export const dynamic = 'force-dynamic';

const createHouseholdRequestSchema = z.object({
  groupName: z.string().trim().min(1, 'Tên nhóm / gia đình không được để trống'),
  side: guestSideEnum.default('unassigned'),
  eventId: z.string().uuid('ID buổi cưới không hợp lệ'),
  deliveryMethod: deliveryMethodEnum.default('paper'),
  members: z.array(
    z.object({
      displayName: z.string().trim().min(1, 'Tên thành viên không được để trống'),
      ageTier: ageTierEnum.default('adult'),
      phone: z.string().trim().nullable().optional(),
      email: z.string().trim().email().nullable().optional(),
      address: z.string().trim().nullable().optional(),
      isRepresentative: z.boolean().default(false),
      rsvpStatus: rsvpStatusEnum.default('not_contacted'),
      needsSeat: z.boolean().optional(),
      needsMeal: z.boolean().optional(),
      mealDietaryTier: dietaryTierEnum.default('regular'),
      dietaryNotes: z.string().trim().nullable().optional(),
    })
  ).min(1, 'Hộ gia đình phải có ít nhất 1 thành viên'),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'FORBIDDEN: Owner role required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createHouseholdRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return createHousehold(txDb, parsed.data, session.user.id);
      }
    );

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/v1/guests/household error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
