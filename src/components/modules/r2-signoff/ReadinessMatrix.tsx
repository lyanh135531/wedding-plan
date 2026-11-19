'use client';

import * as React from 'react';
import { ReadinessDomainItem, ReadinessStatus } from './types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

const h = React.createElement;

export interface ReadinessMatrixProps {
  domains: ReadinessDomainItem[];
  className?: string;
}

const STATUS_CONFIG: Record<
  ReadinessStatus,
  { label: string; badgeClass: string; icon: any }
> = {
  ready: {
    label: 'Đã sẵn sàng',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  warning: {
    label: 'Cần rà soát',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: AlertTriangle,
  },
  not_ready: {
    label: 'Chưa đạt',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    icon: XCircle,
  },
};

export const ReadinessMatrix: React.FC<ReadinessMatrixProps> = ({
  domains,
  className = '',
}) => {
  return h(
    'div',
    { className: `space-y-4 ${className}` },
    h(
      'div',
      { className: 'flex items-center justify-between pb-1' },
      h(
        'div',
        {},
        h(
          'h3',
          { className: 'text-sm font-bold text-gray-900' },
          'Ma Trận Nghiệm Thu 8 Trụ Cột (R2 Readiness Matrix)'
        ),
        h(
          'p',
          { className: 'text-xs text-gray-500 mt-0.5' },
          'Kiểm tra tính toàn vẹn và cân đối chéo giữa Khách, Tiền, Bàn, Menu, Xe, Đồ dùng, Kịch bản & Nhân sự.'
        )
      ),
      h(
        'span',
        { className: 'text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg' },
        `${domains.filter((d) => d.status === 'ready').length} / ${domains.length} Cổng hoàn tất`
      )
    ),
    // 8 Domain Cards Grid
    h(
      'div',
      { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4' },
      domains.map((domain) => {
        const conf = STATUS_CONFIG[domain.status] || STATUS_CONFIG.ready;
        const StatusIcon = conf.icon;

        return h(
          'div',
          {
            key: domain.id,
            className:
              'bg-surface rounded-xl border border-gray-200 p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between space-y-3.5',
            'data-testid': `readiness-domain-${domain.id}`,
          },
          // Header
          h(
            'div',
            { className: 'space-y-2' },
            h(
              'div',
              { className: 'flex items-start justify-between gap-1' },
              h(
                'h4',
                { className: 'font-bold text-xs text-gray-900 leading-snug line-clamp-1' },
                domain.title
              ),
              h(
                'span',
                {
                  className: `px-1.5 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 shrink-0 ${conf.badgeClass}`,
                },
                h(StatusIcon, { className: 'w-3 h-3' }),
                conf.label
              )
            ),
            // Progress meter
            h(
              'div',
              { className: 'space-y-1' },
              h(
                'div',
                { className: 'flex items-center justify-between text-[11px]' },
                h('span', { className: 'text-gray-500' }, 'Mức độ hoàn tất:'),
                h(
                  'span',
                  { className: 'font-mono font-bold text-gray-800' },
                  `${domain.score}%`
                )
              ),
              h(
                'div',
                { className: 'w-full h-1.5 bg-gray-100 rounded-full overflow-hidden' },
                h('div', {
                  className: `h-full rounded-full transition-all duration-500 ${
                    domain.score >= 90
                      ? 'bg-emerald-500'
                      : domain.score >= 70
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`,
                  style: { width: `${domain.score}%` },
                })
              )
            ),
            // Summary text
            h(
              'p',
              { className: 'text-xs text-gray-600 line-clamp-2 leading-relaxed' },
              domain.summary
            )
          ),
          // Details list
          h(
            'div',
            { className: 'space-y-1 text-[11px] pt-2 border-t border-gray-100' },
            domain.details.map((detail, idx) =>
              h(
                'div',
                {
                  key: idx,
                  className: 'flex items-center justify-between text-gray-600',
                },
                h('span', { className: 'text-gray-500 truncate max-w-[120px]' }, detail.label),
                h(
                  'span',
                  {
                    className: `font-medium truncate ${
                      detail.isOk ? 'text-gray-800' : 'text-amber-700 font-bold'
                    }`,
                  },
                  String(detail.value)
                )
              )
            )
          ),
          // Link to source module
          h(
            'div',
            { className: 'pt-2 border-t border-gray-100' },
            h(
              Link,
              {
                href: domain.route,
                className:
                  'inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-semibold transition',
              },
              'Mở màn hình chi tiết',
              h(ChevronRight, { className: 'w-3.5 h-3.5' })
            )
          )
        );
      })
    )
  );
};
