'use client';

import * as React from 'react';
import { Edit3, Trash2, Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { VendorDto } from '@/schemas/vendors';
import { STATUS_CONFIG, SERVICE_TYPE_LABELS } from './constants';

export interface VendorProfileHeaderProps {
  vendor: VendorDto;
  isOwner: boolean;
  onEditClick: () => void;
  onDeleteClick: () => void;
  onAddQuoteClick: () => void;
}

export const VendorProfileHeader: React.FC<VendorProfileHeaderProps> = ({
  vendor,
  isOwner,
  onEditClick,
  onDeleteClick,
  onAddQuoteClick,
}) => {
  const statusInfo = STATUS_CONFIG[vendor.status] || {
    label: vendor.status,
    variant: 'neutral' as const,
  };
  const serviceLabel =
    SERVICE_TYPE_LABELS[vendor.service_type] || vendor.service_type;

  return React.createElement(
    'div',
    {
      className:
        'bg-surface rounded-card p-6 border border-border-subtle shadow-sm mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4',
    },
    React.createElement(
      'div',
      { className: 'space-y-2' },
      React.createElement(
        'div',
        { className: 'flex items-center gap-3 flex-wrap' },
        React.createElement(
          'h1',
          { className: 'text-2xl md:text-3xl font-bold text-text-main tracking-tight' },
          vendor.name
        ),
        React.createElement(StatusBadge, {
          text: statusInfo.label,
          variant: statusInfo.variant,
        }),
        React.createElement(
          'span',
          {
            className:
              'text-xs text-text-muted bg-[#FAF9F5] px-2.5 py-1 rounded-full border border-border-subtle font-medium',
          },
          serviceLabel
        ),
        vendor.rating &&
          React.createElement(
            'span',
            {
              className:
                'inline-flex items-center gap-1 text-xs text-warning bg-warning-bg px-2.5 py-1 rounded-full border border-warning/30 font-semibold',
            },
            React.createElement(Star, { className: 'w-3.5 h-3.5 fill-warning text-warning', 'aria-hidden': 'true' }),
            `${vendor.rating} / 5 sao`
          )
      ),
      vendor.address &&
        React.createElement(
          'p',
          { className: 'text-sm text-text-muted' },
          vendor.address
        )
    ),

    // Action buttons (Strict AT03, AT41: Only for Owner, hidden from Family view)
    isOwner &&
      React.createElement(
        'div',
        { className: 'flex items-center gap-2.5 flex-wrap self-stretch md:self-auto shrink-0' },
        React.createElement(
          Button,
          {
            variant: 'secondary',
            onClick: onEditClick,
            className: 'min-h-[44px]',
            leftIcon: React.createElement(Edit3, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
          },
          'Sửa thông tin'
        ),
        React.createElement(
          Button,
          {
            variant: 'ghost',
            onClick: onDeleteClick,
            className: 'text-danger hover:bg-danger-bg min-h-[44px]',
            leftIcon: React.createElement(Trash2, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
          },
          'Xóa'
        ),
        React.createElement(
          Button,
          {
            variant: 'primary',
            onClick: onAddQuoteClick,
            className: 'min-h-[44px]',
            leftIcon: React.createElement(Plus, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
          },
          'Thêm báo giá'
        )
      )
  );
};
