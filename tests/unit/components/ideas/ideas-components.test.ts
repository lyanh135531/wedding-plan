import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import {
  IdeasScreen,
  IdeaCard,
  AddEditIdeaModal,
  CreateTaskOrCostPreviewModal,
  IdeaItem,
} from '@/components/modules/ideas';

const h = React.createElement;

describe('S22: Ideas & Moodboard Components Unit Tests', () => {
  const mockIdeas: IdeaItem[] = [
    {
      id: 'idea_01',
      title: 'Phong cách Botanical Minimalist',
      category: 'style',
      status: 'decided',
      notes: 'Tông màu chủ đạo trắng - xanh lá cây đậm.',
      externalUrl: 'https://pinterest.com/pin/botanical',
      colorSwatches: ['#2F4F4F', '#8FBC8F'],
      linkedVendorName: 'The Planners Studio',
      estimatedCost: 35000000,
      isShared: true,
      version: 1,
    },
    {
      id: 'idea_02',
      title: 'Ý tưởng trang trí bí mật riêng tư',
      category: 'decor',
      status: 'considering',
      notes: 'Ghi chú riêng tư chỉ chủ tiệc biết',
      isShared: false, // unshared private idea
      version: 1,
    },
    {
      id: 'idea_03',
      title: 'Váy cưới chữ A lụa satin',
      category: 'attire',
      status: 'reference',
      notes: 'Mẫu tham khảo từ lookbook',
      colorSwatches: ['#FAFAFA'],
      isShared: true,
      version: 1,
    },
  ];

  describe('Role-Aware Rendering & Access Control', () => {
    it('renders full management controls and all ideas for owner role', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(IdeasScreen, {
            initialState: 'populated',
            initialIdeas: mockIdeas,
          })
        )
      );

      // Owner sees management buttons
      expect(html).toContain('Thêm ý tưởng');
      expect(html).toContain('Đổi trạng thái');
      expect(html).toContain('Tạo việc / Chi phí');

      // Owner sees both shared and unshared ideas
      expect(html).toContain('Phong cách Botanical Minimalist');
      expect(html).toContain('Ý tưởng trang trí bí mật riêng tư');
      expect(html).toContain('Váy cưới chữ A lụa satin');
    });

    it('redacts unshared ideas and hides mutation buttons for family_view role', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'family_view' },
          h(IdeasScreen, {
            initialState: 'populated',
            initialIdeas: mockIdeas,
          })
        )
      );

      // Family view sees shared ideas
      expect(html).toContain('Phong cách Botanical Minimalist');
      expect(html).toContain('Váy cưới chữ A lụa satin');

      // Family view MUST NOT see unshared ideas (privacy invariant)
      expect(html).not.toContain('Ý tưởng trang trí bí mật riêng tư');

      // Family view MUST NOT see mutation buttons
      expect(html).not.toContain('Thêm ý tưởng');
      expect(html).not.toContain('Tạo việc / Chi phí');
      expect(html).toContain('Chỉ xem');
    });
  });

  describe('External Links & Anti-duplication Safeguards (PLAN §15 & UI/UX SPEC §7.8)', () => {
    it('renders external link with rel="noopener noreferrer" and target="_blank" (no crawler/referrer leak)', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(IdeaCard, {
            idea: mockIdeas[0],
            onCycleStatus: () => {},
            onEdit: () => {},
            onDelete: () => {},
            onCreateTaskOrCost: () => {},
          })
        )
      );

      expect(html).toContain('href="https://pinterest.com/pin/botanical"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('Nguồn tham khảo ngoài');
    });

    it('renders color swatches with correct styles and title hex tooltips', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(IdeaCard, { idea: mockIdeas[0] })
        )
      );

      expect(html).toContain('title="#2F4F4F"');
      expect(html).toContain('title="#8FBC8F"');
      expect(html).toContain('background-color:#2F4F4F');
    });

    it('renders CreateTaskOrCostPreviewModal with anti-duplication notice and source link', () => {
      const html = renderToStaticMarkup(
        h(CreateTaskOrCostPreviewModal, {
          isOpen: true,
          onClose: () => {},
          idea: mockIdeas[0],
          onConfirm: () => {},
        })
      );

      // Contains Anti-duplication safeguard banner
      expect(html).toContain('Quy tắc chống trùng lặp (PLAN §15)');
      expect(html).toContain('Ý tưởng đã chốt không tự sinh công việc hay khoản chi tự động');
      expect(html).toContain('Nguồn ý tưởng gốc:');
      expect(html).toContain('Phong cách Botanical Minimalist');
      expect(html).toContain('Xác nhận tạo &amp; Liên kết');
    });
  });

  describe('Modal and Form Elements', () => {
    it('renders AddEditIdeaModal when open with all necessary inputs', () => {
      const html = renderToStaticMarkup(
        h(AddEditIdeaModal, {
          isOpen: true,
          onClose: () => {},
          onSubmit: () => {},
          initialData: mockIdeas[0],
        })
      );

      expect(html).toContain('Chỉnh sửa ý tưởng');
      expect(html).toContain('Tiêu đề ý tưởng *');
      expect(html).toContain('Phong cách Botanical Minimalist');
      expect(html).toContain('Mã màu bảng palette');
      expect(html).toContain('Lưu thay đổi');
    });

    it('returns null when modal is not open', () => {
      const html = renderToStaticMarkup(
        h(AddEditIdeaModal, {
          isOpen: false,
          onClose: () => {},
          onSubmit: () => {},
        })
      );

      expect(html).toBe('');
    });
  });

  describe('Prototype States Handling', () => {
    it('renders empty state correctly', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(IdeasScreen, {
            initialState: 'empty',
            initialIdeas: [],
          })
        )
      );

      expect(html).toContain('Chưa có ý tưởng nào trong sổ tay.');
    });

    it('renders loading state correctly', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(IdeasScreen, {
            initialState: 'loading',
          })
        )
      );

      expect(html).toContain('animate-pulse');
    });

    it('renders error state correctly', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(IdeasScreen, {
            initialState: 'error',
          })
        )
      );

      expect(html).toContain('Đã xảy ra lỗi khi tải dữ liệu');
    });
  });
});
