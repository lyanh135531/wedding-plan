import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { OverviewDashboard } from '@/components/modules/overview/OverviewDashboard';
import { StatCardsRow } from '@/components/modules/overview/StatCardsRow';
import { FamilyOverviewCard } from '@/components/modules/overview/FamilyOverviewCard';
import { ExecutiveHeader } from '@/components/modules/overview/ExecutiveHeader';

const h = React.createElement;

describe('S03: Overview Dashboard & UXT16 Owner vs Family Financial Isolation', () => {
  it('Owner Mode renders 4 financial StatCards with BigInt VND and provisional badge', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'owner' },
        h(StatCardsRow, {
          projectedCost: 265000000n,
          netPaid: 120000000n,
          remainingDue: 145000000n,
          missingPricesCount: 1,
          confirmedGuests: 142,
          totalInvited: 180,
        })
      )
    );

    expect(html).toContain('Chi dự báo');
    expect(html).toContain('265.000.000 ₫');
    expect(html).toContain('Tạm tính — còn 1 khoản thiếu giá'); // Provisional warning
    expect(html).toContain('Đã thanh toán');
    expect(html).toContain('120.000.000 ₫');
    expect(html).toContain('Còn phải chi');
    expect(html).toContain('145.000.000 ₫');
    expect(html).toContain('Khách xác nhận');
    expect(html).toContain('142 / 180');
  });

  it('Family View Mode (UXT16) strictly eliminates 100% of financial StatCards from DOM', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'family_view' },
        h(StatCardsRow, {
          projectedCost: 265000000n,
          netPaid: 120000000n,
          remainingDue: 145000000n,
          missingPricesCount: 1,
        })
      )
    );

    // DOM must be completely empty!
    expect(html).toBe('');
    expect(html).not.toContain('Chi dự báo');
    expect(html).not.toContain('Đã thanh toán');
    expect(html).not.toContain('Còn phải chi');
    expect(html).not.toContain('265.000.000 ₫');
    expect(html).not.toContain('120.000.000 ₫');
  });

  it('Family View Mode renders FamilyOverviewCard with Chỉ xem badge and venue schedules', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'family_view' },
        h(FamilyOverviewCard, {
          weddingDateNote: 'Dự kiến sau Tết âm lịch 2028',
        })
      )
    );

    expect(html).toContain('Lịch trình &amp; Địa điểm tổ chức');
    expect(html).toContain('Chỉ xem');
    expect(html).toContain('Lễ Gia Tiên &amp; Rước Dâu');
    expect(html).toContain('Tiệc Cưới Chính');
    // Financial numbers must never leak in FamilyOverviewCard
    expect(html).not.toContain('₫');
    expect(html).not.toContain('Ngân sách');
  });

  it('ExecutiveHeader renders Quick Add dropdown for Owner and suppresses it for Family View', () => {
    const ownerHtml = renderToStaticMarkup(
      h(RoleProvider, { initialRole: 'owner' }, h(ExecutiveHeader, null))
    );
    expect(ownerHtml).toContain('Thêm nhanh');
    expect(ownerHtml).not.toContain('Chỉ xem');

    const familyHtml = renderToStaticMarkup(
      h(RoleProvider, { initialRole: 'family_view' }, h(ExecutiveHeader, null))
    );
    expect(familyHtml).not.toContain('Thêm nhanh');
    expect(familyHtml).toContain('Chỉ xem');
  });

  it('OverviewDashboard renders all 6 mandatory states seamlessly', () => {
    const renderWithRole = (st: any, role: 'owner' | 'family_view' = 'owner') =>
      renderToStaticMarkup(
        h(RoleProvider, { initialRole: role }, h(OverviewDashboard, { initialState: st }))
      );

    // 1. Loading
    expect(renderWithRole('loading')).toContain('animate-pulse');

    // 2. Empty
    expect(renderWithRole('empty')).toContain('Chào mừng bạn đến với Sổ Quản Lý Đám Cưới');

    // 3. Populated
    const populated = renderWithRole('populated');
    expect(populated).toContain('Minh &amp; Linh');
    expect(populated).toContain('Chi dự báo');

    // 4. Error
    const error = renderWithRole('error');
    expect(error).toContain('REQ-20261106-OVERVIEW-01');
    expect(error).toContain('Thử lại');

    // 5. Filtered
    expect(renderWithRole('filtered')).toContain('Không có dữ liệu cho phạm vi buổi lễ đã chọn');

    // 6. Permission Denied (Family View)
    const familyView = renderWithRole('populated', 'family_view');
    expect(familyView).toContain('Chỉ xem');
    expect(familyView).not.toContain('Chi dự báo'); // Financial omission
  });
});
