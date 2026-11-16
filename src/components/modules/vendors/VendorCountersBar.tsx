'use client';

import * as React from 'react';
import { Building2, CheckCircle2, Clock, FileText } from 'lucide-react';
import { VendorDto, VendorSummaryDto } from '@/schemas/vendors';

export interface VendorCountersBarProps {
  vendors: (VendorDto | VendorSummaryDto)[];
  totalCount?: number;
}

export const VendorCountersBar: React.FC<VendorCountersBarProps> = ({
  vendors,
  totalCount,
}) => {
  const total = totalCount !== undefined ? totalCount : vendors.length;

  const researchingOrContacted = vendors.filter(
    (v) => v.status === 'researching' || v.status === 'contacted'
  ).length;

  const quotedOrShortlisted = vendors.filter(
    (v) => v.status === 'quoted' || v.status === 'shortlisted'
  ).length;

  const selectedCount = vendors.filter((v) => v.status === 'selected').length;

  const counters = [
    {
      label: 'Tổng số đối tác',
      value: total,
      sublabel: 'Tất cả các dịch vụ',
      icon: React.createElement(Building2, { className: 'w-5 h-5 text-primary', 'aria-hidden': 'true' }),
      bgColor: 'bg-[#F2F7F5]',
    },
    {
      label: 'Đang tìm hiểu / Liên hệ',
      value: researchingOrContacted,
      sublabel: 'Chờ nhận thông tin',
      icon: React.createElement(Clock, { className: 'w-5 h-5 text-text-muted', 'aria-hidden': 'true' }),
      bgColor: 'bg-[#FAF9F5]',
    },
    {
      label: 'Đã nhận báo giá',
      value: quotedOrShortlisted,
      sublabel: 'Đang cân nhắc so sánh',
      icon: React.createElement(FileText, { className: 'w-5 h-5 text-warning', 'aria-hidden': 'true' }),
      bgColor: 'bg-warning-bg',
    },
    {
      label: 'Đã chốt hợp đồng',
      value: selectedCount,
      sublabel: 'Đã liên kết ngân sách',
      icon: React.createElement(CheckCircle2, { className: 'w-5 h-5 text-success', 'aria-hidden': 'true' }),
      bgColor: 'bg-success-bg',
    },
  ];

  return React.createElement(
    'div',
    {
      className: 'grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6',
      role: 'region',
      'aria-label': 'Chỉ số tổng quan nhà cung cấp',
    },
    counters.map((c, idx) =>
      React.createElement(
        'div',
        {
          key: idx,
          className:
            'bg-surface rounded-card p-4 border border-border-subtle shadow-sm flex items-start justify-between transition-all hover:border-border-control/60',
        },
        React.createElement(
          'div',
          { className: 'space-y-1' },
          React.createElement(
            'p',
            { className: 'text-xs font-medium text-text-muted' },
            c.label
          ),
          React.createElement(
            'p',
            { className: 'text-2xl font-bold text-text-main tracking-tight' },
            c.value
          ),
          React.createElement(
            'p',
            { className: 'text-[11px] text-text-muted/80' },
            c.sublabel
          )
        ),
        React.createElement(
          'div',
          {
            className: `w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${c.bgColor}`,
          },
          c.icon
        )
      )
    )
  );
};
