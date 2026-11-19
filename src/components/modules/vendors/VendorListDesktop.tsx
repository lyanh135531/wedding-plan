'use client';

import * as React from 'react';
import Link from 'next/link';
import { Phone, Star, ArrowUpRight, Check, MapPin } from 'lucide-react';
import { VendorDto, VendorSummaryDto } from '@/schemas/vendors';
import { StatusBadge } from '@/components/ui/status-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatVND } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, STATUS_CONFIG } from './constants';

export interface VendorListDesktopProps {
  vendors: (VendorDto | VendorSummaryDto)[];
  isOwner: boolean;
  selectedVendorIds: string[];
  onToggleSelectVendor: (id: string) => void;
}

export const VendorListDesktop: React.FC<VendorListDesktopProps> = ({
  vendors,
  isOwner,
  selectedVendorIds,
  onToggleSelectVendor,
}) => {
  return React.createElement(
    'div',
    {
      className:
        'hidden lg:block bg-surface rounded-card border border-border-subtle shadow-sm overflow-hidden',
    },
    React.createElement(
      'table',
      { className: 'w-full text-left border-collapse' },
      React.createElement(
        'thead',
        { className: 'bg-page border-b border-border-subtle' },
        React.createElement(
          'tr',
          { className: 'text-xs font-semibold text-text-muted uppercase tracking-wider' },
          isOwner &&
            React.createElement(
              'th',
              { scope: 'col', className: 'py-3.5 pl-4 pr-2 w-12 text-center' },
              React.createElement(
                'span',
                { className: 'sr-only' },
                'Chọn so sánh'
              )
            ),
          React.createElement(
            'th',
            { scope: 'col', className: 'py-3.5 px-4' },
            'Nhà cung cấp / Dịch vụ'
          ),
          React.createElement(
            'th',
            { scope: 'col', className: 'py-3.5 px-4 w-36' },
            'Trạng thái'
          ),
          React.createElement(
            'th',
            { scope: 'col', className: 'py-3.5 px-4 w-48' },
            'Đầu mối liên hệ'
          ),
          React.createElement(
            'th',
            { scope: 'col', className: 'py-3.5 px-4 w-52' },
            'Quy mô / Đơn giá'
          ),
          React.createElement(
            'th',
            { scope: 'col', className: 'py-3.5 px-4 w-44 text-right' },
            'Báo giá tham khảo'
          ),
          React.createElement(
            'th',
            { scope: 'col', className: 'py-3.5 pr-4 pl-2 w-28 text-center' },
            'Hành động'
          )
        )
      ),
      React.createElement(
        'tbody',
        { className: 'divide-y divide-border-subtle text-sm text-text-main' },
        vendors.map((vendor) => {
          const isSelected = selectedVendorIds.includes(vendor.id);
          const statusInfo = STATUS_CONFIG[vendor.status] || {
            label: vendor.status,
            variant: 'neutral' as const,
          };
          const serviceLabel =
            SERVICE_TYPE_LABELS[vendor.service_type] || vendor.service_type;

          return React.createElement(
            'tr',
            {
              key: vendor.id,
              className: `transition-colors hover:bg-page/70 ${
                isSelected ? 'bg-primary/5' : ''
              }`,
            },
            // Checkbox for comparison (Owner only)
            isOwner &&
              React.createElement(
                'td',
                { className: 'py-4 pl-4 pr-2 text-center align-middle' },
                React.createElement(Checkbox, {
                  checked: isSelected,
                  onChange: () => onToggleSelectVendor(vendor.id),
                  'aria-label': `Chọn so sánh ${vendor.name}`,
                })
              ),

            // Vendor Name & Service Type
            React.createElement(
              'td',
              { className: 'py-4 px-4 align-middle' },
              React.createElement(
                'div',
                { className: 'space-y-1' },
                React.createElement(
                  Link,
                  {
                    href: `/vendors/${vendor.id}`,
                    className:
                      'font-semibold text-text-main hover:text-primary hover:underline line-clamp-1 inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-focus rounded',
                  },
                  vendor.name,
                  vendor.rating &&
                    React.createElement(
                      'span',
                      {
                        className:
                          'inline-flex items-center gap-0.5 text-xs text-warning font-normal',
                        title: `${vendor.rating} sao`,
                      },
                      React.createElement(Star, {
                        className: 'w-3.5 h-3.5 fill-warning text-warning',
                        'aria-hidden': 'true',
                      }),
                      vendor.rating
                    )
                ),
                React.createElement(
                  'div',
                  { className: 'flex items-center gap-2 text-xs text-text-muted' },
                  React.createElement(
                    'span',
                    { className: 'bg-page px-2 py-0.5 rounded border border-border-subtle' },
                    serviceLabel
                  ),
                  vendor.address &&
                    React.createElement(
                      'span',
                      { className: 'line-clamp-1 flex items-center gap-1 max-w-[200px]' },
                      React.createElement(MapPin, {
                        className: 'w-3 h-3 shrink-0 text-text-muted/60',
                        'aria-hidden': 'true',
                      }),
                      vendor.address
                    )
                )
              )
            ),

            // Status Badge
            React.createElement(
              'td',
              { className: 'py-4 px-4 align-middle' },
              React.createElement(StatusBadge, {
                text: statusInfo.label,
                variant: statusInfo.variant,
                size: 'sm',
              })
            ),

            // Contact Person & Phone
            React.createElement(
              'td',
              { className: 'py-4 px-4 align-middle' },
              React.createElement(
                'div',
                { className: 'space-y-0.5' },
                React.createElement(
                  'p',
                  { className: 'font-medium text-xs text-text-main line-clamp-1' },
                  vendor.contact_person || 'Chưa cập nhật đầu mối'
                ),
                vendor.phone
                  ? React.createElement(
                      'a',
                      {
                        href: `tel:${vendor.phone}`,
                        className:
                          'inline-flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus rounded',
                      },
                      React.createElement(Phone, { className: 'w-3 h-3', 'aria-hidden': 'true' }),
                      vendor.phone
                    )
                  : React.createElement(
                      'span',
                      { className: 'text-xs text-text-muted/60' },
                      'Chưa có SĐT'
                    )
              )
            ),

            // Venue Specs or Service Specifics
            React.createElement(
              'td',
              { className: 'py-4 px-4 align-middle text-xs' },
              vendor.service_type === 'venue'
                ? React.createElement(
                    'div',
                    { className: 'space-y-0.5' },
                    vendor.capacity &&
                      React.createElement(
                        'p',
                        { className: 'text-text-main' },
                        `Sức chứa: `,
                        React.createElement('strong', null, `${vendor.capacity} khách`)
                      ),
                    vendor.table_price
                      ? React.createElement(
                          'p',
                          { className: 'text-text-muted' },
                          `${formatVND(BigInt(vendor.table_price))}/bàn`
                        )
                      : React.createElement(
                          'p',
                          { className: 'text-warning font-medium' },
                          'Chưa báo giá bàn'
                        )
                  )
                : React.createElement(
                    'span',
                    { className: 'text-text-muted/70 italic' },
                    'Theo gói thỏa thuận'
                  )
            ),

            // Reference Price / Quote
            React.createElement(
              'td',
              { className: 'py-4 px-4 align-middle text-right font-medium' },
              vendor.service_type === 'venue' && vendor.rental_fee
                ? React.createElement(
                    'div',
                    { className: 'space-y-0.5' },
                    React.createElement(
                      'span',
                      { className: 'text-xs text-text-muted block' },
                      'Phí thuê sảnh'
                    ),
                    React.createElement(
                      'span',
                      { className: 'text-sm font-semibold text-text-main' },
                      formatVND(BigInt(vendor.rental_fee))
                    )
                  )
                : vendor.table_price
                ? React.createElement(
                    'span',
                    { className: 'text-sm text-text-main' },
                    formatVND(BigInt(vendor.table_price))
                  )
                : React.createElement(
                    'span',
                    { className: 'text-xs text-warning font-semibold' },
                    'Chưa báo'
                  )
            ),

            // Action
            React.createElement(
              'td',
              { className: 'py-4 pr-4 pl-2 align-middle text-center' },
              React.createElement(
                Link,
                {
                  href: `/vendors/${vendor.id}`,
                  className:
                    'inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline p-1.5 focus-visible:outline-2 focus-visible:outline-focus rounded',
                },
                'Xem hồ sơ',
                React.createElement(ArrowUpRight, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' })
              )
            )
          );
        })
      )
    )
  );
};
