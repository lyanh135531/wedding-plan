import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';

describe('Skeleton, Avatar & EmptyState Components', () => {
  describe('Skeleton (src/components/ui/skeleton.tsx)', () => {
    it('renders with animate-pulse, aria-hidden="true", and subtle shimmer token', () => {
      const html = renderToStaticMarkup(
        React.createElement(Skeleton, { variant: 'rectangular', width: 200, height: 44 })
      );
      expect(html).toContain('animate-pulse');
      expect(html).toContain('bg-[#EAE8E1]');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('width:200px');
      expect(html).toContain('height:44px');
    });

    it('supports circular and card variants', () => {
      const htmlCirc = renderToStaticMarkup(
        React.createElement(Skeleton, { variant: 'circular' })
      );
      expect(htmlCirc).toContain('rounded-full');

      const htmlCard = renderToStaticMarkup(
        React.createElement(Skeleton, { variant: 'card' })
      );
      expect(htmlCard).toContain('rounded-card');
    });
  });

  describe('Avatar (src/components/ui/avatar.tsx)', () => {
    it('generates 2-letter initials from full name when image is not present', () => {
      const html = renderToStaticMarkup(
        React.createElement(Avatar, { fallback: 'Nguyễn Văn Hoàng' })
      );
      expect(html).toContain('NH');
      expect(html).toContain('role="img"');
      expect(html).toContain('rounded-full');
    });

    it('renders image tag when src is provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(Avatar, {
          src: '/uploads/avatars/groom.jpg',
          alt: 'Ảnh chú rể',
          fallback: 'Chú Rể',
        })
      );
      expect(html).toContain('<img');
      expect(html).toContain('src="/uploads/avatars/groom.jpg"');
      expect(html).toContain('alt="Ảnh chú rể"');
    });
  });

  describe('EmptyState (src/components/ui/empty-state.tsx)', () => {
    it('renders zero state with icon, title, description, and primary CTA', () => {
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          type: 'no_data',
          title: 'Chưa có khách mời nào',
          description: 'Bắt đầu lập danh sách khách mời để gửi thiệp cưới và theo dõi phản hồi.',
          action: {
            label: '+ Thêm khách đầu tiên',
            onClick: () => {},
          },
        })
      );
      expect(html).toContain('Chưa có khách mời nào');
      expect(html).toContain('+ Thêm khách đầu tiên');
      expect(html).toContain('Bắt đầu lập danh sách khách mời');
      expect(html).toContain('border-dashed');
    });

    it('renders filter no match state with "Xóa bộ lọc" CTA', () => {
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          type: 'no_filter_match',
          title: 'Không tìm thấy kết quả',
          description: 'Không có khách mời nào khớp với bộ lọc đang chọn.',
          action: {
            label: 'Xóa bộ lọc',
            onClick: () => {},
            variant: 'secondary',
          },
        })
      );
      expect(html).toContain('Không tìm thấy kết quả');
      expect(html).toContain('Xóa bộ lọc');
    });
  });
});
