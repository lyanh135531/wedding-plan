import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GoogleLoginCard } from '@/components/modules/auth/GoogleLoginCard';
import { UninvitedAccountBanner } from '@/components/modules/auth/UninvitedAccountBanner';
import { StepNames } from '@/components/modules/auth/StepNames';
import { StepWeddingDate } from '@/components/modules/auth/StepWeddingDate';
import { StepCategoryPreview, DEFAULT_STARTER_CATEGORIES } from '@/components/modules/auth/StepCategoryPreview';
import { SetupWizard } from '@/components/modules/auth/SetupWizard';

const h = React.createElement;

describe('S01: Authentication Entrypoint (GoogleLoginCard & Uninvited Banner)', () => {
  it('renders Google Login Card with its accessible action and privacy notices', () => {
    const html = renderToStaticMarkup(
      h(GoogleLoginCard, { isUninvited: false })
    );

    expect(html).toContain('Sổ Quản Lý Đám Cưới');
    expect(html).toContain('Đăng nhập bằng Google');
    expect(html).toContain('auth-signin');
    expect(html).toContain('Một không gian riêng cho gia đình.');
    expect(html).toContain('Chỉ tài khoản đã được chủ sở hữu cấp quyền');
  });

  it('renders uninvited account banner with friendly 403 and zero owner metadata disclosure', () => {
    const html = renderToStaticMarkup(
      h(UninvitedAccountBanner, { email: 'stranger@gmail.com' })
    );

    expect(html).toContain('Tài khoản chưa được cấp quyền');
    expect(html).toContain('stranger@gmail.com');
    expect(html).toContain('Vui lòng liên hệ hai chủ sở hữu đám cưới để nhận lời mời');
    expect(html).toContain('Đổi tài khoản khác');
    // Security check: Never disclose internal admin or owner emails
    expect(html).not.toContain('admin@');
    expect(html).not.toContain('owner@');
  });
});

describe('S02: First-Time Setup Wizard & UXT01 Unconfirmed Date', () => {
  it('Step 1 (StepNames) renders bride and groom name inputs with required labels', () => {
    const html = renderToStaticMarkup(
      h(StepNames, {
        groomName: 'Nguyễn Văn Minh',
        brideName: 'Trần Phương Linh',
        onChangeGroom: () => {},
        onChangeBride: () => {},
      })
    );

    expect(html).toContain('Bước 1: Thông tin đôi uyên ương');
    expect(html).toContain('Họ và tên Chú rể');
    expect(html).toContain('Họ và tên Cô dâu');
    expect(html).toContain('Nguyễn Văn Minh');
    expect(html).toContain('Trần Phương Linh');
  });

  it('Step 2 (StepWeddingDate) satisfies UXT01: unconfirmed date checkbox renders text note and eliminates date picker', () => {
    // When isUnconfirmedDate = true:
    const unconfirmedHtml = renderToStaticMarkup(
      h(StepWeddingDate, {
        weddingDate: null,
        isUnconfirmedDate: true,
        estimatedDateNote: 'Dự kiến sau Tết âm lịch 2028',
        onChangeDate: () => {},
        onChangeUnconfirmed: () => {},
        onChangeEstimatedNote: () => {},
      })
    );

    expect(unconfirmedHtml).toContain('Chưa chốt ngày cưới chính thức (đang xem ngày)');
    expect(unconfirmedHtml).toContain('Ghi chú thời gian dự kiến');
    expect(unconfirmedHtml).toContain('Dự kiến sau Tết âm lịch 2028');
    expect(unconfirmedHtml).toContain('Hệ thống sẽ không tự gán ngày giả và không bật đồng hồ đếm ngược');
    // Must NOT contain date picker input or fake date
    expect(unconfirmedHtml).not.toContain('01/01/2028');
    expect(unconfirmedHtml).not.toContain('type="date"');
  });

  it('Step 2 (StepWeddingDate) renders standard date picker when date is confirmed', () => {
    const confirmedHtml = renderToStaticMarkup(
      h(StepWeddingDate, {
        weddingDate: '2026-12-15',
        isUnconfirmedDate: false,
        estimatedDateNote: '',
        onChangeDate: () => {},
        onChangeUnconfirmed: () => {},
        onChangeEstimatedNote: () => {},
      })
    );

    expect(confirmedHtml).toContain('Ngày cưới chính thức');
    expect(confirmedHtml).toContain('15/12/2026');
  });

  it('Step 3 (StepCategoryPreview) renders starter categories with checkboxes and zero fake monetary values', () => {
    const html = renderToStaticMarkup(
      h(StepCategoryPreview, {
        categories: DEFAULT_STARTER_CATEGORIES,
        onToggleCategory: () => {},
      })
    );

    expect(html).toContain('Bước 3: Khởi tạo danh mục mẫu');
    expect(html).toContain('Tiệc cưới &amp; Địa điểm');
    expect(html).toContain('Trang phục &amp; Trang điểm');
    expect(html).toContain('Chụp ảnh &amp; Quay phim');
    // Integrity check: No fake prices injected
    expect(html).not.toContain('50.000.000 ₫');
    expect(html).not.toContain('100.000.000 ₫');
  });

  it('SetupWizard renders all 6 mandatory states properly', () => {
    // 1. Loading state
    const loadingHtml = renderToStaticMarkup(h(SetupWizard, { initialState: 'loading' }));
    expect(loadingHtml).toContain('animate-pulse');

    // 2. Empty state
    const emptyHtml = renderToStaticMarkup(h(SetupWizard, { initialState: 'empty' }));
    expect(emptyHtml).toContain('Bắt đầu thiết lập sổ cưới');

    // 3. Populated state
    const populatedHtml = renderToStaticMarkup(h(SetupWizard, { initialState: 'populated' }));
    expect(populatedHtml).toContain('Nguyễn Văn Minh');
    expect(populatedHtml).toContain('Bước 1 / 3');

    // 4. Error state
    const errorHtml = renderToStaticMarkup(h(SetupWizard, { initialState: 'error' }));
    expect(errorHtml).toContain('Lỗi thiết lập ban đầu');
    expect(errorHtml).toContain('REQ-20261106-SETUP-ERR');

    // 5. Permission denied state
    const deniedHtml = renderToStaticMarkup(h(SetupWizard, { initialState: 'permission_denied' }));
    expect(deniedHtml).toContain('Bạn không có quyền truy cập');
  });
});
