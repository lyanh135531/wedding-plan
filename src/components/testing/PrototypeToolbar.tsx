'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation.js';
import { useRole } from '@/context/RoleContext';

const h = React.createElement;

export type PrototypeScreen =
  | 's01_setup'
  | 's03_overview'
  | 's05_guests'
  | 's08_budget'
  | 's12_tasks'
  | 's18_seating'
  | 's25_timeline'
  | 's32_import';

export type PrototypeState =
  | 'empty'
  | 'loading'
  | 'populated'
  | 'error'
  | 'filtered'
  | 'permission_denied';

export type PrototypeRole = 'owner' | 'family_view';

export interface PrototypeContextProps {
  screen: PrototypeScreen;
  state: PrototypeState;
  role: PrototypeRole;
  setScreen: (screen: PrototypeScreen) => void;
  setState: (state: PrototypeState) => void;
  setRole: (role: PrototypeRole) => void;
}

export const PrototypeContext = React.createContext<PrototypeContextProps | null>(null);

export const SCREEN_TO_ROUTE: Record<PrototypeScreen, string> = {
  s01_setup: '/setup',
  s03_overview: '/overview',
  s05_guests: '/guests',
  s08_budget: '/budget',
  s12_tasks: '/tasks',
  s18_seating: '/seating',
  s25_timeline: '/timeline',
  s32_import: '/data/import',
};

export const ROUTE_TO_SCREEN: Record<string, PrototypeScreen> = {
  '/setup': 's01_setup',
  '/login': 's01_setup',
  '/overview': 's03_overview',
  '/guests': 's05_guests',
  '/invitations': 's05_guests',
  '/budget': 's08_budget',
  '/payments': 's08_budget',
  '/costs': 's08_budget',
  '/tasks': 's12_tasks',
  '/calendar': 's12_tasks',
  '/seating': 's18_seating',
  '/timeline': 's25_timeline',
  '/data/import': 's32_import',
  '/data/export': 's32_import',
};

function InnerPrototypeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/overview';
  const searchParams = useSearchParams();

  // Try to determine initial screen from pathname or query param
  const detectedScreenFromPath = Object.entries(ROUTE_TO_SCREEN).find(([r]) =>
    pathname.startsWith(r)
  )?.[1];

  const paramScreen = searchParams?.get('proto_screen') as PrototypeScreen | null;
  const paramState = searchParams?.get('proto_state') as PrototypeState | null;
  const paramRole = searchParams?.get('proto_role') as PrototypeRole | null;

  const [screen, setScreenState] = React.useState<PrototypeScreen>(
    paramScreen || detectedScreenFromPath || 's03_overview'
  );
  const [state, setStateState] = React.useState<PrototypeState>(paramState || 'populated');
  const [role, setRoleState] = React.useState<PrototypeRole>(paramRole || 'owner');

  // RoleContext integration
  let roleCtx: ReturnType<typeof useRole> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    roleCtx = useRole();
  } catch {
    roleCtx = null;
  }

  // Sync role with RoleContext when changed
  React.useEffect(() => {
    if (roleCtx && roleCtx.role !== role) {
      roleCtx.setRoleForPreview(role);
    }
  }, [role, roleCtx]);

  // Sync state with URL params
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      let changed = false;
      if (url.searchParams.get('proto_screen') !== screen) {
        url.searchParams.set('proto_screen', screen);
        changed = true;
      }
      if (url.searchParams.get('proto_state') !== state) {
        url.searchParams.set('proto_state', state);
        changed = true;
      }
      if (url.searchParams.get('proto_role') !== role) {
        url.searchParams.set('proto_role', role);
        changed = true;
      }
      if (changed) {
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [screen, state, role]);

  const setScreen = React.useCallback(
    (newScreen: PrototypeScreen) => {
      setScreenState(newScreen);
      const targetRoute = SCREEN_TO_ROUTE[newScreen];
      if (targetRoute && pathname !== targetRoute) {
        const query = `?proto_screen=${newScreen}&proto_state=${state}&proto_role=${role}`;
        router.push(`${targetRoute}${query}`);
      }
    },
    [pathname, router, state, role]
  );

  const setState = React.useCallback((newState: PrototypeState) => {
    setStateState(newState);
  }, []);

  const setRole = React.useCallback(
    (newRole: PrototypeRole) => {
      setRoleState(newRole);
      if (roleCtx) {
        roleCtx.setRoleForPreview(newRole);
      }
    },
    [roleCtx]
  );

  const value = React.useMemo(
    () => ({
      screen,
      state,
      role,
      setScreen,
      setState,
      setRole,
    }),
    [screen, state, role, setScreen, setState, setRole]
  );

  return h(
    PrototypeContext.Provider,
    { value },
    children,
    h(PrototypeToolbar, null)
  );
}

export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  // Wrap with Suspense to satisfy Next.js useSearchParams client requirement
  return h(
    React.Suspense,
    { fallback: children },
    h(InnerPrototypeProvider, null, children)
  );
}

export function usePrototype(): PrototypeContextProps {
  const context = React.useContext(PrototypeContext);
  if (!context) {
    // Return safe default if not inside Provider
    return {
      screen: 's03_overview',
      state: 'populated',
      role: 'owner',
      setScreen: () => {},
      setState: () => {},
      setRole: () => {},
    };
  }
  return context;
}

