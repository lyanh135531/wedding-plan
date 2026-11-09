'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle, GitMerge, X } from 'lucide-react';

const h = React.createElement;

export interface DuplicateBannerProps {
  candidateCount: number;
  onOpenMergeModal: () => void;
  className?: string;
}

export const DuplicateBanner: React.FC<DuplicateBannerProps> = ({
  candidateCount,
  onOpenMergeModal,
  className = '',
}) => {
  const { isOwner } = useRole();
  const [isDismissed, setIsDismissed] = React.useState(false);

  // If not owner, dismissed, or no candidates, do not display
  if (!isOwner || isDismissed || candidateCount <= 0) {
    return null;
  }

  return h(
    'div',
    {
      role: 'alert',
      'aria-live': 'polite',
      className: `p-4 rounded-card bg-[#FFF8E1] border border-[#F6D878] text-[#854D0E] shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`,
    },
    h(
      'div',
      { className: 'flex items-start gap-3' },
      h(AlertTriangle, { className: 'w-5 h-5 text-[#854D0E] shrink-0 mt-0.5' }),
      h(
        'div',
        { className: 'space-y-0.5' },
        h(
          'p',
          { className: 'text-sm font-bold text-[#854D0E]' },
          `Phát hiện ${candidateCount} cặp khách mời có khả năng trùng lặp`
        ),
        h(
          'p',
          { className: 'text-xs text-[#854D0E]/80' },
          'Trùng tên chuẩn hóa và số điện thoại hoặc cùng nhóm quan hệ. Vui lòng rà soát và gộp hồ sơ để bảo toàn thiệp và chỗ ngồi.'
        )
      )
    ),
    h(
      'div',
      { className: 'flex items-center gap-2 self-end sm:self-center shrink-0' },
      h(
        Button,
        {
          size: 'sm',
          variant: 'primary',
          leftIcon: h(GitMerge, { className: 'w-4 h-4' }),
          onClick: onOpenMergeModal,
          className: 'bg-[#854D0E] hover:bg-[#683C0A] text-white border-none',
        },
        'Xem & Gộp hồ sơ'
      ),
      h(
        'button',
        {
          type: 'button',
          onClick: () => setIsDismissed(true),
          'aria-label': 'Bỏ qua cảnh báo',
          className:
            'p-1.5 rounded-control text-[#854D0E] hover:bg-[#854D0E]/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
        },
        h(X, { className: 'w-4 h-4' })
      )
    )
  );
};
