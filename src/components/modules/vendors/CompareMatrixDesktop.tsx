'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Check,
  X,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ExternalLink,
  Building,
  ShieldCheck,
} from 'lucide-react';
import { ComparePackageItemDto } from '@/schemas/vendors';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { formatVND } from '@/lib/utils';
import { CAPACITY_FIT_CONFIG } from './constants';

export interface CompareMatrixDesktopProps {
  packages: ComparePackageItemDto[];
  onSelectPackage: (pkg: ComparePackageItemDto) => void;
}

export const CompareMatrixDesktop: React.FC<CompareMatrixDesktopProps> = ({
  packages,
  onSelectPackage,
}) => {
  return React.createElement(
    'div',
    {
      className:
        'hidden lg:block bg-surface rounded-card border border-border-subtle shadow-sm overflow-x-auto',
    },
    React.createElement(
      'table',
      { className: 'w-full text-left border-collapse table-fixed min-w-[960px]' },
      // Column widths
      React.createElement(
        'colgroup',
        null,
        React.createElement('col', { className: 'w-48 bg-[#FAF9F5]' }),
        packages.map((pkg) =>
          React.createElement('col', { key: pkg.quote_id })
        )
      ),

      // Table Header: Package & Vendor names
      React.createElement(
        'thead',
        { className: 'border-b border-border-control/60' },
        React.createElement(
          'tr',
          null,
          React.createElement(
            'th',
            {
              scope: 'col',
              className: 'p-4 text-xs font-bold text-text-muted uppercase tracking-wider',
            },
            'Tiêu chí so sánh'
          ),
          packages.map((pkg) =>
            React.createElement(
              'th',
              {
                key: pkg.quote_id,
                scope: 'col',
                className: 'p-4 align-top border-l border-border-subtle',
              },
              React.createElement(
                'div',
                { className: 'space-y-1.5' },
                React.createElement(
                  Link,
                  {
                    href: `/vendors/${pkg.vendor_id}`,
                    className:
                      'text-xs font-semibold text-primary hover:underline line-clamp-1 flex items-center gap-1',
                  },
                  React.createElement(Building, { className: 'w-3.5 h-3.5 shrink-0', 'aria-hidden': 'true' }),
                  pkg.vendor_name
                ),
                React.createElement(
                  'div',
                  { className: 'flex items-center gap-1.5' },
                  React.createElement(
                    'h3',
                    { className: 'text-base font-bold text-text-main line-clamp-2' },
                    pkg.package_name
                  ),
                  React.createElement(
                    'span',
                    {
                      className:
                        'text-[11px] font-bold px-1.5 py-0.5 rounded bg-primary text-white shrink-0',
                    },
                    `v${pkg.version_number}`
                  )
                ),
                React.createElement(
                  'p',
                  { className: 'text-[11px] text-text-muted' },
                  `Ngày nhận: ${pkg.received_date}`
                )
              )
            )
          )
        )
      ),

      // Table Body
      React.createElement(
        'tbody',
        { className: 'divide-y divide-border-subtle text-sm text-text-main' },

        // Row 1: Sức chứa & Đánh giá quy mô (Capacity Fit)
        React.createElement(
          'tr',
          { className: 'hover:bg-[#FAF9F5]/40' },
          React.createElement(
            'th',
            { scope: 'row', className: 'p-4 font-semibold text-text-muted text-xs' },
            'Đánh giá sức chứa sảnh'
          ),
          packages.map((pkg) => {
            const fitInfo =
              CAPACITY_FIT_CONFIG[pkg.capacity_fit] ||
              CAPACITY_FIT_CONFIG.unspecified;

            return React.createElement(
              'td',
              { key: pkg.quote_id, className: 'p-4 align-top border-l border-border-subtle' },
              React.createElement(
                'div',
                { className: 'space-y-1.5' },
                React.createElement(StatusBadge, {
                  text: fitInfo.label,
                  variant: fitInfo.variant,
                  size: 'sm',
                }),
                pkg.capacity_warning &&
                  React.createElement(
                    'p',
                    { className: 'text-xs text-danger font-medium flex items-start gap-1 mt-1' },
                    React.createElement(AlertTriangle, { className: 'w-3.5 h-3.5 shrink-0 mt-0.5', 'aria-hidden': 'true' }),
                    React.createElement('span', null, pkg.capacity_warning)
                  )
              )
            );
          })
        ),

        // Row 2: Bóc tách đơn giá bàn & Phí thuê sảnh
        React.createElement(
          'tr',
          { className: 'hover:bg-[#FAF9F5]/40' },
          React.createElement(
            'th',
            { scope: 'row', className: 'p-4 font-semibold text-text-muted text-xs' },
            'Đơn giá cơ bản'
          ),
          packages.map((pkg) =>
            React.createElement(
              'td',
              { key: pkg.quote_id, className: 'p-4 align-top border-l border-border-subtle text-xs' },
              React.createElement(
                'div',
                { className: 'space-y-1' },
                React.createElement(
                  'div',
                  { className: 'flex justify-between' },
                  React.createElement('span', { className: 'text-text-muted' }, 'Giá mỗi bàn:'),
                  React.createElement(
                    'strong',
                    { className: pkg.table_price ? 'text-text-main' : 'text-warning font-semibold' },
                    pkg.table_price
                      ? formatVND(BigInt(pkg.table_price))
                      : 'Chưa báo'
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'flex justify-between' },
                  React.createElement('span', { className: 'text-text-muted' }, 'Phí thuê sảnh:'),
                  React.createElement(
                    'span',
                    { className: 'text-text-main font-medium' },
                    pkg.rental_fee
                      ? formatVND(BigInt(pkg.rental_fee))
                      : 'Đã gồm trong gói'
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'text-[11px] text-text-muted pt-0.5' },
                  pkg.fees_inclusive
                    ? '✓ Giá đã bao gồm VAT & Phí PV'
                    : '⚠ Chưa gồm 10% VAT & 5% Phí PV'
                )
              )
            )
          )
        ),

        // Row 3: Chi phí mô phỏng theo số bàn giả định
        React.createElement(
          'tr',
          { className: 'bg-[#FAF9F5]/60 hover:bg-[#FAF9F5]' },
          React.createElement(
            'th',
            { scope: 'row', className: 'p-4 font-bold text-primary text-xs' },
            'Chi phí mô phỏng (X bàn)'
          ),
          packages.map((pkg) => {
            const sim = pkg.simulation;

            return React.createElement(
              'td',
              {
                key: pkg.quote_id,
                className: 'p-4 align-top border-l border-border-subtle space-y-1 text-xs',
              },
              sim.is_missing_price
                ? // AT24: Missing price label
                  React.createElement(
                    'div',
                    { className: 'py-2 space-y-1 text-center' },
                    React.createElement(
                      'span',
                      {
                        className:
                          'text-lg font-bold text-warning bg-warning-bg px-3 py-1 rounded inline-block',
                      },
                      'Chưa báo'
                    ),
                    React.createElement(
                      'p',
                      { className: 'text-[11px] text-text-muted' },
                      'Đối tác chưa cung cấp đơn giá chính thức để tính toán'
                    )
                  )
                : React.createElement(
                    'div',
                    { className: 'space-y-1' },
                    sim.table_costs &&
                      React.createElement(
                        'div',
                        { className: 'flex justify-between' },
                        React.createElement('span', { className: 'text-text-muted' }, `Tiền ${sim.table_count} bàn:`),
                        React.createElement(
                          'span',
                          { className: 'font-medium' },
                          formatVND(BigInt(sim.table_costs))
                        )
                      ),
                    sim.estimated_vat &&
                      sim.estimated_vat !== '0' &&
                      React.createElement(
                        'div',
                        { className: 'flex justify-between text-text-muted' },
                        React.createElement('span', null, 'Dự kiến VAT (10%):'),
                        React.createElement(
                          'span',
                          null,
                          formatVND(BigInt(sim.estimated_vat))
                        )
                      ),
                    sim.estimated_service_charge &&
                      sim.estimated_service_charge !== '0' &&
                      React.createElement(
                        'div',
                        { className: 'flex justify-between text-text-muted' },
                        React.createElement('span', null, 'Dự kiến Phí PV (5%):'),
                        React.createElement(
                          'span',
                          null,
                          formatVND(BigInt(sim.estimated_service_charge))
                        )
                      ),
                    React.createElement(
                      'div',
                      {
                        className:
                          'pt-2 border-t border-border-subtle flex justify-between items-center',
                      },
                      React.createElement(
                        'span',
                        { className: 'font-bold text-text-main text-xs' },
                        'TỔNG ƯỚC TÍNH:'
                      ),
                      React.createElement(
                        'span',
                        { className: 'text-base font-bold text-primary' },
                        sim.total_estimated
                          ? formatVND(BigInt(sim.total_estimated))
                          : sim.missing_price_label
                      )
                    )
                  )
            );
          })
        ),

        // Row 4: Hạng mục bao gồm (Includes)
        React.createElement(
          'tr',
          { className: 'hover:bg-[#FAF9F5]/40' },
          React.createElement(
            'th',
            { scope: 'row', className: 'p-4 font-semibold text-text-muted text-xs' },
            'Dịch vụ bao gồm'
          ),
          packages.map((pkg) =>
            React.createElement(
              'td',
              { key: pkg.quote_id, className: 'p-4 align-top border-l border-border-subtle text-xs' },
              pkg.includes.length > 0
                ? React.createElement(
                    'ul',
                    { className: 'space-y-1.5' },
                    pkg.includes.map((inc, i) =>
                      React.createElement(
                        'li',
                        { key: i, className: 'flex items-start gap-1.5 text-text-main' },
                        React.createElement(Check, {
                          className: 'w-3.5 h-3.5 text-success shrink-0 mt-0.5',
                          'aria-hidden': 'true',
                        }),
                        React.createElement('span', null, inc)
                      )
                    )
                  )
                : React.createElement(
                    'span',
                    { className: 'text-text-muted/60 italic' },
                    'Chưa liệt kê chi tiết'
                  )
            )
          )
        ),

        // Row 5: Hạng mục loại trừ (Excludes)
        React.createElement(
          'tr',
          { className: 'hover:bg-[#FAF9F5]/40' },
          React.createElement(
            'th',
            { scope: 'row', className: 'p-4 font-semibold text-text-muted text-xs' },
            'Chưa bao gồm / Phát sinh'
          ),
          packages.map((pkg) =>
            React.createElement(
              'td',
              { key: pkg.quote_id, className: 'p-4 align-top border-l border-border-subtle text-xs' },
              pkg.excludes.length > 0
                ? React.createElement(
                    'ul',
                    { className: 'space-y-1.5' },
                    pkg.excludes.map((exc, i) =>
                      React.createElement(
                        'li',
                        { key: i, className: 'flex items-start gap-1.5 text-text-muted' },
                        React.createElement(X, {
                          className: 'w-3.5 h-3.5 text-danger shrink-0 mt-0.5',
                          'aria-hidden': 'true',
                        }),
                        React.createElement('span', null, exc)
                      )
                    )
                  )
                : React.createElement(
                    'span',
                    { className: 'text-text-muted/60 italic' },
                    'Không ghi nhận phát sinh'
                  )
            )
          )
        ),

        // Row 6: Điều kiện cọc & Cam kết hợp đồng
        React.createElement(
          'tr',
          { className: 'hover:bg-[#FAF9F5]/40' },
          React.createElement(
            'th',
            { scope: 'row', className: 'p-4 font-semibold text-text-muted text-xs' },
            'Điều kiện cọc & Hủy'
          ),
          packages.map((pkg) =>
            React.createElement(
              'td',
              {
                key: pkg.quote_id,
                className: 'p-4 align-top border-l border-border-subtle text-xs text-text-muted space-y-1',
              },
              React.createElement(
                'p',
                null,
                pkg.deposit_conditions || 'Theo điều khoản tiêu chuẩn.'
              ),
              pkg.terms &&
                React.createElement(
                  'p',
                  { className: 'text-[11px] italic pt-1 border-t border-border-subtle/60' },
                  `Điều khoản: ${pkg.terms}`
                )
            )
          )
        ),

        // Row 7: CTA Actions (Chốt gói & Tạo khoản chi FL14, AT23)
        React.createElement(
          'tr',
          { className: 'bg-[#FAF9F5]' },
          React.createElement(
            'th',
            { scope: 'row', className: 'p-4 font-bold text-text-main text-xs' },
            'Quyết định chốt gói'
          ),
          packages.map((pkg) =>
            React.createElement(
              'td',
              { key: pkg.quote_id, className: 'p-4 align-middle border-l border-border-subtle' },
              React.createElement(
                Button,
                {
                  variant: 'primary',
                  onClick: () => onSelectPackage(pkg),
                  className: 'w-full min-h-[44px] text-xs',
                  leftIcon: React.createElement(ShieldCheck, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
                },
                'Chọn gói này & Tạo khoản chi'
              )
            )
          )
        )
      )
    )
  );
};
