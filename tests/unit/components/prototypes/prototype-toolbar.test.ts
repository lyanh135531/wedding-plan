import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PrototypeContext,
  PrototypeToolbar,
  PrototypeScreen,
  PrototypeState,
  PrototypeRole,
} from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';

const h = React.createElement;

describe('Interactive PrototypeToolbar & StateWrapper', () => {
  it('renders PrototypeToolbar with all 8 screens, 6 states, and 2 roles', () => {
    const mockContextValue = {
      screen: 's03_overview' as PrototypeScreen,
      state: 'populated' as PrototypeState,
      role: 'owner' as PrototypeRole,
      setScreen: () => {},
      setState: () => {},
      setRole: () => {},
    };

    const html = renderToStaticMarkup(
      h(
        PrototypeContext.Provider,
        { value: mockContextValue },
        h(PrototypeToolbar, null)
      )
    );

    expect(html).toContain('Prototype Switcher');
    expect(html).toContain('Màn hình (Screen):');
    expect(html).toContain('Trạng thái (State):');
    expect(html).toContain('Vai trò (Role):');

    // All screens in dropdown
    expect(html).toContain('s01_setup');
    expect(html).toContain('s03_overview');
    expect(html).toContain('s05_guests');
    expect(html).toContain('s08_budget');
    expect(html).toContain('s12_tasks');
    expect(html).toContain('s18_seating');
    expect(html).toContain('s25_timeline');
    expect(html).toContain('s32_import');

    // States
    expect(html).toContain('Trống');
    expect(html).toContain('Tải');
    expect(html).toContain('Dữ liệu');
    expect(html).toContain('Lỗi');
    expect(html).toContain('Lọc');
    expect(html).toContain('Cấm 403');

    // Roles
    expect(html).toContain('Chủ sở hữu (Owner)');
    expect(html).toContain('Người nhà (Family)');
  });

  it('StateWrapper renders loading skeleton when state is loading', () => {
    const skeleton = h('div', { id: 'test-skeleton' }, 'Skeleton loader');
    const html = renderToStaticMarkup(
      h(
        StateWrapper,
        {
          state: 'loading',
          loadingSkeleton: skeleton,
        },
        h('div', null, 'Content')
      )
    );

    expect(html).toContain('id="test-skeleton"');
    expect(html).not.toContain('Content');
  });

  it('StateWrapper renders EmptyState when state is empty', () => {
    const html = renderToStaticMarkup(
      h(
        StateWrapper,
        {
          state: 'empty',
          emptyTitle: 'Chưa có dữ liệu kiểm thử',
          emptyDescription: 'Vui lòng nhấn nút để tạo mới dữ liệu',
        },
        h('div', null, 'Content')
      )
    );

    expect(html).toContain('Chưa có dữ liệu kiểm thử');
    expect(html).toContain('Vui lòng nhấn nút để tạo mới dữ liệu');
    expect(html).not.toContain('Content');
  });

  it('StateWrapper renders ErrorState with Request ID when state is error', () => {
    const html = renderToStaticMarkup(
      h(
        StateWrapper,
        {
          state: 'error',
          errorTitle: 'Lỗi tải trang',
          errorMessage: 'Máy chủ phản hồi 500',
          errorRequestId: 'REQ-TEST-123',
        },
        h('div', null, 'Content')
      )
    );

    expect(html).toContain('Lỗi tải trang');
    expect(html).toContain('Máy chủ phản hồi 500');
    expect(html).toContain('REQ-TEST-123');
    expect(html).toContain('Thử lại');
    expect(html).not.toContain('Content');
  });

  it('StateWrapper renders Filtered empty state when state is filtered', () => {
    const html = renderToStaticMarkup(
      h(
        StateWrapper,
        {
          state: 'filtered',
          filteredTitle: 'Không khớp bộ lọc',
          onClearFilter: () => {},
        },
        h('div', null, 'Content')
      )
    );

    expect(html).toContain('Không khớp bộ lọc');
    expect(html).toContain('Xóa bộ lọc');
    expect(html).not.toContain('Content');
  });

  it('StateWrapper renders PermissionDeniedView 403 when state is permission_denied', () => {
    const html = renderToStaticMarkup(
      h(
        StateWrapper,
        {
          state: 'permission_denied',
          permissionDeniedMessage: 'Chỉ Chủ sở hữu mới được xem',
        },
        h('div', null, 'Content')
      )
    );

    expect(html).toContain('Bạn không có quyền truy cập');
    expect(html).toContain('Chỉ Chủ sở hữu mới được xem');
    expect(html).not.toContain('Content');
  });

  it('StateWrapper renders children when state is populated', () => {
    const html = renderToStaticMarkup(
      h(
        StateWrapper,
        {
          state: 'populated',
        },
        h('div', { id: 'populated-content' }, 'Dữ liệu đã nạp đầy đủ')
      )
    );

    expect(html).toContain('id="populated-content"');
    expect(html).toContain('Dữ liệu đã nạp đầy đủ');
  });
});
