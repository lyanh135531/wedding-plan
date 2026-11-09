'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation.js';
import { Button } from '@/components/ui/button';
import { UninvitedAccountBanner } from './UninvitedAccountBanner';

const h = React.createElement;

export interface GoogleLoginCardProps {
  isUninvited?: boolean;
  uninvitedEmail?: string;
  onLogin?: () => void;
  isLoading?: boolean;
}

export const GoogleLoginCard: React.FC<GoogleLoginCardProps> = ({
  isUninvited = false,
  uninvitedEmail = 'guest.uninvited@gmail.com',
  onLogin,
  isLoading = false,
}) => {
  let router: any = null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }
  const [showUninvited, setShowUninvited] = React.useState(isUninvited);

  React.useEffect(() => {
    setShowUninvited(isUninvited);
  }, [isUninvited]);

  const handleGoogleClick = () => {
    if (onLogin) {
      onLogin();
    } else {
      // Prototype default behavior: redirect to /setup or /overview
      router.push('/setup');
    }
  };

  return h(
    'div',
    {
      className:
        'w-full max-w-md mx-auto bg-surface rounded-card border border-border-subtle shadow-md p-8 text-center',
    },
    // Monogram / Icon
    h(
      'div',
      {
        className:
          'w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-5 text-2xl font-bold',
      },
      '💍'
    ),
    h(
      'h1',
      { className: 'text-2xl font-bold text-text-main tracking-tight mb-2' },
      'Sổ Quản Lý Đám Cưới'
    ),
    h(
      'p',
      { className: 'text-sm text-text-muted mb-8 leading-relaxed' },
      'Trang web quản lý nội bộ dành riêng cho hai chủ sở hữu và gia đình hai bên.'
    ),

    showUninvited
      ? h(UninvitedAccountBanner, {
          email: uninvitedEmail,
          onSwitchAccount: () => setShowUninvited(false),
        })
      : h(
          'div',
          { className: 'space-y-6' },
          h(
            Button,
            {
              variant: 'primary',
              size: 'lg',
              onClick: handleGoogleClick,
              loading: isLoading,
              loadingText: 'Đang xác thực tài khoản...',
              className: 'w-full h-12 text-base font-medium shadow-sm flex items-center justify-center gap-3',
            },
            h(
              'svg',
              { className: 'w-5 h-5 shrink-0', viewBox: '0 0 24 24' },
              h('path', {
                fill: '#EA4335',
                d: 'M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z',
              }),
              h('path', {
                fill: '#4285F4',
                d: 'M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z',
              }),
              h('path', {
                fill: '#FBBC05',
                d: 'M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.1-2 .4-2.7L1.6 6.4C.6 8.3 0 10.1 0 12s.6 3.7 1.6 5.6l3.7-2.9z',
              }),
              h('path', {
                fill: '#34A853',
                d: 'M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16c1.9 3.8 5.8 7 10.4 7z',
              })
            ),
            'Đăng nhập bằng Google'
          ),

          h(
            'div',
            { className: 'pt-4 border-t border-border-subtle text-xs text-text-muted space-y-1' },
            h('p', null, 'Hệ thống bảo mật nghiêm ngặt.'),
            h(
              'p',
              null,
              'Chỉ những tài khoản email được thêm vào danh sách phân quyền mới có thể truy cập dữ liệu.'
            )
          )
        )
  );
};
