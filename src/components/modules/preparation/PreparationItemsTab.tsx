'use client';

import * as React from 'react';
import { PreparationItem, ItemStatus } from './types';
import { useRole } from '@/context/RoleContext';
import {
  Package,
  CheckCircle,
  Truck,
  RotateCcw,
  Clock,
  AlertTriangle,
  Calendar,
  User,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

const h = React.createElement;

export interface PreparationItemsTabProps {
  items: PreparationItem[];
  onUpdateItem: (item: PreparationItem) => void;
  onDeleteItem: (id: string) => void;
  onAddNew: () => void;
  onEditItem: (item: PreparationItem) => void;
  className?: string;
}

const STATUS_SECTIONS: {
  key: ItemStatus;
  title: string;
  badgeClass: string;
  icon: any;
  emptyText: string;
}[] = [
  {
    key: 'not_prepared',
    title: 'Chưa chuẩn bị',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    icon: Clock,
    emptyText: 'Không có đồ dùng nào đang chờ chuẩn bị',
  },
  {
    key: 'packed',
    title: 'Đã đóng gói',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Package,
    emptyText: 'Chưa có đồ dùng đóng gói',
  },
  {
    key: 'brought',
    title: 'Đã mang tới nơi',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Truck,
    emptyText: 'Chưa có đồ nào đã mang tới sảnh',
  },
  {
    key: 'returned',
    title: 'Chờ nhận lại / Đã hoàn trả',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: RotateCcw,
    emptyText: 'Chưa có đồ dùng cần nhận lại',
  },
];

export const PreparationItemsTab: React.FC<PreparationItemsTabProps> = ({
  items,
  onUpdateItem,
  onDeleteItem,
  onAddNew,
  onEditItem,
  className = '',
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default in isolation
  }
  const { canMutate } = roleContext;

  const [filterRentalOnly, setFilterRentalOnly] = React.useState(false);

  const displayedItems = filterRentalOnly ? items.filter((i) => i.isRental) : items;

  const handleStatusChange = (item: PreparationItem, newStatus: ItemStatus) => {
    if (!canMutate) return;
    onUpdateItem({
      ...item,
      status: newStatus,
      version: (item.version || 1) + 1,
    });
  };

  const handleQuantityDelta = (item: PreparationItem, delta: number) => {
    if (!canMutate) return;
    const nextQty = Math.max(1, item.quantity + delta);
    onUpdateItem({
      ...item,
      quantity: nextQty,
      version: (item.version || 1) + 1,
    });
  };

  const rentalCount = items.filter((i) => i.isRental).length;

  return h(
    'div',
    { className: `space-y-6 ${className}` },
    // Filter & Controls Bar
    h(
      'div',
      {
        className:
          'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface rounded-xl border border-gray-200 shadow-2xs',
      },
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h(
          'button',
          {
            type: 'button',
            onClick: () => setFilterRentalOnly(!filterRentalOnly),
            className: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              filterRentalOnly
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`,
          },
          h(AlertTriangle, { className: 'w-3.5 h-3.5 text-amber-600' }),
          `Chỉ xem đồ thuê (${rentalCount})`
        ),
        h(
          'div',
          { className: 'text-xs text-gray-500 hidden sm:block' },
          `Tổng số: ${items.length} món đồ chuẩn bị`
        )
      ),
      canMutate &&
        h(
          'button',
          {
            type: 'button',
            onClick: onAddNew,
            className:
              'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition shadow-xs self-start sm:self-auto',
          },
          h(Plus, { className: 'w-4 h-4' }),
          'Thêm đồ cần chuẩn bị'
        )
    ),
    // 4 Status Columns / Sections
    h(
      'div',
      { className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4' },
      STATUS_SECTIONS.map((section) => {
        const groupItems = displayedItems.filter((i) => i.status === section.key);
        const SectionIcon = section.icon;

        return h(
          'div',
          {
            key: section.key,
            className:
              'flex flex-col bg-gray-50/70 rounded-xl border border-gray-200 p-3.5 min-h-[360px]',
            'data-testid': `items-group-${section.key}`,
          },
          // Column Header
          h(
            'div',
            { className: 'flex items-center justify-between pb-3 border-b border-gray-200/80 mb-3' },
            h(
              'div',
              { className: 'flex items-center gap-2' },
              h(SectionIcon, { className: 'w-4 h-4 text-gray-600' }),
              h(
                'h3',
                { className: 'font-semibold text-xs text-gray-800' },
                section.title
              )
            ),
            h(
              'span',
              {
                className: `px-2 py-0.5 rounded-full text-xs font-bold border ${section.badgeClass}`,
              },
              groupItems.length
            )
          ),
          // Items list in this group
          h(
            'div',
            { className: 'space-y-3 flex-1' },
            groupItems.length === 0
              ? h(
                  'div',
                  {
                    className:
                      'h-32 flex items-center justify-center text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg p-3',
                  },
                  section.emptyText
                )
              : groupItems.map((item) =>
                  h(
                    'div',
                    {
                      key: item.id,
                      className:
                        'bg-surface rounded-lg border border-gray-200 p-3 shadow-2xs hover:shadow-xs transition space-y-2.5',
                      'data-testid': `item-card-${item.id}`,
                    },
                    // Item Title & Badges
                    h(
                      'div',
                      { className: 'space-y-1' },
                      h(
                        'div',
                        { className: 'flex items-start justify-between gap-1' },
                        h(
                          'h4',
                          { className: 'font-semibold text-xs text-gray-900 leading-snug' },
                          item.title
                        ),
                        item.isRental &&
                          h(
                            'span',
                            {
                              className:
                                'px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0',
                            },
                            'Đồ thuê'
                          )
                      ),
                      // Rental warning & return deadline
                      item.isRental && item.returnDueDate &&
                        h(
                          'div',
                          {
                            className:
                              'p-2 rounded bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 space-y-1',
                          },
                          h(
                            'div',
                            { className: 'flex items-center gap-1 font-semibold text-amber-800' },
                            h(Clock, { className: 'w-3 h-3 text-amber-600' }),
                            `Hạn trả: ${new Date(item.returnDueDate).toLocaleDateString('vi-VN')}`
                          ),
                          h(
                            Link,
                            {
                              href: '/timeline',
                              className:
                                'inline-flex items-center gap-0.5 text-[10px] text-amber-700 hover:text-amber-900 underline font-medium',
                            },
                            'Xem trong checklist hậu cưới',
                            h(ChevronRight, { className: 'w-3 h-3' })
                          )
                        )
                    ),
                    // Item details (quantity, keeper, location, bring time)
                    h(
                      'div',
                      { className: 'text-[11px] text-gray-600 space-y-1 pt-1 border-t border-gray-100' },
                      // Quantity with steppers
                      h(
                        'div',
                        { className: 'flex items-center justify-between text-xs font-medium' },
                        h('span', { className: 'text-gray-500' }, 'Số lượng:'),
                        canMutate
                          ? h(
                              'div',
                              { className: 'flex items-center gap-1.5 bg-gray-50 rounded border border-gray-200 px-1 py-0.5' },
                              h(
                                'button',
                                {
                                  type: 'button',
                                  onClick: () => handleQuantityDelta(item, -1),
                                  className: 'w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-900 font-bold',
                                  title: 'Giảm số lượng',
                                },
                                '-'
                              ),
                              h('span', { className: 'font-semibold px-1 min-w-[16px] text-center' }, item.quantity),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  onClick: () => handleQuantityDelta(item, 1),
                                  className: 'w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-900 font-bold',
                                  title: 'Tăng số lượng',
                                },
                                '+'
                              )
                            )
                          : h('span', { className: 'font-bold text-gray-800' }, item.quantity)
                      ),
                      item.keeper &&
                        h(
                          'div',
                          { className: 'flex items-center gap-1.5' },
                          h(User, { className: 'w-3 h-3 text-gray-400 shrink-0' }),
                          h('span', { className: 'truncate' }, `Giữ: ${item.keeper}`)
                        ),
                      item.location &&
                        h(
                          'div',
                          { className: 'flex items-center gap-1.5' },
                          h(MapPin, { className: 'w-3 h-3 text-gray-400 shrink-0' }),
                          h('span', { className: 'truncate' }, item.location)
                        ),
                      item.bringTime &&
                        h(
                          'div',
                          { className: 'flex items-center gap-1.5 text-blue-600' },
                          h(Clock, { className: 'w-3 h-3 shrink-0' }),
                          h('span', {}, item.bringTime)
                        ),
                      item.notes &&
                        h(
                          'div',
                          { className: 'italic text-gray-500 text-[10px] pt-0.5 line-clamp-2' },
                          item.notes
                        )
                    ),
                    // Status Action Dropdown & Edit / Delete
                    canMutate &&
                      h(
                        'div',
                        {
                          className:
                            'pt-2 border-t border-gray-100 flex items-center justify-between gap-1 text-[11px]',
                        },
                        h(
                          'select',
                          {
                            value: item.status,
                            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                              handleStatusChange(item, e.target.value as ItemStatus),
                            className:
                              'text-[10px] font-medium border border-gray-300 rounded px-1.5 py-0.5 bg-gray-50 text-gray-700',
                          },
                          h('option', { value: 'not_prepared' }, 'Chưa chuẩn bị'),
                          h('option', { value: 'packed' }, 'Đã đóng gói'),
                          h('option', { value: 'brought' }, 'Đã mang tới'),
                          h('option', { value: 'returned' }, 'Chờ nhận lại')
                        ),
                        h(
                          'div',
                          { className: 'flex items-center gap-1' },
                          h(
                            'button',
                            {
                              type: 'button',
                              onClick: () => onEditItem(item),
                              className: 'p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100',
                              title: 'Chỉnh sửa đồ dùng',
                            },
                            h(Edit2, { className: 'w-3 h-3' })
                          ),
                          h(
                            'button',
                            {
                              type: 'button',
                              onClick: () => onDeleteItem(item.id),
                              className: 'p-1 text-red-400 hover:text-red-700 rounded hover:bg-red-50',
                              title: 'Xóa đồ dùng',
                            },
                            h(Trash2, { className: 'w-3 h-3' })
                          )
                        )
                      )
                  )
                )
          )
        );
      })
    )
  );
};