export function PrototypeToolbar() {
  const ctx = React.useContext(PrototypeContext);
  const [collapsed, setCollapsed] = React.useState(false);

  if (!ctx) return null;
  const { screen, state, role, setScreen, setState, setRole } = ctx;

  if (collapsed) {
    return h(
      'button',
      {
        onClick: () => setCollapsed(false),
        className:
          'fixed bottom-4 right-4 z-50 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] print:hidden',
        title: 'Mở công cụ Prototype Switcher',
        'aria-label': 'Mở Prototype Switcher',
      },
      '⚙️'
    );
  }

  return h(
    'aside',
    {
      className:
        'fixed bottom-4 right-4 z-50 bg-surface border border-border-control rounded-xl shadow-2xl p-4 w-[340px] text-text-main text-sm print:hidden',
      'aria-label': 'Bảng điều khiển Prototype Testing',
      role: 'region',
    },
    // Header
    h(
      'div',
      { className: 'flex justify-between items-center mb-3 border-b border-border-subtle pb-2' },
      h(
        'span',
        { className: 'font-semibold text-xs tracking-wider uppercase text-text-muted' },
        'Prototype Switcher'
      ),
      h(
        'button',
        {
          onClick: () => setCollapsed(true),
          className: 'text-xs text-text-muted hover:text-text-main px-1',
          'aria-label': 'Thu nhỏ bảng điều khiển',
        },
        'Thu nhỏ ✕'
      )
    ),

    h(
      'div',
      { className: 'space-y-3' },

      // Screen Selector
      h(
        'div',
        null,
        h(
          'label',
          { htmlFor: 'proto-screen-select', className: 'block text-xs font-medium text-text-muted mb-1' },
          'Màn hình (Screen):'
        ),
        h(
          'select',
          {
            id: 'proto-screen-select',
            value: screen,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              setScreen(e.target.value as PrototypeScreen),
            className:
              'w-full h-9 px-2 text-sm border border-border-control rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
          },
          h('option', { value: 's01_setup' }, 'S01 / S02: Thiết lập (Setup)'),
          h('option', { value: 's03_overview' }, 'S03: Tổng quan (Overview)'),
          h('option', { value: 's05_guests' }, 'S05 / S07: Khách & Thiệp (Guests)'),
          h('option', { value: 's08_budget' }, 'S08 / S10: Ngân sách & Tiền (Budget)'),
          h('option', { value: 's12_tasks' }, 'S12 / S13: Công việc (Tasks)'),
          h('option', { value: 's18_seating' }, 'S18: Xếp bàn (Seating)'),
          h('option', { value: 's25_timeline' }, 'S25: Lịch trình (Timeline)'),
          h('option', { value: 's32_import' }, 'S32: Nhập dữ liệu (Import)')
        )
      ),

      // State Selector
      h(
        'div',
        null,
        h(
          'label',
          { className: 'block text-xs font-medium text-text-muted mb-1' },
          'Trạng thái (State):'
        ),
        h(
          'div',
          { className: 'grid grid-cols-3 gap-1', role: 'radiogroup', 'aria-label': 'Chọn trạng thái' },
          (['empty', 'loading', 'populated', 'error', 'filtered', 'permission_denied'] as PrototypeState[]).map(
            (s) => {
              const labelMap: Record<PrototypeState, string> = {
                empty: 'Trống',
                loading: 'Tải',
                populated: 'Dữ liệu',
                error: 'Lỗi',
                filtered: 'Lọc',
                permission_denied: 'Cấm 403',
              };
              const isSelected = state === s;
              return h(
                'button',
                {
                  key: s,
                  type: 'button',
                  role: 'radio',
                  'aria-checked': isSelected,
                  onClick: () => setState(s),
                  className: `h-7 text-xs rounded border transition-colors ${
                    isSelected
                      ? 'bg-primary text-white border-primary font-medium'
                      : 'bg-surface text-text-main border-border-subtle hover:bg-page'
                  }`,
                },
                labelMap[s]
              );
            }
          )
        )
      ),

      // Role Selector
      h(
        'div',
        null,
        h(
          'label',
          { className: 'block text-xs font-medium text-text-muted mb-1' },
          'Vai trò (Role):'
        ),
        h(
          'div',
          { className: 'grid grid-cols-2 gap-2' },
          h(
            'button',
            {
              type: 'button',
              onClick: () => setRole('owner'),
              className: `h-8 text-xs font-medium rounded-lg border transition-colors ${
                role === 'owner'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-text-main border-border-control hover:bg-page'
              }`,
            },
            'Chủ sở hữu (Owner)'
          ),
          h(
            'button',
            {
              type: 'button',
              onClick: () => setRole('family_view'),
              className: `h-8 text-xs font-medium rounded-lg border transition-colors ${
                role === 'family_view'
                  ? 'bg-[#854D0E] text-white border-[#854D0E]'
                  : 'bg-surface text-text-main border-border-control hover:bg-page'
              }`,
            },
            'Người nhà (Family)'
          )
        )
      ),

      // Viewport test helper hint
      h(
        'div',
        { className: 'pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted' },
        h('span', null, 'Viewport test:'),
        h(
          'span',
          { className: 'font-mono text-xs text-primary font-medium' },
          '360 | 390 | 768 | 1440'
        )
      )
    )
  );
}
