import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { SeatingManager } from '@/components/modules/seating/SeatingManager';
import { TimelineManager } from '@/components/modules/timeline/TimelineManager';
import { DataImportWizard } from '@/components/modules/data-import/DataImportWizard';
import { DataExportView } from '@/components/modules/data-export/DataExportView';
import { CalendarAgendaView } from '@/components/modules/calendar/CalendarAgendaView';

const h = React.createElement;

describe('S18: Seating Prototype & UXT12/UXT13/UXT14', () => {
  it('renders mobile tap-to-seat workflow with unassigned guests list (UXT12)', () => {
    const html = renderToStaticMarkup(
      h(SeatingManager, { initialState: 'populated' })
    );

    expect(html).toContain('Sơ Đồ Xếp Bàn Tiệc');
    expect(html).toContain('Khách chưa xếp bàn');
    expect(html).toContain('Bước 1:');
    expect(html).toContain('Bước 2:');
    expect(html).toContain('Bàn A1');
    expect(html).toContain('Bàn A2');
  });

  it('handles 409 Race condition capacity conflict alert (UXT13)', () => {
    const html = renderToStaticMarkup(
      h(SeatingManager, { initialState: 'populated' })
    );

    expect(html).toContain('Mô phỏng lỗi 409 Conflict');
  });

  it('shows immutable seating snapshot banner when new guests are added (UXT14)', () => {
    const html = renderToStaticMarkup(
      h(SeatingManager, { initialState: 'populated' })
    );

    expect(html).toContain('Bản chốt sơ đồ v1 đã khóa (Snapshot)');
    expect(html).toContain('chưa bàn giao lại cho nhà hàng');
  });
});

describe('S25: Day-Of Wedding Live Timeline Prototype (UXT15)', () => {
  it('prominently displays Đang diễn ra and Tiếp theo cards at top', () => {
    const html = renderToStaticMarkup(
      h(TimelineManager, { initialState: 'populated' })
    );

    expect(html).toContain('Lịch Trình Ngày Cưới (Live Timeline)');
    expect(html).toContain('⚡ Đang diễn ra');
    expect(html).toContain('Lễ Gia Tiên &amp; Trao Duyên tại Nhà Gái');
    expect(html).toContain('➡️ Tiếp theo');
    expect(html).toContain('Lễ Rước Dâu &amp; Nhập Trạch Nhà Trai');
    expect(html).toContain('Điều chỉnh dời giờ');
  });
});

describe('S32: 5-Step CSV/XLSX Import Wizard (UXT23)', () => {
  it('Step 3 displays row-by-row error table and Skip Invalid Rows option', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'owner' },
        h(DataImportWizard, { initialState: 'populated' })
      )
    );

    expect(html).toContain('Phát hiện 2 dòng dữ liệu lỗi');
    expect(html).toContain('#14');
    expect(html).toContain('#42');
    expect(html).toContain('Bỏ qua 2 dòng lỗi này và tiếp tục nhập 98 dòng hợp lệ');
  });

  it('blocks Family View from accessing Data Import Wizard', () => {
    const familyHtml = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'family_view' },
        h(DataImportWizard, null)
      )
    );

    expect(familyHtml).toContain('Bạn không có quyền truy cập');
    expect(familyHtml).toContain('Tính năng Nhập dữ liệu chỉ dành cho Chủ sở hữu đám cưới');
  });
});

describe('S33: Anti-Injection Data Export & Print Layout (UXT22)', () => {
  it('sanitizes cells starting with unsafe formula characters', () => {
    const html = renderToStaticMarkup(h(DataExportView, null));

    expect(html).toContain('Cơ chế bảo vệ chống CSV Formula Injection');
    expect(html).toContain('In trang này (A4)');
    expect(html).toContain('Tải CSV an toàn');
    expect(html).toContain('Đã gắn nháy đơn chống CSV Injection');
  });
});

describe('S14: Calendar Agenda View', () => {
  it('renders month days and agenda events', () => {
    const html = renderToStaticMarkup(h(CalendarAgendaView, null));

    expect(html).toContain('Lịch Hẹn &amp; Tiến Độ');
    expect(html).toContain('Tháng 11, 2026');
    expect(html).toContain('Thử trang phục cưới');
    expect(html).toContain('Lễ Ăn Hỏi');
  });
});
