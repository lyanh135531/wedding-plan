'use client';

import * as React from 'react';
import { Menu, MealType, MenuItem, CourseType } from './types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const h = React.createElement;

export interface AddEditMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (menuData: {
    id?: string;
    name: string;
    mealType: MealType;
    description?: string;
    pricePerTable?: number;
  }) => void;
  editingMenu?: Menu | null;
}

export const AddEditMenuModal: React.FC<AddEditMenuModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingMenu,
}) => {
  const [name, setName] = React.useState('');
  const [mealType, setMealType] = React.useState<MealType>('banquet');
  const [description, setDescription] = React.useState('');
  const [pricePerTable, setPricePerTable] = React.useState<number>(5500000);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (editingMenu) {
      setName(editingMenu.name);
      setMealType(editingMenu.mealType);
      setDescription(editingMenu.description || '');
      setPricePerTable(editingMenu.pricePerTable || 5000000);
    } else {
      setName('');
      setMealType('banquet');
      setDescription('');
      setPricePerTable(5500000);
    }
    setError(null);
  }, [editingMenu, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tên thực đơn không được để trống');
      return;
    }

    onSave({
      id: editingMenu?.id,
      name: name.trim(),
      mealType,
      description: description.trim() || undefined,
      pricePerTable,
    });
    onClose();
  };

  if (!isOpen) return null;

  return h(
    Dialog,
    {
      isOpen,
      onClose,
      title: editingMenu ? 'Chỉnh Sửa Thực Đơn' : 'Tạo Thực Đơn Mới',
    },
    h(
      'form',
      { onSubmit: handleSubmit, className: 'space-y-4 text-xs' },
      error &&
        h(
          'div',
          { className: 'p-2.5 bg-danger-bg text-danger rounded border border-danger/40' },
          error
        ),

      h(
        'div',
        { className: 'space-y-1' },
        h('label', { className: 'block font-semibold text-text-main' }, 'Tên thực đơn *'),
        h('input', {
          className:
            'w-full h-10 px-3 border border-border-control rounded-control text-xs bg-white text-text-main focus:outline-none focus:ring-2 focus:ring-primary',
          value: name,
          onChange: (e: any) => setName(e.target.value),
          placeholder: 'Ví dụ: Thực đơn Tiệc Cưới VIP 01',
          required: true,
        })
      ),

      h(
        'div',
        { className: 'grid grid-cols-2 gap-3' },
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block font-semibold text-text-main' }, 'Hình thức tiệc'),
          h(
            'select',
            {
              value: mealType,
              onChange: (e: any) => setMealType(e.target.value as MealType),
              className:
                'w-full h-10 px-3 border border-border-control rounded-control text-xs bg-white text-text-main focus:outline-none focus:ring-2 focus:ring-primary',
            },
            h('option', { value: 'banquet' }, 'Bàn tiệc truyền thống (Banquet)'),
            h('option', { value: 'buffet' }, 'Tiệc đứng (Buffet)'),
            h('option', { value: 'cocktail' }, 'Tiệc nhẹ (Cocktail)')
          )
        ),
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block font-semibold text-text-main' }, 'Đơn vị giá tham khảo / bàn (₫)'),
          h('input', {
            className:
              'w-full h-10 px-3 border border-border-control rounded-control text-xs bg-white text-text-main focus:outline-none focus:ring-2 focus:ring-primary',
            type: 'number',
            value: pricePerTable,
            onChange: (e: any) => setPricePerTable(parseInt(e.target.value, 10) || 0),
          })
        )
      ),

      h(
        'div',
        { className: 'space-y-1' },
        h('label', { className: 'block font-semibold text-text-main' }, 'Mô tả thực đơn'),
        h('textarea', {
          value: description,
          onChange: (e: any) => setDescription(e.target.value),
          rows: 2,
          placeholder: 'Ghi chú phong cách ẩm thực, tiêu chuẩn dịch vụ...',
          className:
            'w-full p-2 border border-border-control rounded-control text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary',
        })
      ),

      h(
        'div',
        { className: 'flex items-center justify-end gap-2 pt-3 border-t border-border-subtle' },
        h(
          Button,
          {
            type: 'button',
            variant: 'secondary',
            onClick: onClose,
            className: 'text-xs',
          },
          'Hủy'
        ),
        h(
          Button,
          {
            type: 'submit',
            variant: 'primary',
            className: 'text-xs',
          },
          editingMenu ? 'Cập nhật' : 'Tạo mới'
        )
      )
    )
  );
};
