import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { DuplicateBanner } from '@/components/modules/guests/DuplicateBanner';
import {
  MergeGuestsModal,
  DuplicatePairSummary,
} from '@/components/modules/guests/MergeGuestsModal';

const h = React.createElement;

const mockPair: DuplicatePairSummary = {
  guest_a: {
    id: '10000000-0000-4000-8000-000000000001',
    displayName: 'Nguyễn Văn Tuấn',
    side: 'groom',
    groupName: 'Bạn cấp 3',
    ageTier: 'adult',
    phone: '0912345678',
    email: 'tuan@example.com',
    address: 'Hà Nội',
    privateNotes: 'Ăn chay',
  },
  guest_b: {
    id: '10000000-0000-4000-8000-000000000002',
    displayName: 'Nguyễn Tuấn',
    side: 'groom',
    groupName: 'Bạn đại học',
    ageTier: 'adult',
    phone: '0912345678',
    email: null,
    address: null,
    privateNotes: 'Bạn học đại học',
  },
  similarity_score: 0.85,
  match_reasons: ['Tên tương đồng cao và trùng số điện thoại (0912345678)'],
};

describe('DuplicateBanner & MergeGuestsModal (AT09 UI)', () => {
  describe('DuplicateBanner', () => {
    it('renders duplicate candidate warning for Owner with action button', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(DuplicateBanner, {
            candidateCount: 2,
            onOpenMergeModal: () => {},
          })
        )
      );

      expect(html).toContain('Phát hiện 2 cặp khách mời có khả năng trùng lặp');
      expect(html).toContain('Xem &amp; Gộp hồ sơ');
    });

    it('does not render for Family View role (Owner-only operation)', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'family_view' },
          h(DuplicateBanner, {
            candidateCount: 2,
            onOpenMergeModal: () => {},
          })
        )
      );

      expect(html).toBe('');
    });

    it('does not render when candidateCount is 0', () => {
      const html = renderToStaticMarkup(
        h(
          RoleProvider,
          { initialRole: 'owner' },
          h(DuplicateBanner, {
            candidateCount: 0,
            onOpenMergeModal: () => {},
          })
        )
      );

      expect(html).toBe('');
    });
  });

  describe('MergeGuestsModal', () => {
    it('renders comparison cards for Guest A and Guest B with match reasons', () => {
      const html = renderToStaticMarkup(
        h(MergeGuestsModal, {
          isOpen: true,
          onClose: () => {},
          candidatePair: mockPair,
        })
      );

      // Modal title
      expect(html).toContain('So Sánh &amp; Gộp Trùng Hồ Sơ Khách');
      expect(html).toContain('Lý do gợi ý trùng:');
      expect(html).toContain('Tên tương đồng cao và trùng số điện thoại');

      // Card A
      expect(html).toContain('Hồ sơ A');
      expect(html).toContain('Nguyễn Văn Tuấn');
      expect(html).toContain('Giữ lại');

      // Card B
      expect(html).toContain('Hồ sơ B');
      expect(html).toContain('Nguyễn Tuấn');
      expect(html).toContain('Sẽ bị gộp');

      // Conflict resolution options
      expect(html).toContain('Giải quyết xung đột dữ liệu liên hệ');
      expect(html).toContain('0912345678');
      expect(html).toContain('tuan@example.com');

      // Explains AT09 soft delete & preservation rule
      expect(html).toContain('Quy tắc tự động bảo toàn dữ liệu (AT09):');
      expect(html).toContain('Toàn bộ thẻ phụ (sub-tags) của cả 2 hồ sơ sẽ được gộp chung.');
      expect(html).toContain('Ghi chú riêng tư của hồ sơ bị gộp sẽ được nối vào hồ sơ chính');

      // Confirm button
      expect(html).toContain('Xác nhận gộp vào Nguyễn Văn Tuấn');
    });

    it('does not render when isOpen is false or candidatePair is null', () => {
      const htmlClosed = renderToStaticMarkup(
        h(MergeGuestsModal, {
          isOpen: false,
          onClose: () => {},
          candidatePair: mockPair,
        })
      );
      expect(htmlClosed).toBe('');

      const htmlNullPair = renderToStaticMarkup(
        h(MergeGuestsModal, {
          isOpen: true,
          onClose: () => {},
          candidatePair: null,
        })
      );
      expect(htmlNullPair).toBe('');
    });
  });
});
