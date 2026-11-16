'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Columns3, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VendorDto, VendorSummaryDto } from '@/schemas/vendors';

export interface VendorQuickCompareBarProps {
  selectedVendorIds: string[];
  vendors: (VendorDto | VendorSummaryDto)[];
  onClearSelection: () => void;
}

export const VendorQuickCompareBar: React.FC<VendorQuickCompareBarProps> = ({
  selectedVendorIds,
  vendors,
  onClearSelection,
}) => {
  const router = useRouter();
  const count = selectedVendorIds.length;

  if (count === 0) return null;

  const canCompare = count >= 2 && count <= 4;

  const handleCompareClick = () => {
    // If vendors have selected quotes or IDs, navigate to compare
    // Pass vendors or quote IDs
    const query = selectedVendorIds.join(',');
    router.push(`/vendors/compare?vendors=${query}`);
  };

  return React.createElement(
    'aside',
    {
      className:
        'fixed bottom-16 lg:bottom-0 left-0 right-0 z-40 bg-[#1F2933] text-white py-3.5 px-4 shadow-xl border-t border-white/10 transition-transform duration-200 ease-out',
      role: 'region',
      'aria-label': 'Thanh công cụ so sánh nhanh đối tác',
    },
    React.createElement(
      'div',
      {
        className:
          'max-w-[1440px] mx-auto flex items-center justify-between gap-4 flex-wrap',
      },
      // Left info section
      React.createElement(
        'div',
        { className: 'flex items-center gap-3' },
        React.createElement(
          'div',
          {
            className:
              'w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-primary-light shrink-0',
          },
          React.createElement(Columns3, { className: 'w-5 h-5 text-[#85E0BA]', 'aria-hidden': 'true' })
        ),
        React.createElement(
          'div',
          null,
          React.createElement(
            'p',
            { className: 'text-sm font-semibold' },
            `Đã chọn ${count}/4 đối tác`
          ),
          React.createElement(
            'p',
            { className: 'text-xs text-white/70' },
            count < 2
              ? 'Chọn tối thiểu 2 đối tác để so sánh gói'
              : count > 4
              ? 'Tối đa so sánh 4 đối tác cùng lúc'
              : 'Sẵn sàng đối chiếu chi tiết báo giá & sảnh tiệc'
          )
        )
      ),

      // Right actions
      React.createElement(
        'div',
        { className: 'flex items-center gap-2.5 ml-auto' },
        React.createElement(
          Button,
          {
            variant: 'ghost',
            onClick: onClearSelection,
            className:
              'text-white/80 hover:text-white hover:bg-white/10 min-h-[44px]',
            leftIcon: React.createElement(X, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
          },
          'Bỏ chọn'
        ),
        React.createElement(
          Button,
          {
            variant: 'primary',
            onClick: handleCompareClick,
            disabled: !canCompare,
            className: 'bg-[#2E6B5A] hover:bg-[#255749] text-white min-h-[44px]',
            rightIcon: React.createElement(ArrowRight, { className: 'w-4 h-4', 'aria-hidden': 'true' }),
          },
          'So sánh ngay'
        )
      )
    )
  );
};
