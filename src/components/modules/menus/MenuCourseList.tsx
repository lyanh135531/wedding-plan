'use client';

import * as React from 'react';
import { Menu, MenuItem, CourseType } from './types';
import { useRole } from '@/context/RoleContext';
import { Plus, Edit, Trash2, AlertTriangle, Coffee, UtensilsCrossed, Cake, Wine } from 'lucide-react';
import { Button } from '@/components/ui/button';

const h = React.createElement;

export interface MenuCourseListProps {
  menu: Menu;
  onAddItem?: (courseType: CourseType) => void;
  onEditItem?: (item: MenuItem) => void;
  onDeleteItem?: (itemId: string) => void;
  className?: string;
}

const COURSE_SECTIONS: { type: CourseType; label: string; icon: any }[] = [
  { type: 'appetizer', label: 'Món Khai Vị', icon: UtensilsCrossed },
  { type: 'main', label: 'Món Chính', icon: Cake },
  { type: 'dessert', label: 'Món Tráng Miệng', icon: Coffee },
  { type: 'beverage', label: 'Đồ Uống & Rượu Tiệc', icon: Wine },
];

export const MenuCourseList: React.FC<MenuCourseListProps> = ({
  menu,
  onAddItem,
  onEditItem,
  onDeleteItem,
  className = '',
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default to owner in isolation
  }
  const { isOwner, isFamily, canMutate } = roleContext;

  const formatPrice = (val?: number) => {
    if (!val) return '';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const renderDietaryTag = (flag: string) => {
    switch (flag) {
      case 'vegetarian':
        return h(
          'span',
          { key: flag, className: 'text-[10px] px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#059669] font-medium' },
          'Ăn chay'
        );
      case 'gluten_free':
        return h(
          'span',
          { key: flag, className: 'text-[10px] px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] font-medium' },
          'Không Gluten'
        );
      case 'kids':
        return h(
          'span',
          { key: flag, className: 'text-[10px] px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#D97706] font-medium' },
          'Món trẻ em'
        );
      case 'halal':
        return h(
          'span',
          { key: flag, className: 'text-[10px] px-1.5 py-0.5 rounded bg-[#F3E8FF] text-[#7E22CE] font-medium' },
          'Halal'
        );
      case 'seafood':
        return h(
          'span',
          { key: flag, className: 'text-[10px] px-1.5 py-0.5 rounded bg-[#FFF1F2] text-[#E11D48] font-medium' },
          'Hải sản'
        );
      default:
        return h(
          'span',
          { key: flag, className: 'text-[10px] px-1.5 py-0.5 rounded bg-page text-text-muted font-medium' },
          flag
        );
    }
  };

  return h(
    'div',
    { className: `space-y-6 ${className}`, 'data-testid': 'menu-course-list' },

    // Menu title and pricing header
    h(
      'div',
      { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border-subtle' },
      h(
        'div',
        null,
        h('h3', { className: 'text-base font-bold text-text-main' }, menu.name),
        menu.description &&
          h('p', { className: 'text-xs text-text-muted mt-0.5' }, menu.description)
      ),
      // Pricing details: Owner only (AT03, AT26)
      isOwner &&
        menu.pricePerTable &&
        h(
          'div',
          { className: 'flex items-center gap-2 self-start sm:self-auto' },
          h('span', { className: 'text-xs text-text-muted' }, 'Đơn giá dự kiến:'),
          h(
            'span',
            { className: 'text-sm font-bold text-primary font-mono' },
            `${formatPrice(menu.pricePerTable)} / bàn`
          )
        )
    ),

    // Course sections
    COURSE_SECTIONS.map((section) => {
      const items = menu.items
        .filter((item) => item.courseType === section.type)
        .sort((a, b) => a.courseOrder - b.courseOrder);

      const SectionIcon = section.icon;

      return h(
        'div',
        { key: section.type, className: 'space-y-2' },

        // Section header
        h(
          'div',
          { className: 'flex items-center justify-between' },
          h(
            'div',
            { className: 'flex items-center gap-2' },
            h(SectionIcon, { className: 'w-4 h-4 text-primary shrink-0' }),
            h('h4', { className: 'text-xs font-bold uppercase tracking-wider text-text-main' }, section.label),
            h(
              'span',
              { className: 'text-[11px] text-text-muted font-mono' },
              `(${items.length} món)`
            )
          ),

          // Add item button: Owner only
          isOwner &&
            onAddItem &&
            h(
              'button',
              {
                type: 'button',
                onClick: () => onAddItem(section.type),
                className:
                  'text-xs text-primary hover:text-primary/80 font-semibold flex items-center gap-1 hover:underline',
              },
              h(Plus, { className: 'w-3 h-3' }),
              'Thêm món'
            )
        ),

        // Items list
        items.length === 0
          ? h(
              'div',
              { className: 'p-3 bg-page border border-dashed border-border-subtle rounded-control text-xs text-text-muted italic' },
              'Chưa có món nào trong phân nhóm này.'
            )
          : h(
              'div',
              { className: 'space-y-2' },
              items.map((item, idx) =>
                h(
                  'div',
                  {
                    key: item.id,
                    'data-testid': `menu-item-${item.id}`,
                    className:
                      'p-3 bg-surface border border-border-subtle rounded-control flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs',
                  },
                  h(
                    'div',
                    { className: 'space-y-1' },
                    h(
                      'div',
                      { className: 'flex items-center gap-2 flex-wrap' },
                      h('span', { className: 'text-xs font-bold text-text-muted' }, `#${idx + 1}`),
                      h('span', { className: 'text-sm font-semibold text-text-main' }, item.name),
                      item.dietaryFlags?.map(renderDietaryTag)
                    ),
                    item.allergens &&
                      h(
                        'div',
                        { className: 'flex items-center gap-1 text-[11px] text-[#B45309]' },
                        h(AlertTriangle, { className: 'w-3 h-3 shrink-0' }),
                        `Dị ứng: ${item.allergens}`
                      )
                  ),

                  // Right side: Price (Owner only) and mutation actions (Owner only)
                  h(
                    'div',
                    { className: 'flex items-center gap-3 shrink-0' },
                    // Price: strictly owner-only per AT03/AT26
                    isOwner &&
                      item.price &&
                      h(
                        'span',
                        { className: 'text-xs font-mono font-semibold text-text-main' },
                        formatPrice(item.price)
                      ),

                    // Edit & Delete: strictly owner-only
                    isOwner &&
                      (onEditItem || onDeleteItem) &&
                      h(
                        'div',
                        { className: 'flex items-center gap-1.5' },
                        onEditItem &&
                          h(
                            'button',
                            {
                              type: 'button',
                              onClick: () => onEditItem(item),
                              className:
                                'p-1 text-text-muted hover:text-primary rounded hover:bg-page',
                              title: 'Sửa món',
                            },
                            h(Edit, { className: 'w-3.5 h-3.5' })
                          ),
                        onDeleteItem &&
                          h(
                            'button',
                            {
                              type: 'button',
                              onClick: () => onDeleteItem(item.id),
                              className:
                                'p-1 text-text-muted hover:text-danger rounded hover:bg-danger-bg',
                              title: 'Xóa món',
                            },
                            h(Trash2, { className: 'w-3.5 h-3.5' })
                          )
                      )
                  )
                )
              )
            )
      );
    })
  );
};
