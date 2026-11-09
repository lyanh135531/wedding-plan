import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DirtyFormGuardModal } from '@/components/layout/DirtyFormGuardModal';

describe('DirtyFormGuardModal Component (UI/UX Spec §3.3)', () => {
  it('returns null when isOpen is false', () => {
    const tree = React.createElement(DirtyFormGuardModal, {
      isOpen: false,
      onConfirm: () => {},
      onCancel: () => {},
    });

    const html = renderToStaticMarkup(tree);
    expect(html).toBe('');
  });

  it('renders accessible dialog with default warnings when isOpen is true', () => {
    const tree = React.createElement(DirtyFormGuardModal, {
      isOpen: true,
      onConfirm: () => {},
      onCancel: () => {},
    });

    const html = renderToStaticMarkup(tree);

    // Accessible attributes
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="dirty-guard-title"');
    expect(html).toContain('aria-describedby="dirty-guard-desc"');

    // Default title & warning content
    expect(html).toContain('Biểu mẫu chưa lưu');
    expect(html).toContain('Dữ liệu bạn vừa nhập chưa được lưu');
    expect(html).toContain('bị hủy bỏ hoàn toàn');

    // Buttons
    expect(html).toContain('Ở lại biểu mẫu');
    expect(html).toContain('Bỏ thay đổi &amp; Chuyển buổi');
    expect(html).toContain('bg-[#B42318]');
    expect(html).toContain('min-h-[44px]');
  });

  it('supports custom title and message', () => {
    const tree = React.createElement(DirtyFormGuardModal, {
      isOpen: true,
      onConfirm: () => {},
      onCancel: () => {},
      title: 'Cảnh báo mất dữ liệu khách',
      message: 'Khách mời chưa được lưu vào danh sách.',
    });

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('Cảnh báo mất dữ liệu khách');
    expect(html).toContain('Khách mời chưa được lưu vào danh sách.');
  });
});
