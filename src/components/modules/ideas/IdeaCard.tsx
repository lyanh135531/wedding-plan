'use client';

import * as React from 'react';
import { IdeaItem, IdeaStatus } from './types';
import { useRole } from '@/context/RoleContext';
import { ExternalLink, Edit2, Trash2, ArrowRightCircle, PlusCircle, Palette, Building2 } from 'lucide-react';

const h = React.createElement;

export interface IdeaCardProps {
  idea: IdeaItem;
  onCycleStatus?: (id: string) => void;
  onEdit?: (idea: IdeaItem) => void;
  onDelete?: (id: string) => void;
  onCreateTaskOrCost?: (idea: IdeaItem) => void;
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  style: 'Phong cách',
  decor: 'Trang trí',
  attire: 'Trang phục',
  other: 'Khác',
};

const STATUS_CONFIG: Record<IdeaStatus, { label: string; badgeClass: string }> = {
  reference: {
    label: 'Tham khảo',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  considering: {
    label: 'Cân nhắc',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  decided: {
    label: 'Đã chốt',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium',
  },
  discarded: {
    label: 'Đã bỏ',
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-200 line-through',
  },
};

export const IdeaCard: React.FC<IdeaCardProps> = ({
  idea,
  onCycleStatus,
  onEdit,
  onDelete,
  onCreateTaskOrCost,
  className = '',
}) => {
  let roleContext = { isOwner: true, isFamily: false, canMutate: true };
  try {
    const ctx = useRole();
    roleContext = { isOwner: ctx.isOwner, isFamily: ctx.isFamily, canMutate: ctx.canMutate };
  } catch {
    // Default to owner when rendered in isolation
  }
  const { isOwner, canMutate } = roleContext;

  const statusInfo = STATUS_CONFIG[idea.status] || STATUS_CONFIG.reference;

  return h(
    'div',
    {
      className: `group flex flex-col justify-between bg-surface rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden ${
        idea.status === 'discarded' ? 'opacity-70 bg-gray-50/50' : ''
      } ${className}`,
      'data-testid': `idea-card-${idea.id}`,
    },
    // Top media / banner
    idea.imageUrl
      ? h(
          'div',
          { className: 'relative w-full h-44 bg-gray-100 overflow-hidden' },
          h('img', {
            src: idea.imageUrl,
            alt: idea.title,
            className: 'w-full h-full object-cover transition-transform duration-300 group-hover:scale-105',
            loading: 'lazy',
          }),
          h(
            'span',
            {
              className:
                'absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-xs font-medium bg-black/60 text-white backdrop-blur-sm',
            },
            CATEGORY_LABELS[idea.category] || idea.category
          ),
          h(
            'span',
            {
              className: `absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-xs border font-medium backdrop-blur-md ${statusInfo.badgeClass}`,
            },
            statusInfo.label
          )
        )
      : h(
          'div',
          {
            className:
              'flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100 bg-gray-50/50',
          },
          h(
            'span',
            {
              className:
                'px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700',
            },
            CATEGORY_LABELS[idea.category] || idea.category
          ),
          h(
            'span',
            {
              className: `px-2 py-0.5 rounded text-xs border font-medium ${statusInfo.badgeClass}`,
            },
            statusInfo.label
          )
        ),
    // Content body
    h(
      'div',
      { className: 'p-4 flex-1 flex flex-col justify-between space-y-3' },
      h(
        'div',
        { className: 'space-y-2' },
        h(
          'h3',
          {
            className: `font-semibold text-base text-gray-900 line-clamp-2 ${
              idea.status === 'discarded' ? 'line-through text-gray-500' : ''
            }`,
          },
          idea.title
        ),
        idea.notes &&
          h(
            'p',
            { className: 'text-sm text-gray-600 line-clamp-3 leading-relaxed' },
            idea.notes
          ),
        // Swatches
        idea.colorSwatches && idea.colorSwatches.length > 0 &&
          h(
            'div',
            { className: 'flex items-center gap-1.5 pt-1' },
            h(Palette, { className: 'w-3.5 h-3.5 text-gray-400' }),
            h(
              'div',
              { className: 'flex items-center gap-1' },
              idea.colorSwatches.map((color, idx) =>
                h('span', {
                  key: idx,
                  title: color,
                  style: { backgroundColor: color },
                  className:
                    'w-4 h-4 rounded-full border border-gray-300 shadow-2xs inline-block shrink-0',
                })
              )
            )
          ),
        // Vendor info & Estimated Cost
        (idea.linkedVendorName || idea.estimatedCost !== undefined) &&
          h(
            'div',
            { className: 'pt-2 flex flex-wrap items-center justify-between text-xs text-gray-600 border-t border-gray-100 gap-2' },
            idea.linkedVendorName &&
              h(
                'div',
                { className: 'flex items-center gap-1 text-gray-700 font-medium' },
                h(Building2, { className: 'w-3.5 h-3.5 text-gray-500' }),
                idea.linkedVendorName
              ),
            idea.estimatedCost !== undefined &&
              h(
                'div',
                { className: 'font-semibold text-primary' },
                new Intl.NumberFormat('vi-VN', {
                  style: 'currency',
                  currency: 'VND',
                }).format(idea.estimatedCost)
              )
          ),
        // External link (rel="noopener noreferrer" invariant)
        idea.externalUrl &&
          h(
            'div',
            { className: 'pt-1' },
            h(
              'a',
              {
                href: idea.externalUrl,
                target: '_blank',
                rel: 'noopener noreferrer',
                className:
                  'inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline',
              },
              h(ExternalLink, { className: 'w-3 h-3' }),
              'Nguồn tham khảo ngoài'
            )
          )
      ),
      // Action Bar
      h(
        'div',
        {
          className:
            'pt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-xs',
        },
        canMutate
          ? h(
              'div',
              { className: 'flex items-center gap-1' },
              onCycleStatus &&
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => onCycleStatus(idea.id),
                    className:
                      'inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition font-medium',
                    title: 'Chuyển trạng thái kế tiếp (Tham khảo -> Cân nhắc -> Đã chốt -> Đã bỏ)',
                  },
                  h(ArrowRightCircle, { className: 'w-3.5 h-3.5 text-gray-500' }),
                  'Đổi trạng thái'
                ),
              onCreateTaskOrCost &&
                idea.status === 'decided' &&
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => onCreateTaskOrCost(idea),
                    className:
                      'inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition font-medium',
                    title: 'Tạo công việc / khoản chi có xem trước tránh trùng lặp',
                  },
                  h(PlusCircle, { className: 'w-3.5 h-3.5 text-emerald-600' }),
                  'Tạo việc / Chi phí'
                )
            )
          : h('span', { className: 'text-xs text-gray-400 italic' }, 'Chỉ xem'),
        canMutate &&
          h(
            'div',
            { className: 'flex items-center gap-1' },
            onEdit &&
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => onEdit(idea),
                  className:
                    'p-1 text-gray-500 hover:text-gray-900 rounded hover:bg-gray-100 transition',
                  title: 'Chỉnh sửa ý tưởng',
                },
                h(Edit2, { className: 'w-3.5 h-3.5' })
              ),
            onDelete &&
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => onDelete(idea.id),
                  className:
                    'p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 transition',
                  title: 'Xóa ý tưởng',
                },
                h(Trash2, { className: 'w-3.5 h-3.5' })
              )
          )
      )
    )
  );
};
