'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { UninvitedAccountBanner } from './UninvitedAccountBanner';
import { authClient } from '@/lib/auth-client';
import { Alert } from '@/components/ui/alert';
import { BrandMark } from '@/components/common/BrandMark';

const h = React.createElement;

export interface GoogleLoginCardProps {
  isUninvited?: boolean;
  uninvitedEmail?: string;
  onLogin?: () => void;
  isLoading?: boolean;
  initialError?: string | null;
  callbackURL?: string;
}

export const GoogleLoginCard: React.FC<GoogleLoginCardProps> = ({
  isUninvited = false,
  uninvitedEmail = 'guest.uninvited@gmail.com',
  onLogin,
  isLoading = false,
  initialError = null,
  callbackURL = '/setup',
}) => {
  const [showUninvited, setShowUninvited] = React.useState(isUninvited);
  const [signingIn, setSigningIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(initialError);
  React.useEffect(() => { setLoginError(initialError); }, [initialError]);

  React.useEffect(() => {
    setShowUninvited(isUninvited);
  }, [isUninvited]);

  const handleGoogleClick = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setLoginError(null);
    try {
      if (onLogin) { await onLogin(); }
      else {
        const result = await authClient.signIn.social({
          provider: 'google', callbackURL, errorCallbackURL: `/login?returnTo=${encodeURIComponent(callbackURL)}`,
        });
        if (result.error) throw new Error(result.error.message || 'Không thể đăng nhập bằng Google.');
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Không thể kết nối đăng nhập. Vui lòng thử lại.');
    } finally {
      setSigningIn(false);
    }
  };

  return h(
    'div',
    {
      className:
        'auth-login-card mx-auto',
    },
    // Monogram / Icon
    h(
      'div',
      {
        className:
          'hidden md:flex w-14 h-14 rounded-full border border-accent/30 text-accent items-center justify-center mb-7',
      },
      h(BrandMark, { className: 'w-9 h-9' })
    ),
    h('p', { className: 'eyebrow mb-3' }, 'Chào mừng trở về'),
    h(
      'h1',
      { className: 'font-serif font-medium text-primary-luxury tracking-tight mb-4' },
      'Sổ Quản Lý Đám Cưới'
    ),
    h(
      'p',
      { className: 'text-[13px] text-text-muted mb-9 leading-7' },
      'Đăng nhập để tiếp tục chuẩn bị ngày cưới, cùng gia đình và những người bạn yêu thương.'
    ),

    loginError && h(Alert, { variant: 'danger', className: 'mb-4' }, loginError),
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
              loading: isLoading || signingIn,
              loadingText: 'Đang xác thực tài khoản...',
              className: 'auth-signin w-full font-medium shadow-sm flex items-center justify-center gap-3',
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
            { className: 'auth-footer pt-6 border-t border-border-subtle space-y-1' },
            h('p', { className: 'font-medium text-text-main' }, 'Một không gian riêng cho gia đình.'),
            h(
              'p',
              null,
              'Chỉ tài khoản đã được chủ sở hữu cấp quyền mới có thể truy cập sổ cưới.'
            )
          )
        )
  );
};
