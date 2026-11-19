'use client';

import * as React from 'react';
import Link from 'next/link';
import { Phone, Star, MapPin, ChevronRight } from 'lucide-react';
import { VendorDto, VendorSummaryDto } from '@/schemas/vendors';
import { StatusBadge } from '@/components/ui/status-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatVND } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, STATUS_CONFIG } from './constants';

export interface VendorCardMobileProps {
  vendors: (VendorDto | VendorSummaryDto)[];
  isOwner: boolean;
  selectedVendorIds: string[];
  onToggleSelectVendor: (id: string) => void;
}

export const VendorCardMobile: React.FC<VendorCardMobileProps> = ({
  vendors,
  isOwner,
  selectedVendorIds,
  onToggleSelectVendor,
}) => {
  return React.createElement(
    'div',
    {
      className: 'lg:hidden space-y-3',
      role: 'list',
      'aria-label': 'Danh sách thẻ nhà cung cấp',
    },
    vendors.map((vendor) => {
      const isSelected = selectedVendorIds.includes(vendor.id);
      const statusInfo = STATUS_CONFIG[vendor.status] || {
        label: vendor.status,
        variant: 'neutral' as const,
      };
      const serviceLabel =
        SERVICE_TYPE_LABELS[vendor.service_type] || vendor.service_type;

      return React.createElement(
        'div',
        {
          key: vendor.id,
          role: 'listitem',
          className: `bg-surface rounded-card p-4 border transition-all ${
            isSelected
              ? 'border-primary ring-1 ring-primary bg-primary/[0.02]'
              : 'border-border-subtle shadow-sm'
          }`,
        },
        // Header row with Name, Status, and Compare Checkbox
        React.createElement(
          'div',
          { className: 'flex items-start justify-between gap-3 mb-2.5' },
          React.createElement(
            'div',
            { className: 'space-y-1 flex-1 min-w-0' },
            React.createElement(
              Link,
              {
                href: `/vendors/${vendor.id}`,
                className:
                  'font-semibold text-base text-text-main hover:text-primary active:text-primary-hover line-clamp-1 block focus-visible:outline-2 focus-visible:outline-focus rounded',
              },
              vendor.name
            ),
            React.createElement(
              'div',
              { className: 'flex items-center gap-2 flex-wrap' },
              React.createElement(StatusBadge, {
                text: statusInfo.label,
                variant: statusInfo.variant,
                size: 'sm',
              }),
              React.createElement(
                'span',
                {
                  className:
                    'text-xs text-text-muted bg-page px-2 py-0.5 rounded border border-border-subtle',
                },
                serviceLabel
              ),
              vendor.rating &&
                React.createElement(
                  'span',
                  {
                    className:
                      'inline-flex items-center gap-0.5 text-xs text-warning font-medium',
                  },
                  React.createElement(Star, {
                    className: 'w-3 h-3 fill-warning text-warning',
                    'aria-hidden': 'true',
                  }),
                  vendor.rating
                )
            )
          ),
          // Checkbox (Owner only)
          isOwner &&
            React.createElement(
              'div',
              { className: 'shrink-0 pt-0.5' },
              React.createElement(Checkbox, {
                checked: isSelected,
                onChange: () => onToggleSelectVendor(vendor.id),
                'aria-label': `Chọn so sánh ${vendor.name}`,
              })
            )
        ),

        // Venue details or extra description
        vendor.service_type === 'venue' &&
          (vendor.capacity || vendor.table_price) &&
          React.createElement(
            'div',
            {
              className:
                'my-2.5 p-2.5 bg-page rounded border border-border-subtle text-xs space-y-1',
            },
            vendor.capacity &&
              React.createElement(
                'div',
                { className: 'flex justify-between' },
                React.createElement('span', { className: 'text-text-muted' }, 'Sức chứa tối đa:'),
                React.createElement(
                  'strong',
                  { className: 'text-text-main' },
                  `${vendor.capacity} khách`
                )
              ),
            vendor.table_price &&
              React.createElement(
                'div',
                { className: 'flex justify-between' },
                React.createElement('span', { className: 'text-text-muted' }, 'Giá bàn tham khảo:'),
                React.createElement(
                  'strong',
                  { className: 'text-primary' },
                  `${formatVND(BigInt(vendor.table_price))}/bàn`
                )
              )
          ),

        // Address snippet
        vendor.address &&
          React.createElement(
            'p',
            {
              className:
                'text-xs text-text-muted line-clamp-1 mb-2.5 flex items-center gap-1.5',
            },
            React.createElement(MapPin, {
              className: 'w-3.5 h-3.5 shrink-0 text-text-muted/70',
              'aria-hidden': 'true',
            }),
            vendor.address
          ),

        // Footer row with Phone call & View Detail
        React.createElement(
          'div',
          {
            className:
              'pt-2.5 border-t border-border-subtle/80 flex items-center justify-between text-xs',
          },
          vendor.phone
            ? React.createElement(
                'a',
                {
                  href: `tel:${vendor.phone}`,
                  className:
                    'inline-flex items-center gap-1.5 text-primary font-medium hover:underline min-h-[44px] px-1',
                },
                React.createElement(Phone, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' }),
                vendor.phone
              )
            : React.createElement(
                'span',
                { className: 'text-text-muted/60' },
                vendor.contact_person || 'Chưa có liên hệ'
              ),

          React.createElement(
            Link,
            {
              href: `/vendors/${vendor.id}`,
              className:
                'inline-flex items-center gap-1 text-primary font-semibold hover:text-primary-hover min-h-[44px] px-2 focus-visible:outline-2 focus-visible:outline-focus rounded',
            },
            'Chi tiết',
            React.createElement(ChevronRight, { className: 'w-4 h-4', 'aria-hidden': 'true' })
          )
        )
      );
    })
  );
};
