import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PermissionDeniedView } from '@/components/layout/PermissionDeniedView';

describe('PermissionDeniedView Component (UI/UX Spec §3.2, §4)', () => {
  it('renders default 403 access denied view with friendly explanations', () => {
    const tree = React.createElement(PermissionDeniedView);
    const html = renderToStaticMarkup(tree);

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Bạn không có quyền truy cập');
    expect(html).toContain('Phân hệ này dành riêng cho hai chủ sở hữu');
    expect(html).toContain('href="/overview"');
    expect(html).toContain('Quay về Tổng quan');
    expect(html).toContain('bg-[#23483E]');
    expect(html).toContain('min-h-[44px]');
  });

  it('supports custom title, message, and return target', () => {
    const tree = React.createElement(PermissionDeniedView, {
      title: 'Khu vực nhạy cảm',
      message: 'Chỉ tài khoản admin mới được chỉnh sửa.',
      returnUrl: '/tasks',
      returnLabel: 'Quay lại Công việc',
    });

    const html = renderToStaticMarkup(tree);

    expect(html).toContain('Khu vực nhạy cảm');
    expect(html).toContain('Chỉ tài khoản admin mới được chỉnh sửa.');
    expect(html).toContain('href="/tasks"');
    expect(html).toContain('Quay lại Công việc');
  });
});
