'use client';

import * as React from 'react';
import { ExternalLink, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const h = React.createElement;

export interface LinkedIdeaReference {
  id: string;
  title: string;
  category: string;
  status: string;
  notes?: string;
  estimatedCost?: number;
}

export interface LinkedIdeasTabProps {
  ideas?: LinkedIdeaReference[];
  className?: string;
}

const DEFAULT_LINKED_IDEAS: LinkedIdeaReference[] = [
  {
    id: 'idea_01',
    title: 'Phong cách Botanical Minimalist',
    category: 'Phong cách',
    status: 'Đã chốt',
    notes: 'Tông màu chủ đạo trắng - xanh lá cây đậm và điểm xuyết ánh đồng.',
    estimatedCost: 35000000,
  },
  {
    id: 'idea_02',
    title: 'Cổng hoa vòm gỗ mộc cẩm tú cầu',
    category: 'Trang trí',
    status: 'Cân nhắc',
    notes: 'Thiết kế cổng vòm kết hợp cẩm tú cầu trắng và lá bạch đàn.',
    estimatedCost: 18000000,
  },
  {
    id: 'idea_03',
    title: 'Váy cưới lụa satin tối giản A-Line',
    category: 'Trang phục',
    status: 'Đã chốt',
    notes: 'Thiết kế trễ vai nhẹ, dáng chữ A thanh lịch cho tiệc tối.',
    estimatedCost: 28000000,
  },
];

export const LinkedIdeasTab: React.FC<LinkedIdeasTabProps> = ({
  ideas = DEFAULT_LINKED_IDEAS,
  className = '',
}) => {
  return h(
    'div',
    { className: `space-y-6 ${className}` },
    // Banner explaining architectural link (UI/UX SPEC §14.2 invariant: link instead of duplicate)
    h(
      'div',
      {
        className:
          'p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start justify-between gap-4 text-xs text-emerald-900',
      },
      h(
        'div',
        { className: 'flex items-start gap-3' },
        h(Sparkles, { className: 'w-5 h-5 text-emerald-600 shrink-0 mt-0.5' }),
        h(
          'div',
          { className: 'space-y-1' },
          h(
            'p',
            { className: 'font-semibold text-sm text-emerald-950' },
            'Ý tưởng & Cảm hứng liên kết chuẩn bị (S22 → S23)'
          ),
          h(
            'p',
            { className: 'text-emerald-800 leading-relaxed' },
            'Theo nguyên tắc thiết kế hệ thống, các ý tưởng đã chốt được liên kết trực tiếp từ sổ tay Ý tưởng (S22) vào quy trình chuẩn bị này mà không nhân bản dữ liệu, đảm bảo chi phí và tiến độ luôn đồng bộ.'
          )
        )
      ),
      h(
        Link,
        {
          href: '/ideas',
          className:
            'inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold rounded-lg transition shrink-0 self-center',
        },
        'Mở trang Ý tưởng',
        h(ArrowRight, { className: 'w-3.5 h-3.5' })
      )
    ),
    // Cards list
    h(
      'div',
      { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
      ideas.map((idea) =>
        h(
          'div',
          {
            key: idea.id,
            className:
              'p-4 bg-white rounded-xl border border-gray-200 shadow-2xs hover:shadow-xs transition space-y-3 flex flex-col justify-between',
            'data-testid': `linked-idea-${idea.id}`,
          },
          h(
            'div',
            { className: 'space-y-2' },
            h(
              'div',
              { className: 'flex items-center justify-between gap-2' },
              h(
                'span',
                { className: 'text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-700 rounded' },
                idea.category
              ),
              h(
                'span',
                {
                  className: `text-xs font-semibold px-2 py-0.5 rounded ${
                    idea.status === 'Đã chốt'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`,
                },
                idea.status
              )
            ),
            h('h4', { className: 'font-semibold text-sm text-gray-900' }, idea.title),
            idea.notes &&
              h('p', { className: 'text-xs text-gray-600 line-clamp-2' }, idea.notes)
          ),
          h(
            'div',
            {
              className:
                'pt-3 border-t border-gray-100 flex items-center justify-between text-xs',
            },
            idea.estimatedCost !== undefined &&
              h(
                'span',
                { className: 'font-semibold text-primary' },
                new Intl.NumberFormat('vi-VN', {
                  style: 'currency',
                  currency: 'VND',
                }).format(idea.estimatedCost)
              ),
            h(
              Link,
              {
                href: '/ideas',
                className:
                  'inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium ml-auto',
              },
              'Xem chi tiết',
              h(ExternalLink, { className: 'w-3 h-3' })
            )
          )
        )
      )
    )
  );
};
