import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import {
  R2SignoffDashboard,
  ReadinessMatrix,
  CreateSnapshotModal,
  ReadinessDomainItem,
  R2Snapshot,
  DeltaChange,
} from '@/components/modules/r2-signoff';

const h = React.createElement;

describe('S27: Milestone R2 Sign-off Dashboard Unit Tests', () => {
  const mockDomains: ReadinessDomainItem[] = [
    {
      id: 'guests',
      title: '1. Khách mời & Điểm danh',
      status: 'ready',
      score: 95,
      summary: '180 khách đã xác nhận tham dự',
      details: [{ label: 'Xác nhận', value: '180 khách', isOk: true }],
      route: '/guests',
    },
    {
      id: 'budget',
      title: '2. Ngân sách & Hợp đồng',
      status: 'ready',
      score: 92,
      summary: '6/6 hợp đồng đã chốt',
      details: [{ label: 'Dự toán', value: '350.000.000 đ', isOk: true }],
      route: '/budget',
    },
    {
      id: 'seating',
      title: '3. Sơ đồ bàn & Chỗ ngồi',
      status: 'ready',
      score: 100,
      summary: '18 bàn (180 chỗ) khớp chính xác 180 khách',
      details: [
        { label: 'Cân đối', value: 'Khớp 100% (Không ghế thừa/thiếu)', isOk: true },
      ],
      route: '/seating',
    },
    {
      id: 'menus',
      title: '4. Thực đơn & Suất ăn',
      status: 'ready',
      score: 100,
      summary: '180 suất chính + 5 suất chay',
      details: [{ label: 'Suất mặn', value: '180 suất', isOk: true }],
      route: '/menus',
    },
    {
      id: 'logistics',
      title: '5. Lưu trú & Xe đón tiễn',
      status: 'ready',
      score: 95,
      summary: '10 phòng KS, 2 xe 29 chỗ',
      details: [{ label: 'Sức chứa xe', value: '45/58 khách', isOk: true }],
      route: '/logistics',
    },
    {
      id: 'preparation',
      title: '6. Đồ dùng chuẩn bị & Đồ thuê',
      status: 'ready',
      score: 100,
      summary: '5 nhóm đồ, 2 đồ thuê có hạn trả',
      details: [{ label: 'Đồ thuê', value: '2 món', isOk: true }],
      route: '/preparation',
    },
    {
      id: 'program',
      title: '7. Nhạc nghi lễ & Cảnh quay chụp',
      status: 'ready',
      score: 96,
      summary: '6 bài hát, 4 cảnh chụp bắt buộc',
      details: [{ label: 'Cảnh chụp', value: '4 cảnh', isOk: true }],
      route: '/preparation?tab=music',
    },
    {
      id: 'support',
      title: '8. Đội ngũ hỗ trợ ngày cưới',
      status: 'ready',
      score: 100,
      summary: '9 vai trò then chốt đã phân công',
      details: [{ label: 'Nhân sự', value: '7 người', isOk: true }],
      route: '/support',
    },
  ];

  const mockSnapshots: R2Snapshot[] = [
    {
      id: 'snap_01',
      version: 'R2-v1.0',
      createdAt: '2026-11-15T16:30:00Z',
      createdBy: 'Thu Trang (Cô dâu)',
      overallReadiness: 97,
      notes: 'Bản chốt chính thức R2',
      guestCount: 178,
      seatingCount: 178,
      mealCount: 178,
      handedOverAt: '2026-11-15T17:00:00Z',
      handedOverTo: 'Anh Hùng (Quản lý sảnh)',
      handoverChannel: 'Biên bản giấy',
    },
  ];

  const mockDelta: DeltaChange[] = [
    {
      domain: 'Khách mời & Chỗ ngồi',
      description: '+2 khách mời xác nhận bổ sung',
      type: 'added',
    },
  ];

  describe('8 Readiness Domains Matrix & Balance Checks', () => {
    it('renders all 8 domain cards with progress meters and balance check details', () => {
      const html = renderToStaticMarkup(
        h(ReadinessMatrix, { domains: mockDomains })
      );

      // Verify all 8 domain titles
      expect(html).toContain('1. Khách mời &amp; Điểm danh');
      expect(html).toContain('2. Ngân sách &amp; Hợp đồng');
      expect(html).toContain('3. Sơ đồ bàn &amp; Chỗ ngồi');
      expect(html).toContain('4. Thực đơn &amp; Suất ăn');
      expect(html).toContain('5. Lưu trú &amp; Xe đón tiễn');
      expect(html).toContain('6. Đồ dùng chuẩn bị &amp; Đồ thuê');
      expect(html).toContain('7. Nhạc nghi lễ &amp; Cảnh quay chụp');
      expect(html).toContain('8. Đội ngũ hỗ trợ ngày cưới');

      // Balance check confirmation
      expect(html).toContain('Khớp 100% (Không ghế thừa/thiếu)');
      expect(html).toContain('Mở màn hình chi tiết');
    });
  });

  describe('Immutable Snapshot Creation & Delta Changes View', () => {
    it('renders CreateSnapshotModal with immutability safeguard notice and balance metrics', () => {
      const html = renderToStaticMarkup(
        h(CreateSnapshotModal, {
          isOpen: true,
          onClose: () => {},
          onSubmit: () => {},
          nextVersionSuggestion: 'R2-v1.1',
          guestCount: 180,
          seatingCount: 180,
          mealCount: 180,
        })
      );

      expect(html).toContain('Tạo Bản Chốt Cột Mốc R2 (Snapshot)');
      expect(html).toContain('Quy tắc tính bất biến của Snapshot (PLAN §24.1)');
      expect(html).toContain('Bản chốt R2 sau khi tạo là bất biến (immutable)');
      expect(html).toContain('180 khách');
      expect(html).toContain('180 chỗ');
      expect(html).toContain('180 suất');
      expect(html).toContain('Tạo Bản Chốt Bất Biến');
    });

    it('renders delta changes between current live state and snapshot', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(R2SignoffDashboard, {
            initialState: 'populated',
            initialDomains: mockDomains,
            initialSnapshots: mockSnapshots,
            initialDeltaChanges: mockDelta,
          })
        )
      );

      expect(html).toContain('Chênh Lệch Dữ Liệu So Với Bản Chốt Gần Nhất (Delta)');
      expect(html).toContain('[Khách mời &amp; Chỗ ngồi]:');
      expect(html).toContain('+2 khách mời xác nhận bổ sung');
    });
  });

  describe('Handover Recording, A4 Print Pack & Role Access', () => {
    it('renders handover confirmation metadata and A4 print button for owner', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(R2SignoffDashboard, {
            initialState: 'populated',
            initialDomains: mockDomains,
            initialSnapshots: mockSnapshots,
            initialDeltaChanges: mockDelta,
          })
        )
      );

      expect(html).toContain('Đã bàn giao cho: Anh Hùng (Quản lý sảnh)');
      expect(html).toContain('Biên bản giấy');
      expect(html).toContain('Xuất bộ tài liệu in A4');
      expect(html).toContain('Tạo bản chốt R2 (Snapshot)');
    });

    it('hides snapshot creation for family_view role', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'family_view' },
          h(R2SignoffDashboard, {
            initialState: 'populated',
            initialDomains: mockDomains,
            initialSnapshots: mockSnapshots,
            initialDeltaChanges: mockDelta,
          })
        )
      );

      // Family view does not have snapshot creation mutation button
      expect(html).not.toContain('Tạo bản chốt R2 (Snapshot)');
      // But can view print pack
      expect(html).toContain('Xuất bộ tài liệu in A4');
    });
  });
});
