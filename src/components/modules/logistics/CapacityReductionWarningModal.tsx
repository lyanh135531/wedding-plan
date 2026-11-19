'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

const h = React.createElement;

export interface CapacityReductionWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCount: number;
  requestedCapacity: number;
}

export const CapacityReductionWarningModal: React.FC<CapacityReductionWarningModalProps> = ({
  isOpen,
  onClose,
  currentCount,
  requestedCapacity,
}) => {
  if (!isOpen) return null;

  return h(
    Dialog,
    {
      isOpen,
      onClose,
      title: 'Chặn Giảm Sức Chứa Dưới Số Lượng Đã Phân Bổ (AT22)',
    },
    h(
      'div',
      { className: 'space-y-4 text-xs' },
      h(
        'div',
        {
          className:
            'p-3.5 bg-danger-bg border border-danger/40 rounded-control flex items-start gap-2.5 text-danger font-medium',
          role: 'alert',
        },
        h(ShieldAlert, { className: 'w-5 h-5 shrink-0 mt-0.5' }),
        h(
          'div',
          null,
          h('p', { className: 'font-bold text-sm' }, 'Thao tác bị từ chối theo quy tắc bảo toàn (AT22)'),
          h(
            'p',
            { className: 'mt-1 leading-relaxed' },
            `Bạn đang yêu cầu giảm sức chứa xuống `,
            h('strong', null, `${requestedCapacity} chỗ`),
            `, nhưng hiện tại đã có `,
            h('strong', null, `${currentCount} khách`),
            ` được phân bổ vào danh sách này. Hệ thống không cho phép giảm sức chứa khi chưa điều chuyển hành khách.`
          )
        )
      ),

      h(
        'div',
        { className: 'bg-page p-3 rounded border border-border-subtle space-y-1 text-text-muted' },
        h('p', { className: 'font-semibold text-text-main' }, 'Hướng xử lý hợp lệ:'),
        h('p', null, '1. Gỡ hoặc chuyển bớt khách sang các phòng hoặc chuyến xe khác còn trống.'),
        h('p', null, '2. Sau khi số khách phân bổ ≤ sức chứa mới, thực hiện lại thao tác cập nhật.')
      ),

      h(
        'div',
        { className: 'flex justify-end pt-3 border-t border-border-subtle' },
        h(
          Button,
          {
            type: 'button',
            variant: 'primary',
            onClick: onClose,
            className: 'text-xs',
          },
          'Đã hiểu và quay lại'
        )
      )
    )
  );
};
