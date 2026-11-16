'use client';

import * as React from 'react';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import {
  Utensils,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { Menu, MenuItem, MealSummary, CateringSnapshot, CourseType } from './types';
import {
  INITIAL_MENUS,
  INITIAL_MEAL_SUMMARY,
  INITIAL_CATERING_SNAPSHOT,
} from './fixtures';
import { MealBreakdownDashboard } from './MealBreakdownDashboard';
import { MenuCourseList } from './MenuCourseList';
import { SnapshotLockingModal } from './SnapshotLockingModal';
import { AddEditMenuModal } from './AddEditMenuModal';

export * from './types';
export * from './fixtures';
export * from './MealBreakdownDashboard';
export * from './MenuCourseList';
export * from './SnapshotLockingModal';
export * from './AddEditMenuModal';

const h = React.createElement;

export interface MenusScreenProps {
  initialState?: PrototypeState;
  initialMenus?: Menu[];
  initialSummary?: MealSummary;
  initialSnapshot?: CateringSnapshot;
}

export const MenusScreen: React.FC<MenusScreenProps> = ({
  initialState = 'populated',
  initialMenus = INITIAL_MENUS,
  initialSummary = INITIAL_MEAL_SUMMARY,
  initialSnapshot = INITIAL_CATERING_SNAPSHOT,
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default to owner in isolation
  }
  const { isOwner, isFamily, canMutate } = roleContext;

  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [menus, setMenus] = React.useState<Menu[]>(initialMenus);
  const [activeMenuId, setActiveMenuId] = React.useState<string>(
    initialMenus[0]?.id || ''
  );
  const [summary, setSummary] = React.useState<MealSummary>(initialSummary);
  const [snapshot, setSnapshot] = React.useState<CateringSnapshot>(initialSnapshot);

  // Modals
  const [isLockModalOpen, setIsLockModalOpen] = React.useState(false);
  const [isAddEditMenuModalOpen, setIsAddEditMenuModalOpen] = React.useState(false);
  const [editingMenu, setEditingMenu] = React.useState<Menu | null>(null);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const activeMenu = menus.find((m) => m.id === activeMenuId) || menus[0];

  const handleSaveMenu = (menuData: {
    id?: string;
    name: string;
    mealType: any;
    description?: string;
    pricePerTable?: number;
  }) => {
    if (!canMutate) return;
    if (menuData.id) {
      setMenus((prev) =>
        prev.map((m) =>
          m.id === menuData.id
            ? {
                ...m,
                name: menuData.name,
                mealType: menuData.mealType,
                description: menuData.description,
                pricePerTable: menuData.pricePerTable,
              }
            : m
        )
      );
    } else {
      const newMenu: Menu = {
        id: `menu_${Date.now()}`,
        name: menuData.name,
        mealType: menuData.mealType,
        description: menuData.description,
        items: [],
        isActive: true,
        version: 1,
        pricePerTable: menuData.pricePerTable,
      };
      setMenus((prev) => [...prev, newMenu]);
      setActiveMenuId(newMenu.id);
    }
  };

  const handleLockSnapshot = (notes?: string) => {
    if (!canMutate) return;
    setSnapshot((prev) => ({
      ...prev,
      isLocked: true,
      lockedAt: new Date().toISOString(),
      notes: notes || prev.notes,
    }));
  };

  const handleAddItem = (courseType: CourseType) => {
    if (!canMutate || !activeMenu) return;
    const newItem: MenuItem = {
      id: `item_${Date.now()}`,
      menuId: activeMenu.id,
      courseOrder: activeMenu.items.filter((i) => i.courseType === courseType).length + 1,
      courseType,
      name: `Món mới (${courseType})`,
      dietaryFlags: [],
      price: 350000,
    };
    setMenus((prev) =>
      prev.map((m) =>
        m.id === activeMenu.id ? { ...m, items: [...m.items, newItem] } : m
      )
    );
  };

  const handleDeleteItem = (itemId: string) => {
    if (!canMutate || !activeMenu) return;
    setMenus((prev) =>
      prev.map((m) =>
        m.id === activeMenu.id
          ? { ...m, items: m.items.filter((i) => i.id !== itemId) }
          : m
      )
    );
  };

  const loadingSkeleton = h(
    'div',
    { className: 'space-y-4 animate-pulse', role: 'status', 'aria-label': 'Đang tải thực đơn' },
    h('div', { className: 'h-12 bg-border-subtle rounded-control' }),
    h('div', { className: 'h-36 bg-border-subtle rounded-card' }),
    h('div', { className: 'h-64 bg-border-subtle rounded-card' })
  );

  return h(
    StateWrapper,
    {
      state,
      loadingSkeleton,
      emptyTitle: 'Chưa có thực đơn nào được thiết lập',
      emptyDescription: 'Tạo thực đơn tiệc cưới đầu tiên để bắt đầu phân bổ suất ăn cho khách.',
      emptyActionLabel: isOwner ? '+ Thêm thực đơn mới' : undefined,
      onEmptyAction: isOwner
        ? () => {
            setMenus(INITIAL_MENUS);
            setState('populated');
          }
        : undefined,
      errorTitle: 'Không thể tải thông tin thực đơn',
      errorMessage: 'Lỗi đồng bộ dữ liệu thực đơn từ máy chủ.',
      errorRequestId: 'REQ-20261116-MENU-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không tìm thấy thực đơn phù hợp',
      filteredDescription: 'Hãy thử chọn danh mục hoặc bộ lọc khác.',
      onClearFilter: () => setState('populated'),
      permissionDeniedMessage: 'Bạn không có quyền chỉnh sửa thực đơn tiệc cưới.',
    },
    h(
      'div',
      { className: 'space-y-6 max-w-7xl mx-auto' },

      // Header Toolbar
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Thực Đơn & Suất Ăn Tiệc Cưới'),
          h(
            'p',
            { className: 'text-sm text-text-muted mt-0.5' },
            isFamily
              ? 'Chế độ Người nhà (family_view): Chỉ xem danh mục món ăn và thành phần dinh dưỡng'
              : 'Quản lý món ăn theo phân nhóm, đối chiếu tổng suất tiệc và khóa chốt với nhà hàng'
          )
        ),

        h(
          'div',
          { className: 'flex items-center flex-wrap gap-2' },
          // Lock Snapshot Button: Owner only per AT52 & AT03/AT26
          isOwner &&
            h(
              Button,
              {
                type: 'button',
                variant: snapshot.isLocked ? 'secondary' : 'primary',
                onClick: () => {
                  if (!snapshot.isLocked) {
                    setIsLockModalOpen(true);
                  }
                },
                className: `text-xs h-9 flex items-center gap-1.5 ${
                  snapshot.isLocked
                    ? 'bg-[#F0FDF4] text-[#15803D] border border-[#86EFAC]'
                    : 'bg-[#B45309] hover:bg-[#92400E] text-white'
                }`,
              },
              snapshot.isLocked
                ? h(CheckCircle2, { className: 'w-3.5 h-3.5' })
                : h(Lock, { className: 'w-3.5 h-3.5' }),
              snapshot.isLocked ? 'Snapshot v1 Đã Khóa' : 'Chốt & Khóa Thực Đơn'
            ),

          // Add Menu Button: Owner only per AT03/AT26
          isOwner &&
            h(
              Button,
              {
                type: 'button',
                variant: 'primary',
                onClick: () => {
                  setEditingMenu(null);
                  setIsAddEditMenuModalOpen(true);
                },
                className: 'text-xs h-9 flex items-center gap-1.5',
              },
              h(Plus, { className: 'w-3.5 h-3.5' }),
              'Thêm thực đơn mới'
            )
        )
      ),

      // Snapshot Locked Banner (AT52)
      snapshot.isLocked &&
        h(
          'div',
          {
            className:
              'p-3.5 bg-[#F0FDF4] border border-[#86EFAC] rounded-card flex items-center justify-between text-xs text-[#15803D]',
          },
          h(
            'div',
            { className: 'flex items-center gap-2.5' },
            h(Lock, { className: 'w-4 h-4 text-[#15803D] shrink-0' }),
            h(
              'span',
              null,
              h('strong', null, 'Bản chốt thực đơn v1 đã khóa (Snapshot).'),
              ' Số lượng suất ăn đã được đóng băng gửi nhà hàng.',
              snapshot.notes && ` (${snapshot.notes})`
            )
          )
        ),

      // Live Meal Breakdown Dashboard (Adult, Child, Veg, Buffer vs RSVP)
      h(MealBreakdownDashboard, { summary }),

      // Menu Tabs
      menus.length > 1 &&
        h(
          'div',
          { className: 'flex items-center gap-2 border-b border-border-subtle pb-1 overflow-x-auto' },
          menus.map((m) => {
            const isActive = m.id === activeMenuId;
            return h(
              'button',
              {
                key: m.id,
                type: 'button',
                onClick: () => setActiveMenuId(m.id),
                className: `px-3.5 py-2 rounded-t-control text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
                  isActive
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-text-muted hover:text-text-main hover:bg-[#FAF9F5]'
                }`,
              },
              m.name
            );
          })
        ),

      // Course Items List for Active Menu
      activeMenu &&
        h(MenuCourseList, {
          menu: activeMenu,
          onAddItem: handleAddItem,
          onDeleteItem: handleDeleteItem,
        }),

      // Modals
      isLockModalOpen &&
        isOwner &&
        h(SnapshotLockingModal, {
          isOpen: isLockModalOpen,
          onClose: () => setIsLockModalOpen(false),
          summary,
          onLockSnapshot: handleLockSnapshot,
        }),

      isAddEditMenuModalOpen &&
        isOwner &&
        h(AddEditMenuModal, {
          isOpen: isAddEditMenuModalOpen,
          onClose: () => setIsAddEditMenuModalOpen(false),
          onSave: handleSaveMenu,
          editingMenu,
        })
    )
  );
};
