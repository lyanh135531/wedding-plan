import { describe, it, expect } from 'vitest';
import React, { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  RoleProvider,
  useRole,
  FORBIDDEN_FAMILY_ROUTES,
  UserRole,
  RoleContextValue,
} from '@/context/RoleContext';

describe('RoleContext & Role-Aware Security Engine', () => {
  it('throws an error if useRole is used outside of RoleProvider', () => {
    const Consumer = () => {
      useRole();
      return null;
    };

    expect(() => {
      renderToStaticMarkup(React.createElement(Consumer));
    }).toThrow('useRole must be used within a RoleProvider');
  });

  it('provides default owner role with full mutation and finance permissions', () => {
    let captured: RoleContextValue | null = null;

    const Consumer = () => {
      captured = useRole();
      return React.createElement('div', null, captured.role);
    };

    const tree = React.createElement(RoleProvider, null, React.createElement(Consumer));
    const html = renderToStaticMarkup(tree);

    expect(html).toContain('owner');
    expect(captured).not.toBeNull();
    expect(captured!.role).toBe('owner');
    expect(captured!.isOwner).toBe(true);
    expect(captured!.isFamily).toBe(false);
    expect(captured!.canMutate).toBe(true);
    expect(captured!.canViewFinance).toBe(true);
    expect(captured!.allowedEventIds).toBeNull();
  });

  it('provides family_view role with view-only and restricted finance permissions', () => {
    let captured: RoleContextValue | null = null;

    const Consumer = () => {
      captured = useRole();
      return React.createElement('div', null, captured.role);
    };

    const tree = React.createElement(
      RoleProvider,
      { initialRole: 'family_view', initialAllowedEventIds: ['ev-01', 'ev-02'] },
      React.createElement(Consumer)
    );
    const html = renderToStaticMarkup(tree);

    expect(html).toContain('family_view');
    expect(captured).not.toBeNull();
    expect(captured!.role).toBe('family_view');
    expect(captured!.isOwner).toBe(false);
    expect(captured!.isFamily).toBe(true);
    expect(captured!.canMutate).toBe(false);
    expect(captured!.canViewFinance).toBe(false);
    expect(captured!.allowedEventIds).toEqual(['ev-01', 'ev-02']);
  });

  it('canAccessRoute: Owner has access to all routes', () => {
    let captured: RoleContextValue | null = null;

    const Consumer = () => {
      captured = useRole();
      return null;
    };

    renderToStaticMarkup(
      React.createElement(RoleProvider, { initialRole: 'owner' }, React.createElement(Consumer))
    );

    expect(captured!.canAccessRoute('/overview')).toBe(true);
    expect(captured!.canAccessRoute('/budget')).toBe(true);
    expect(captured!.canAccessRoute('/budget/overview')).toBe(true);
    expect(captured!.canAccessRoute('/costs/123')).toBe(true);
    expect(captured!.canAccessRoute('/payments')).toBe(true);
    expect(captured!.canAccessRoute('/fund')).toBe(true);
    expect(captured!.canAccessRoute('/gifts')).toBe(true);
    expect(captured!.canAccessRoute('/data/import')).toBe(true);
    expect(captured!.canAccessRoute('/history')).toBe(true);
    expect(captured!.canAccessRoute('/guests')).toBe(true);
  });

  it('canAccessRoute: Family View is strictly forbidden from all financial and admin routes', () => {
    let captured: RoleContextValue | null = null;

    const Consumer = () => {
      captured = useRole();
      return null;
    };

    renderToStaticMarkup(
      React.createElement(RoleProvider, { initialRole: 'family_view' }, React.createElement(Consumer))
    );

    // Bị cấm tuyệt đối
    FORBIDDEN_FAMILY_ROUTES.forEach((route) => {
      expect(captured!.canAccessRoute(route)).toBe(false);
      expect(captured!.canAccessRoute(`${route}/sub-path`)).toBe(false);
    });

    // Xác nhận rõ ràng route /sharing bị chặn
    expect(captured!.canAccessRoute('/sharing')).toBe(false);
    expect(captured!.canAccessRoute('/sharing/invite')).toBe(false);

    // Được phép truy cập các phân hệ công bố
    expect(captured!.canAccessRoute('/overview')).toBe(true);
    expect(captured!.canAccessRoute('/guests')).toBe(true);
    expect(captured!.canAccessRoute('/guests/g-123')).toBe(true);
    expect(captured!.canAccessRoute('/invitations')).toBe(true);
    expect(captured!.canAccessRoute('/tasks')).toBe(true);
    expect(captured!.canAccessRoute('/calendar')).toBe(true);
    expect(captured!.canAccessRoute('/settings')).toBe(true);
    expect(captured!.canAccessRoute('/data/export')).toBe(true);
  });

  it('canAccessRoute: normalizes casing to prevent uppercase route bypass (e.g., /BUDGET, /SHARING)', () => {
    let captured: RoleContextValue | null = null;

    const Consumer = () => {
      captured = useRole();
      return null;
    };

    renderToStaticMarkup(
      React.createElement(RoleProvider, { initialRole: 'family_view' }, React.createElement(Consumer))
    );

    // Family View: các biến thể chữ hoa của route cấm đều phải bị chặn 100%
    expect(captured!.canAccessRoute('/BUDGET')).toBe(false);
    expect(captured!.canAccessRoute('/Budget')).toBe(false);
    expect(captured!.canAccessRoute('/Budget/Overview')).toBe(false);
    expect(captured!.canAccessRoute('/SHARING')).toBe(false);
    expect(captured!.canAccessRoute('/Sharing')).toBe(false);
    expect(captured!.canAccessRoute('/COSTS')).toBe(false);
    expect(captured!.canAccessRoute('/Costs/123')).toBe(false);
    expect(captured!.canAccessRoute('/PAYMENTS')).toBe(false);
    expect(captured!.canAccessRoute('/FUND')).toBe(false);
    expect(captured!.canAccessRoute('/GIFTS')).toBe(false);
    expect(captured!.canAccessRoute('/DATA/IMPORT')).toBe(false);
    expect(captured!.canAccessRoute('/HISTORY')).toBe(false);

    // Đường dẫn hợp lệ vẫn truy cập được dù viết hoa
    expect(captured!.canAccessRoute('/GUESTS')).toBe(true);
    expect(captured!.canAccessRoute('/Overview')).toBe(true);
  });
});
