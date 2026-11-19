'use client';

import * as React from 'react';
import { useSaveAction } from '@/components/common/useSaveAction';
import { TableItem, TableShape } from './types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

const h = React.createElement;

export interface AddEditTableModalProps {
  isOpen: boolean;
  occupiedSeatCount?: number;
  onClose: () => void;
  onSave: (tableData: {
    id?: string;
    name: string;
    tableNumber?: string;
    shape: TableShape;
    capacity: number;
    notes?: string;
  }) => void | Promise<void>;
  editingTable?: TableItem | null;
}

export const AddEditTableModal: React.FC<AddEditTableModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTable,
  occupiedSeatCount,
}) => {
  const formId = React.useId();
  const { saving, saveError, runSave } = useSaveAction();
  const [name, setName] = React.useState('');
  const [tableNumber, setTableNumber] = React.useState('');
  const [shape, setShape] = React.useState<TableShape>('round');
  const [capacity, setCapacity] = React.useState<number>(10);
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (editingTable) {
      setName(editingTable.name);
      setTableNumber(editingTable.tableNumber || '');
      setShape(editingTable.shape);
      setCapacity(editingTable.capacity);
      setNotes(editingTable.notes || '');
    } else {
      setName('');
      setTableNumber('');
      setShape('round');
      setCapacity(10);
      setNotes('');
    }
    setError(null);
  }, [editingTable, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tên bàn không được để trống');
      return;
    }
    if (!Number.isInteger(capacity) || capacity <= 0) {
      setError('Sức chứa bàn phải là số nguyên dương lớn hơn 0');
      return;
    }

    // AT22 Guard: Cannot reduce capacity below currently seated count
    if (editingTable && capacity < (occupiedSeatCount ?? editingTable.seatedGuestIds.length)) {
      setError(
        `Không thể giảm sức chứa xuống dưới ${occupiedSeatCount ?? editingTable.seatedGuestIds.length} ghế (hiện có ${editingTable.seatedGuestIds.length} khách đã xếp vào bàn này per AT22). Vui lòng điều chuyển khách trước.`
      );
      return;
    }

    void runSave(async () => {
    await onSave({
      id: editingTable?.id,
      name: name.trim(),
      tableNumber: tableNumber.trim() || undefined,
      shape,
      capacity,
      notes: notes.trim() || undefined,
    });
    onClose();
    });
  };

  if (!isOpen) return null;

  return h(
    Dialog,
    {
      isOpen,
      onClose,
      title: editingTable ? 'Chỉnh Sửa Bàn Tiệc' : 'Thêm Bàn Tiệc Mới',
    },
    h(
      'form',
      { onSubmit: handleSubmit, className: 'space-y-4' },
      saveError && h('p', { role: 'alert', className: 'text-danger' }, saveError),
      error &&
        h(
          'div',
          {
            className:
              'p-3 bg-danger-bg border border-danger/40 rounded-control flex items-start gap-2 text-xs text-danger',
            role: 'alert',
          },
          h(AlertTriangle, { className: 'w-4 h-4 shrink-0 mt-0.5' }),
          h('span', null, error)
        ),

      // Table name
      h(
        'div',
        { className: 'space-y-1' },
        h('label', { htmlFor: `${formId}-name`, className: 'block text-xs font-semibold text-text-main' }, 'Tên bàn tiệc *'),
        h('input', {
          id: `${formId}-name`,
          className:
            'w-full h-10 px-3 border border-border-control rounded-control text-xs bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary',
          value: name,
          onChange: (e: any) => setName(e.target.value),
          placeholder: 'Ví dụ: Bàn A1 (Họ hàng nhà trai)',
          required: true,
        })
      ),

      // Table number & Shape
      h(
        'div',
        { className: 'grid grid-cols-2 gap-3' },
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-text-main' }, 'Số bàn / Ký hiệu'),
          h('input', {
            className:
              'w-full h-10 px-3 border border-border-control rounded-control text-xs bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary',
            value: tableNumber,
            onChange: (e: any) => setTableNumber(e.target.value),
            placeholder: 'A1, 01, VIP1...',
          })
        ),
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-text-main' }, 'Kiểu dáng bàn'),
          h(
            'select',
            {
              value: shape,
              onChange: (e: any) => setShape(e.target.value as TableShape),
              className:
                'w-full h-10 px-3 border border-border-control rounded-control text-xs bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary',
            },
            h('option', { value: 'round' }, 'Bàn tròn (Round)'),
            h('option', { value: 'rectangular' }, 'Bàn chữ nhật (Rectangular)')
          )
        )
      ),

      // Capacity
      h(
        'div',
        { className: 'space-y-1' },
        h(
          'div',
          { className: 'flex justify-between items-center' },
          h('label', { className: 'block text-xs font-semibold text-text-main' }, 'Sức chứa ghế *'),
          editingTable &&
            h(
              'span',
              { className: 'text-[11px] text-text-muted' },
              `Đang ngồi: ${editingTable.seatedGuestIds.length} khách`
            )
        ),
        h('input', {
          className:
            'w-full h-10 px-3 border border-border-control rounded-control text-xs bg-surface text-text-main focus:outline-none focus:ring-2 focus:ring-primary',
          type: 'number',
          min: 1,
          value: capacity,
          onChange: (e: any) => setCapacity(parseInt(e.target.value, 10) || 0),
          required: true,
        })
      ),

      // Notes (private notes)
      h(
        'div',
        { className: 'space-y-1' },
        h(
          'label',
          { className: 'block text-xs font-semibold text-text-main' },
          'Ghi chú riêng của bàn (Chỉ chủ sở hữu xem)'
        ),
        h('textarea', {
          value: notes,
          onChange: (e: any) => setNotes(e.target.value),
          rows: 2,
          placeholder: 'Ghi chú phục vụ, yêu cầu vị trí...',
          className:
            'w-full p-2 border border-border-control rounded-control text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary',
        })
      ),

      // Modal Actions
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
            disabled: saving,
            variant: 'primary',
            className: 'text-xs',
          },
          editingTable ? 'Cập nhật bàn' : 'Tạo bàn'
        )
      )
    )
  );
};
