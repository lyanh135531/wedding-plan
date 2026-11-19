'use client';

import * as React from 'react';
import { PreparationItem, ItemStatus } from './types';
import { X, Package, AlertCircle } from 'lucide-react';
import { QuantityInput } from '@/components/ui/quantity-input';

const h = React.createElement;

export interface AddEditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<PreparationItem, 'id' | 'version' | 'createdAt'>) => void;
  initialData?: PreparationItem | null;
}

export const AddEditItemModal: React.FC<AddEditItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [title, setTitle] = React.useState(() => initialData?.title || '');
  const [quantity, setQuantity] = React.useState(() => initialData?.quantity || 1);
  const [status, setStatus] = React.useState<ItemStatus>(
    () => initialData?.status || 'not_prepared'
  );
  const [keeper, setKeeper] = React.useState(() => initialData?.keeper || '');
  const [location, setLocation] = React.useState(() => initialData?.location || '');
  const [bringTime, setBringTime] = React.useState(() => initialData?.bringTime || '');
  const [isRental, setIsRental] = React.useState(() => initialData?.isRental || false);
  const [returnDueDate, setReturnDueDate] = React.useState(() =>
    initialData?.returnDueDate ? initialData.returnDueDate.substring(0, 10) : ''
  );
  const [notes, setNotes] = React.useState(() => initialData?.notes || '');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setQuantity(initialData.quantity || 1);
      setStatus(initialData.status || 'not_prepared');
      setKeeper(initialData.keeper || '');
      setLocation(initialData.location || '');
      setBringTime(initialData.bringTime || '');
      setIsRental(initialData.isRental || false);
      setReturnDueDate(
        initialData.returnDueDate
          ? initialData.returnDueDate.substring(0, 10)
          : ''
      );
      setNotes(initialData.notes || '');
    } else {
      setTitle('');
      setQuantity(1);
      setStatus('not_prepared');
      setKeeper('');
      setLocation('');
      setBringTime('');
      setIsRental(false);
      setReturnDueDate('');
      setNotes('');
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tên đồ dùng cần chuẩn bị');
      return;
    }

    onSubmit({
      title: title.trim(),
      quantity: Math.max(1, quantity),
      status,
      keeper: keeper.trim() || undefined,
      location: location.trim() || undefined,
      bringTime: bringTime.trim() || undefined,
      isRental,
      returnDueDate: isRental && returnDueDate ? new Date(returnDueDate).toISOString() : undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150',
      'data-testid': 'add-edit-item-modal',
    },
    h(
      'div',
      {
        className:
          'bg-surface rounded-xl shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]',
      },
      // Header
      h(
        'div',
        {
          className:
            'flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50',
        },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(Package, { className: 'w-5 h-5 text-primary' }),
          h(
            'h2',
            { className: 'text-base font-semibold text-gray-900' },
            initialData ? 'Chỉnh sửa đồ dùng chuẩn bị' : 'Thêm đồ dùng cần chuẩn bị'
          )
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: onClose,
            className: 'p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition',
          },
          h(X, { className: 'w-4 h-4' })
        )
      ),
      // Form Body
      h(
        'form',
        { onSubmit: handleSubmit, className: 'p-6 overflow-y-auto space-y-4 flex-1 text-sm' },
        error &&
          h(
            'div',
            {
              className:
                'p-3 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200',
            },
            h(AlertCircle, { className: 'w-4 h-4 shrink-0' }),
            error
          ),
        // Title
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Tên đồ dùng *'),
          h('input', {
            type: 'text',
            required: true,
            value: title,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value),
            placeholder: 'Ví dụ: Hộp nhẫn cưới, Áo dài cô dâu, Bút ký tên...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // Quantity & Status
        h(
          'div',
          { className: 'grid grid-cols-2 gap-4' },
          h(QuantityInput, {
            label: 'Số lượng',
            value: quantity,
            onChange: (val) => setQuantity(val),
            min: 1,
            max: 999,
          }),
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Trạng thái'),
            h(
              'select',
              {
                value: status,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                  setStatus(e.target.value as ItemStatus),
                className:
                  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface',
              },
              h('option', { value: 'not_prepared' }, 'Chưa chuẩn bị'),
              h('option', { value: 'packed' }, 'Đã đóng gói'),
              h('option', { value: 'brought' }, 'Đã mang tới nơi'),
              h('option', { value: 'returned' }, 'Chờ nhận lại / Đã trả')
            )
          )
        ),
        // Keeper & Location
        h(
          'div',
          { className: 'grid grid-cols-2 gap-4' },
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Người giữ / phụ trách'),
            h('input', {
              type: 'text',
              value: keeper,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setKeeper(e.target.value),
              placeholder: 'Ví dụ: Phù rể Thành',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          ),
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Nơi cất giữ'),
            h('input', {
              type: 'text',
              value: location,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLocation(e.target.value),
              placeholder: 'Ví dụ: Cốp xe, phòng cô dâu...',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          )
        ),
        // Bring time
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Thời điểm cần mang đến'),
          h('input', {
            type: 'text',
            value: bringTime,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setBringTime(e.target.value),
            placeholder: 'Ví dụ: 08:30 sáng ngày 20/11',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // Rental toggle & return deadline
        h(
          'div',
          { className: 'p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-3' },
          h(
            'label',
            { className: 'flex items-center gap-2 cursor-pointer' },
            h('input', {
              type: 'checkbox',
              checked: isRental,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setIsRental(e.target.checked),
              className: 'rounded text-amber-600 focus:ring-amber-500 w-4 h-4',
            }),
            h(
              'span',
              { className: 'text-xs font-bold text-amber-900' },
              'Đây là đồ đi thuê / mượn (cần trả lại)'
            )
          ),
          isRental &&
            h(
              'div',
              { className: 'space-y-1 pt-1' },
              h(
                'label',
                { className: 'block text-xs font-semibold text-amber-800' },
                'Hạn chót phải hoàn trả *'
              ),
              h('input', {
                type: 'date',
                required: isRental,
                value: returnDueDate,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setReturnDueDate(e.target.value),
                className:
                  'w-full px-3 py-1.5 text-xs border border-amber-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-surface',
              })
            )
        ),
        // Notes
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Ghi chú thêm'),
          h('textarea', {
            rows: 2,
            value: notes,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value),
            placeholder: 'Ghi chú cẩn thận hoặc lưu ý phụ kiện đi kèm...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // Footer buttons
        h(
          'div',
          { className: 'pt-4 border-t border-gray-100 flex items-center justify-end gap-3' },
          h(
            'button',
            {
              type: 'button',
              onClick: onClose,
              className:
                'px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition',
            },
            'Hủy'
          ),
          h(
            'button',
            {
              type: 'submit',
              className:
                'px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition shadow-xs',
            },
            initialData ? 'Lưu thay đổi' : 'Thêm đồ dùng'
          )
        )
      )
    )
  );
};
