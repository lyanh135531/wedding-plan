import * as React from 'react';
import { redirect } from 'next/navigation';
import { GoogleLoginCard } from '@/components/modules/auth/GoogleLoginCard';
import { getCurrentSession } from '@/lib/auth/session';
import { BrandMark } from '@/components/common/BrandMark';

const h = React.createElement;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; returnTo?: string }> }) {
  const params = await searchParams;
  const returnTo = params.returnTo && /^\/[a-z]/.test(params.returnTo) && !/[\\\r\n]/.test(params.returnTo) && !params.returnTo.startsWith('/login') ? params.returnTo : '/setup';
  if (!params.error && await getCurrentSession()) redirect(returnTo);
  const initialError = params.error
    ? params.error === 'access_denied'
      ? 'Quyền đăng nhập Google chưa được chấp nhận. Vui lòng thử lại.'
      : 'Đăng nhập Google chưa hoàn tất. Vui lòng thử lại bằng tài khoản đã được cấp quyền.'
    : null;

  return h(
    'main',
    {
      className:
        'auth-page flex items-center justify-center',
    },
    h('div', { className: 'auth-panel' },
      h('section', { className: 'auth-story', 'aria-label': 'Không gian quản lý đám cưới' },
        h('div', { className: 'relative z-10 flex items-center gap-3' },
          h(BrandMark, { className: 'h-10 w-10 text-[#D4BF8F]' }),
          h('span', { className: 'font-serif text-2xl tracking-tight' }, 'Sổ Cưới'),
        ),
        h('div', { className: 'relative z-10 py-8 lg:py-16' },
          h('p', { className: 'eyebrow !text-[#D4BF8F] mb-5' }, 'Cùng viết nên ngày hạnh phúc'),
          h('h2', { className: '!font-serif !font-normal text-[34px] lg:text-[56px] !leading-[1.22] !tracking-tight max-w-md' }, 'Ngày chung đôi,', h('br'), 'được chăm chút.'),
          h('div', { className: 'h-px w-12 bg-[#D4BF8F]/60 my-6' }),
          h('p', { className: 'hidden md:block text-[13px] leading-7 text-[#D3DDD4] max-w-[310px]' }, 'Từ danh sách khách mời đến từng chi tiết nhỏ. Cùng chuẩn bị cho một ngày thật ý nghĩa.'),
        ),
        h('p', { className: 'relative z-10 text-[10px] tracking-[0.16em] uppercase text-[#B8C4B8]' }, 'Lên kế hoạch · Giữ kỷ niệm'),
      ),
      h('div', { className: 'auth-content' }, h(GoogleLoginCard, {
      initialError,
      callbackURL: returnTo,
      }))
    )
  );
}
