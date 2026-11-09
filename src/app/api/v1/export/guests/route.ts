import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { guests, guestGroups } from '@/db/schema/guests';
import { generateSecureCsv } from '@/lib/export/formula-sanitizer';
import { eq, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const csvContent = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        const guestList = await txDb
          .select({
            id: guests.id,
            displayName: guests.displayName,
            side: guests.side,
            phone: guests.phone,
            email: guests.email,
            address: guests.address,
            ageTier: guests.ageTier,
            privateNotes: guests.privateNotes,
          })
          .from(guests)
          .where(eq(guests.isArchived, false))
          .orderBy(asc(guests.displayName));

        // Family View Privacy Masking (AT59, UXT16)
        const isFamily = session.role === 'family_view';

        const headers = [
          { key: 'displayName', label: 'Họ và tên' },
          { key: 'side', label: 'Phía' },
          { key: 'ageTier', label: 'Độ tuổi' },
          ...(!isFamily
            ? [
                { key: 'phone', label: 'Số điện thoại' },
                { key: 'email', label: 'Email' },
                { key: 'address', label: 'Địa chỉ' },
                { key: 'privateNotes', label: 'Ghi chú' },
              ]
            : []),
        ];

        const rows = guestList.map((g: any) => ({
          displayName: g.displayName,
          side: g.side === 'groom' ? 'Nhà trai' : g.side === 'bride' ? 'Nhà gái' : 'Chung',
          ageTier: g.ageTier === 'child' ? 'Trẻ em' : g.ageTier === 'baby' ? 'Em bé' : 'Người lớn',
          ...(!isFamily
            ? {
                phone: g.phone || '',
                email: g.email || '',
                address: g.address || '',
                privateNotes: g.privateNotes || '',
              }
            : {}),
        }));

        return generateSecureCsv(headers, rows);
      }
    );

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="danh-sach-khach-moi.csv"',
      },
    });
  } catch (error: any) {
    console.error('[GET /api/v1/export/guests error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
