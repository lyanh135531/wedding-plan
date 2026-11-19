'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Check,
  X,
  AlertTriangle,
  Building,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ComparePackageItemDto } from '@/schemas/vendors';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { formatVND } from '@/lib/utils';
import { CAPACITY_FIT_CONFIG } from './constants';

export interface CompareMatrixMobileProps {
  packages: ComparePackageItemDto[];
  onSelectPackage: (pkg: ComparePackageItemDto) => void;
}

export const CompareMatrixMobile: React.FC<CompareMatrixMobileProps> = ({
  packages,
  onSelectPackage,
}) => {
  const [activeIdx, setActiveIdx] = React.useState(0);

  if (packages.length === 0) return null;

  const currentPkg = packages[activeIdx] || packages[0];
  const fitInfo =
    CAPACITY_FIT_CONFIG[currentPkg.capacity_fit] ||
    CAPACITY_FIT_CONFIG.unspecified;
  const sim = currentPkg.simulation;

  return React.createElement(
    'div',
    {
      className: 'lg:hidden space-y-4',
      role: 'region',
      'aria-label': 'Chế độ so sánh gói trên thiết bị di động',
    },
    // Tabs selector
    React.createElement(
      'div',
      { className: 'flex items-center justify-between gap-1 bg-page p-1.5 rounded-control border border-border-subtle' },
      packages.map((pkg, idx) =>
        React.createElement(
          'button',
          {
            key: pkg.quote_id,
            type: 'button',
            onClick: () => setActiveIdx(idx),
            className: `flex-1 py-2 px-2 text-xs font-semibold rounded transition-all min-h-[44px] line-clamp-1 ${
              idx === activeIdx
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-main hover:bg-black/5'
            }`,
            'aria-selected': idx === activeIdx,
          },
          `Gói ${idx + 1}: ${pkg.package_name}`
        )
      )
    ),

    // Active Package Detail Card
    React.createElement(
      'div',
      { className: 'bg-surface rounded-card p-5 border border-border-subtle shadow-sm space-y-4' },
      // Header: Vendor & Package
      React.createElement(
        'div',
        { className: 'border-b border-border-subtle pb-3 space-y-1' },
        React.createElement(
          Link,
          {
            href: `/vendors/${currentPkg.vendor_id}`,
            className:
              'text-xs font-semibold text-primary hover:underline flex items-center gap-1',
          },
          React.createElement(Building, { className: 'w-3.5 h-3.5 shrink-0', 'aria-hidden': 'true' }),
          currentPkg.vendor_name
        ),
        React.createElement(
          'div',
          { className: 'flex items-center justify-between gap-2' },
          React.createElement(
            'h3',
            { className: 'text-lg font-bold text-text-main line-clamp-1' },
            currentPkg.package_name
          ),
          React.createElement(
            'span',
            { className: 'text-xs font-bold px-2 py-0.5 rounded bg-primary text-white' },
            `v${currentPkg.version_number}`
          )
        ),
        React.createElement(
          'p',
          { className: 'text-xs text-text-muted' },
          `Ngày nhận: ${currentPkg.received_date}`
        )
      ),

      // Capacity Fit
      React.createElement(
        'div',
        { className: 'space-y-1.5' },
        React.createElement(
          'span',
          { className: 'text-xs font-semibold text-text-muted block' },
          'Sức chứa sảnh tiệc:'
        ),
        React.createElement(StatusBadge, {
          text: fitInfo.label,
          variant: fitInfo.variant,
          size: 'default',
        }),
        currentPkg.capacity_warning &&
          React.createElement(
            'p',
            { className: 'text-xs text-danger font-medium flex items-start gap-1 mt-1' },
            React.createElement(AlertTriangle, { className: 'w-3.5 h-3.5 shrink-0 mt-0.5', 'aria-hidden': 'true' }),
            React.createElement('span', null, currentPkg.capacity_warning)
          )
      ),

      // Pricing & Simulation
      React.createElement(
        'div',
        { className: 'p-3.5 bg-page rounded border border-border-control/60 space-y-2 text-xs' },
        React.createElement(
          'div',
          { className: 'flex justify-between items-center' },
          React.createElement('span', { className: 'text-text-muted' }, 'Đơn giá mỗi bàn:'),
          React.createElement(
            'strong',
            { className: currentPkg.table_price ? 'text-text-main' : 'text-warning' },
            currentPkg.table_price
              ? formatVND(BigInt(currentPkg.table_price))
              : 'Chưa báo'
          )
        ),
        React.createElement(
          'div',
          { className: 'flex justify-between items-center' },
          React.createElement('span', { className: 'text-text-muted' }, 'Phí thuê sảnh:'),
          React.createElement(
            'span',
            { className: 'font-medium' },
            currentPkg.rental_fee
              ? formatVND(BigInt(currentPkg.rental_fee))
              : 'Đã gồm trong gói'
          )
        ),
        sim.table_costs &&
          React.createElement(
            'div',
            { className: 'flex justify-between items-center text-text-muted' },
            React.createElement('span', null, `Tiền ${sim.table_count} bàn:`),
            React.createElement('span', null, formatVND(BigInt(sim.table_costs)))
          ),
        sim.estimated_vat &&
          sim.estimated_vat !== '0' &&
          React.createElement(
            'div',
            { className: 'flex justify-between items-center text-text-muted' },
            React.createElement('span', null, 'Dự kiến VAT (10%):'),
            React.createElement('span', null, formatVND(BigInt(sim.estimated_vat)))
          ),
        // Total Estimated
        React.createElement(
          'div',
          {
            className:
              'pt-2 border-t border-border-subtle flex justify-between items-center text-sm',
          },
          React.createElement(
            'span',
            { className: 'font-bold text-text-main' },
            'TỔNG ƯỚC TÍNH:'
          ),
          sim.is_missing_price
            ? React.createElement(
                'span',
                { className: 'font-bold text-warning bg-warning-bg px-2 py-0.5 rounded' },
                'Chưa báo (AT24)'
              )
            : React.createElement(
                'span',
                { className: 'font-bold text-primary text-base' },
                sim.total_estimated
                  ? formatVND(BigInt(sim.total_estimated))
                  : sim.missing_price_label
              )
        )
      ),

      // Includes & Excludes
      (currentPkg.includes.length > 0 || currentPkg.excludes.length > 0) &&
        React.createElement(
          'div',
          { className: 'space-y-3 text-xs' },
          currentPkg.includes.length > 0 &&
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement(
                'p',
                { className: 'font-semibold text-success flex items-center gap-1' },
                React.createElement(Check, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
                'Dịch vụ bao gồm:'
              ),
              React.createElement(
                'ul',
                { className: 'space-y-1 pl-4 list-disc text-text-main' },
                currentPkg.includes.map((inc, i) =>
                  React.createElement('li', { key: i }, inc)
                )
              )
            ),
          currentPkg.excludes.length > 0 &&
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement(
                'p',
                { className: 'font-semibold text-text-muted flex items-center gap-1' },
                React.createElement(X, { className: 'w-3.5 h-3.5 text-danger', 'aria-hidden': 'true' }),
                'Chưa bao gồm / Phát sinh:'
              ),
              React.createElement(
                'ul',
                { className: 'space-y-1 pl-4 list-disc text-text-muted' },
                currentPkg.excludes.map((exc, i) =>
                  React.createElement('li', { key: i }, exc)
                )
              )
            )
        ),

      // Terms & Deposit
      (currentPkg.deposit_conditions || currentPkg.terms) &&
        React.createElement(
          'div',
          { className: 'p-2.5 bg-page rounded border border-border-subtle text-xs space-y-1 text-text-muted' },
          currentPkg.deposit_conditions &&
            React.createElement(
              'p',
              null,
              React.createElement('strong', { className: 'text-text-main' }, 'Điều kiện cọc: '),
              currentPkg.deposit_conditions
            ),
          currentPkg.terms &&
            React.createElement(
              'p',
              null,
              React.createElement('strong', { className: 'text-text-main' }, 'Điều khoản: '),
              currentPkg.terms
            )
        ),

      // CTA Button
      React.createElement(
        Button,
        {
          variant: 'primary',
          onClick: () => onSelectPackage(currentPkg),
          className: 'w-full min-h-[44px]',
          leftIcon: React.createElement(ShieldCheck, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
        },
        'Chọn gói này & Tạo khoản chi'
      )
    )
  );
};
