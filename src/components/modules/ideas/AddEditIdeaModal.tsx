'use client';

import * as React from 'react';
import { IdeaFormData, IdeaItem, IdeaCategory, IdeaStatus } from './types';
import { X, Sparkles, AlertCircle } from 'lucide-react';

const h = React.createElement;

export interface AddEditIdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: IdeaFormData) => void;
  initialData?: IdeaItem | null;
}

export const AddEditIdeaModal: React.FC<AddEditIdeaModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [formData, setFormData] = React.useState<IdeaFormData>(() => ({
    title: initialData?.title || '',
    category: initialData?.category || 'style',
    status: initialData?.status || 'reference',
    notes: initialData?.notes || '',
    imageUrl: initialData?.imageUrl || '',
    externalUrl: initialData?.externalUrl || '',
    colorSwatches: initialData?.colorSwatches || [],
    linkedVendorName: initialData?.linkedVendorName || '',
    estimatedCost: initialData?.estimatedCost,
  }));

  const [colorInput, setColorInput] = React.useState(() =>
    (initialData?.colorSwatches || []).join(', ')
  );
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        category: initialData.category || 'style',
        status: initialData.status || 'reference',
        notes: initialData.notes || '',
        imageUrl: initialData.imageUrl || '',
        externalUrl: initialData.externalUrl || '',
        colorSwatches: initialData.colorSwatches || [],
        linkedVendorName: initialData.linkedVendorName || '',
        estimatedCost: initialData.estimatedCost,
      });
      setColorInput((initialData.colorSwatches || []).join(', '));
    } else {
      setFormData({
        title: '',
        category: 'style',
        status: 'reference',
        notes: '',
        imageUrl: '',
        externalUrl: '',
        colorSwatches: [],
        linkedVendorName: '',
        estimatedCost: undefined,
      });
      setColorInput('');
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Vui lòng nhập tiêu đề ý tưởng');
      return;
    }

    const swatches = colorInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('#') || s.length > 0);

    onSubmit({
      ...formData,
      colorSwatches: swatches,
    });
    onClose();
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150',
      'data-testid': 'add-edit-idea-modal',
    },
    h(
      'div',
      {
        className:
          'bg-white rounded-xl shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]',
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
          h(Sparkles, { className: 'w-5 h-5 text-primary' }),
          h(
            'h2',
            { className: 'text-base font-semibold text-gray-900' },
            initialData ? 'Chỉnh sửa ý tưởng' : 'Thêm ý tưởng mới'
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
      // Body Form
      h(
        'form',
        { onSubmit: handleSubmit, className: 'p-6 overflow-y-auto space-y-4 flex-1' },
        error &&
          h(
            'div',
            {
              className:
                'p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center gap-2 border border-red-200',
            },
            h(AlertCircle, { className: 'w-4 h-4 shrink-0' }),
            error
          ),
        // Title
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Tiêu đề ý tưởng *'),
          h('input', {
            type: 'text',
            required: true,
            value: formData.title,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, title: e.target.value }),
            placeholder: 'Ví dụ: Cổng hoa mộc hoa sen trắng, Váy cưới satin...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // Category & Status
        h(
          'div',
          { className: 'grid grid-cols-2 gap-4' },
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Phân loại'),
            h(
              'select',
              {
                value: formData.category,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormData({ ...formData, category: e.target.value as IdeaCategory }),
                className:
                  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white',
              },
              h('option', { value: 'style' }, 'Phong cách'),
              h('option', { value: 'decor' }, 'Trang trí'),
              h('option', { value: 'attire' }, 'Trang phục'),
              h('option', { value: 'other' }, 'Khác')
            )
          ),
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Trạng thái'),
            h(
              'select',
              {
                value: formData.status,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormData({ ...formData, status: e.target.value as IdeaStatus }),
                className:
                  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white',
              },
              h('option', { value: 'reference' }, 'Tham khảo'),
              h('option', { value: 'considering' }, 'Cân nhắc'),
              h('option', { value: 'decided' }, 'Đã chốt'),
              h('option', { value: 'discarded' }, 'Đã bỏ')
            )
          )
        ),
        // Notes
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Ghi chú mô tả'),
          h('textarea', {
            rows: 3,
            value: formData.notes,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFormData({ ...formData, notes: e.target.value }),
            placeholder: 'Mô tả chi tiết, cảm hứng, vật liệu hoặc yêu cầu riêng...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // Image URL
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'URL Ảnh minh họa'),
          h('input', {
            type: 'url',
            value: formData.imageUrl,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, imageUrl: e.target.value }),
            placeholder: 'https://...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // External Source URL
        h(
          'div',
          { className: 'space-y-1' },
          h(
            'label',
            { className: 'block text-xs font-semibold text-gray-700' },
            'Link nguồn tham khảo bên ngoài'
          ),
          h('input', {
            type: 'url',
            value: formData.externalUrl,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, externalUrl: e.target.value }),
            placeholder: 'Pinterest, Instagram hoặc link website ngoài (chỉ mở link, không tự tải file)',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // Color Swatches
        h(
          'div',
          { className: 'space-y-1' },
          h(
            'label',
            { className: 'block text-xs font-semibold text-gray-700' },
            'Mã màu bảng palette (phân cách bằng dấu phẩy)'
          ),
          h('input', {
            type: 'text',
            value: colorInput,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setColorInput(e.target.value),
            placeholder: '#FFFFFF, #2F4F4F, #D4AF37',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono',
          })
        ),
        // Vendor & Estimated Cost
        h(
          'div',
          { className: 'grid grid-cols-2 gap-4' },
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Nhà cung cấp dự kiến'),
            h('input', {
              type: 'text',
              value: formData.linkedVendorName,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, linkedVendorName: e.target.value }),
              placeholder: 'Tên studio hoặc florist',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          ),
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Chi phí dự kiến (VNĐ)'),
            h('input', {
              type: 'number',
              min: 0,
              step: 100000,
              value: formData.estimatedCost !== undefined ? formData.estimatedCost : '',
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({
                  ...formData,
                  estimatedCost: e.target.value ? Number(e.target.value) : undefined,
                }),
              placeholder: '0',
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          )
        ),
        // Footer actions
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
            initialData ? 'Lưu thay đổi' : 'Thêm ý tưởng'
          )
        )
      )
    )
  );
};
