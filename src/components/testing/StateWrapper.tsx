'use client';

import * as React from 'react';
import { PrototypeState } from './PrototypeToolbar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ShieldAlert } from 'lucide-react';

const h = React.createElement;

export interface StateWrapperProps {
  state: PrototypeState;
  // Skeleton / loader to render when state === 'loading'
  loadingSkeleton?: React.ReactNode;
  // Empty state customisation
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  // Error state customisation
  errorTitle?: string;
  errorMessage?: string;
  errorRequestId?: string;
  onRetry?: () => void;
  // Filtered state customisation
  filteredTitle?: string;
  filteredDescription?: string;
  onClearFilter?: () => void;
  // Permission denied state customisation
  permissionDeniedMessage?: string;
  // Populated children
  children?: React.ReactNode;
}

export const StateWrapper: React.FC<StateWrapperProps> = ({
  state,
  loadingSkeleton,
  emptyTitle = 'Chưa có dữ liệu nào',
  emptyDescription = 'Hiện chưa có bản ghi nào trong mục này. Bắt đầu bằng cách tạo mới.',
  emptyActionLabel = '+ Thêm mới',
  onEmptyAction,
  errorTitle = 'Đã xảy ra lỗi khi tải dữ liệu',
  errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
  errorRequestId = 'REQ-20261106-STATE-01',
  onRetry,
  filteredTitle = 'Không tìm thấy kết quả phù hợp',
  filteredDescription = 'Không có bản ghi nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại.',
  onClearFilter,
  permissionDeniedMessage = 'Bạn không có quyền truy cập vào nội dung này. Dữ liệu chỉ dành cho Chủ sở hữu.',
  children,
}) => {
  if (state === 'loading') {
    return loadingSkeleton
      ? h(React.Fragment, null, loadingSkeleton)
      : h(
          'div',
          { className: 'w-full py-16 flex flex-col items-center justify-center space-y-4 animate-pulse', role: 'status', 'aria-label': 'Đang tải' },
          h('div', { className: 'w-12 h-12 rounded-full bg-border-subtle' }),
          h('div', { className: 'h-4 w-48 bg-border-subtle rounded' }),
          h('div', { className: 'h-3 w-32 bg-border-subtle rounded' })
        );
  }

  if (state === 'empty') {
    return h(EmptyState, {
      type: 'no_data',
      title: emptyTitle,
      description: emptyDescription,
      action: onEmptyAction
        ? {
            label: emptyActionLabel,
            onClick: onEmptyAction,
            variant: 'primary',
          }
        : undefined,
    });
  }

  if (state === 'filtered') {
    return h(EmptyState, {
      type: 'no_filter_match',
      title: filteredTitle,
      description: filteredDescription,
      action: onClearFilter
        ? {
            label: 'Xóa bộ lọc',
            onClick: onClearFilter,
            variant: 'secondary',
          }
        : undefined,
    });
  }

  if (state === 'error') {
    return h(ErrorState, {
      title: errorTitle,
      message: errorMessage,
      requestId: errorRequestId,
      onRetry: onRetry || (() => {}),
    });
  }

  if (state === 'permission_denied') {
    return h(
      'div',
      {
        className: 'min-h-[400px] bg-page flex flex-col items-center justify-center p-6 text-center',
        role: 'alert',
        'aria-live': 'polite',
      },
      h(
        'div',
        { className: 'max-w-md w-full bg-surface p-8 rounded-xl border border-border-subtle shadow-sm' },
        h(
          'div',
          { className: 'w-12 h-12 rounded-full bg-[#FEF3F2] text-[#B42318] flex items-center justify-center mx-auto mb-4' },
          h(ShieldAlert, { className: 'w-6 h-6 text-[#B42318]', 'aria-hidden': 'true' })
        ),
        h('h2', { className: 'text-xl font-semibold text-text-main mb-2 tracking-tight' }, 'Bạn không có quyền truy cập'),
        h('p', { className: 'text-sm text-text-muted mb-6 leading-relaxed' }, permissionDeniedMessage || 'Phân hệ này dành riêng cho hai chủ sở hữu. Vui lòng quay về trang Tổng quan hoặc các mục được chia sẻ.'),
        h(
          'a',
          {
            href: '/overview',
            className: 'inline-flex items-center justify-center px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:ring-offset-2',
          },
          'Quay về Tổng quan'
        )
      )
    );
  }

  // Populated state
  return h(React.Fragment, null, children);
};
