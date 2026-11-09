'use client';

import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';

const h = React.createElement;

export interface StarterCategory {
  id: string;
  name: string;
  description: string;
  selected: boolean;
}

export const DEFAULT_STARTER_CATEGORIES: StarterCategory[] = [
  { id: 'venue', name: 'Tiệc cưới & Địa điểm', description: 'Đặt sảnh tiệc, thực đơn món ăn, đồ uống', selected: true },
  { id: 'attire', name: 'Trang phục & Trang điểm', description: 'Váy cưới, vest chú rể, áo dài, make-up', selected: true },
  { id: 'photo', name: 'Chụp ảnh & Quay phim', description: 'Album pre-wedding, phóng sự ngày cưới', selected: true },
  { id: 'decor', name: 'Trang trí gia tiên & Rạp cưới', description: 'Hoa tươi, phông nền, cổng hoa, bàn thờ gia tiên', selected: true },
  { id: 'jewelry', name: 'Nhẫn cưới & Trang sức', description: 'Cặp nhẫn cưới, quà tặng vàng đôi bên', selected: true },
  { id: 'cards', name: 'Thiệp mời & Quà cảm ơn', description: 'In ấn thiệp mời, thiệp điện tử, quà đáp lễ', selected: true },
];

export interface StepCategoryPreviewProps {
  categories: StarterCategory[];
  onToggleCategory: (id: string, selected: boolean) => void;
}

export const StepCategoryPreview: React.FC<StepCategoryPreviewProps> = ({
  categories,
  onToggleCategory,
}) => {
  return h(
    'div',
    { className: 'space-y-4 text-left' },
    h(
      'div',
      { className: 'mb-4' },
      h('h2', { className: 'text-lg font-semibold text-text-main' }, 'Bước 3: Khởi tạo danh mục mẫu'),
      h(
        'p',
        { className: 'text-sm text-text-muted mt-1' },
        'Chọn các hạng mục chi tiêu cơ bản để hệ thống tạo sẵn khung quản lý. Giá tiền và khách mời sẽ để trống hoàn toàn.'
      )
    ),

    h(
      'div',
      { className: 'space-y-2.5 max-h-[280px] overflow-y-auto pr-1' },
      categories.map((cat) =>
        h(
          'div',
          {
            key: cat.id,
            className:
              'p-3 bg-surface border border-border-subtle rounded-control hover:border-border-control transition-colors flex items-start justify-between gap-3',
          },
          h(
            'div',
            { className: 'flex-1' },
            h(Checkbox, {
              checked: cat.selected,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => onToggleCategory(cat.id, e.target.checked),
              label: cat.name,
            }),
            h('p', { className: 'text-xs text-text-muted mt-0.5 ml-7' }, cat.description)
          )
        )
      )
    )
  );
};
