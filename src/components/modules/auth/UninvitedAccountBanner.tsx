'use client';

import * as React from 'react';
import { AlertCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const h = React.createElement;

export interface UninvitedAccountBannerProps {
  email?: string;
  onSwitchAccount?: () => void;
}

export const UninvitedAccountBanner: React.FC<UninvitedAccountBannerProps> = ({
  email = 'user@example.com',
  onSwitchAccount,
}) => {
  return h(
    'div',
    {
      role: 'alert',
      className:
        'w-full max-w-md p-6 bg-[#FEF2F2] border border-[#F87171] rounded-card shadow-sm text-center mx-auto my-4',
    },
    h(
      'div',
      { className: 'w-12 h-12 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto mb-3' },
      h(AlertCircle, { className: 'w-6 h-6' })
    ),
    h(
      'h3',
      { className: 'text-base font-semibold text-[#991B1B] mb-2' },
      'Tài khoản chưa được cấp quyền'
    ),
    h(
      'p',
      { className: 'text-sm text-[#7F1D1D] mb-4 leading-relaxed' },
      `Tài khoản `,
      h('span', { className: 'font-semibold' }, email),
      ` chưa được cấp quyền truy cập hệ thống. Vui lòng liên hệ hai chủ sở hữu đám cưới để nhận lời mời tham gia.`
    ),
    h(
      Button,
      {
        variant: 'secondary',
        onClick: onSwitchAccount || (() => {}),
        leftIcon: h(LogOut, { className: 'w-4 h-4' }),
        className: 'border-[#DC2626] text-[#DC2626] hover:bg-[#FEE2E2]',
      },
      'Đổi tài khoản khác'
    )
  );
};
