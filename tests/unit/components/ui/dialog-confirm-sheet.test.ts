import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModalDialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DrawerSheet } from '@/components/ui/sheet';

const hookState = vi.hoisted(() => ({ stubHooks: false }));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const wrapped = {
    ...actual,
    useRef: <T,>(init: T) => (hookState.stubHooks ? { current: init } : actual.useRef(init)),
    useId: () => (hookState.stubHooks ? 'mock-id' : actual.useId()),
    useEffect: (fn: React.EffectCallback, deps?: React.DependencyList) =>
      hookState.stubHooks ? undefined : actual.useEffect(fn, deps),
  };
  return { ...wrapped, default: wrapped };
});

function findElement(
  node: React.ReactNode,
  predicate: (el: React.ReactElement<Record<string, unknown>>) => boolean
): React.ReactElement<Record<string, unknown>> | null {
  if (!React.isValidElement(node)) return null;
  const el = node as React.ReactElement<Record<string, unknown>>;
  if (predicate(el)) return el;
  const children = el.props?.children;
  if (!children) return null;
  for (const child of React.Children.toArray(children as React.ReactNode)) {
    const match = findElement(child, predicate);
    if (match) return match;
  }
  return null;
}

describe('ModalDialog, ConfirmDialog & DrawerSheet Components', () => {
  describe('ModalDialog (src/components/ui/dialog.tsx)', () => {
    it('renders dialog with role="dialog", aria-modal="true", title, description and content', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ModalDialog,
          {
            isOpen: true,
            title: 'Thêm khách mời mới',
            description: 'Điền thông tin khách mời vào biểu mẫu',
            onClose: () => {},
          },
          React.createElement('div', { id: 'modal-body' }, 'Nội dung biểu mẫu')
        )
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Thêm khách mời mới');
      expect(html).toContain('Điền thông tin khách mời vào biểu mẫu');
      expect(html).toContain('id="modal-body"');
      expect(html).toContain('aria-label="Đóng hộp thoại"');
    });

    it('renders null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ModalDialog,
          {
            isOpen: false,
            title: 'Ẩn',
            onClose: () => {},
          },
          'hidden'
        )
      );
      expect(html).toBe('');
    });
  });

  describe('ConfirmDialog (src/components/ui/confirm-dialog.tsx)', () => {
    it('renders specific action phrasing and cancel button before confirm button', () => {
      const html = renderToStaticMarkup(
        React.createElement(ConfirmDialog, {
          isOpen: true,
          title: 'Xóa khoản chi phí',
          description: 'Bạn có chắc chắn muốn xóa khoản "Đặt cọc chụp ảnh cưới 5.000.000 ₫"?',
          confirmLabel: 'Xóa vĩnh viễn 5.000.000 ₫',
          cancelLabel: 'Giữ lại khoản này',
          variant: 'danger',
          onConfirm: () => {},
          onCancel: () => {},
        })
      );
      expect(html).toContain('Xóa khoản chi phí');
      expect(html).toContain('Xóa vĩnh viễn 5.000.000 ₫');
      expect(html).toContain('Giữ lại khoản này');
      expect(html).toContain('bg-danger');

      // Check Cancel appears before Confirm in markup to support default Cancel focus
      const cancelIndex = html.indexOf('Giữ lại khoản này');
      const confirmIndex = html.indexOf('Xóa vĩnh viễn 5.000.000 ₫');
      expect(cancelIndex).toBeLessThan(confirmIndex);
    });
  });

  describe('DrawerSheet (src/components/ui/sheet.tsx)', () => {
    it('renders side drawer with desktop width and mobile full-screen classes', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          DrawerSheet,
          {
            isOpen: true,
            title: 'Chi tiết khách mời',
            description: 'Thông tin liên lạc và người đi cùng',
            width: 'md',
            footer: React.createElement('button', null, 'Lưu'),
            onClose: () => {},
          },
          React.createElement('p', null, 'Nội dung chi tiết')
        )
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('Chi tiết khách mời');
      expect(html).toContain('md:max-w-[480px]');
      expect(html).toContain('w-full h-full');
      expect(html).toContain('Lưu');
    });

    it('does not call onClose when clicking backdrop overlay on ModalDialog or DrawerSheet', () => {
      hookState.stubHooks = true;

      try {
        const cases = [
          {
            renderTree: (onClose: () => void) =>
              (ModalDialog as React.FC<React.ComponentProps<typeof ModalDialog>>)({
                isOpen: true,
                title: 'Thêm khách mời',
                onClose,
                children: React.createElement('input', { type: 'text' }),
              }),
            closeAriaLabel: 'Đóng hộp thoại',
          },
          {
            renderTree: (onClose: () => void) =>
              (DrawerSheet as React.FC<React.ComponentProps<typeof DrawerSheet>>)({
                isOpen: true,
                title: 'Cập nhật RSVP',
                onClose,
                children: React.createElement('p', null, 'Chi tiết'),
              }),
            closeAriaLabel: 'Đóng bảng điều hướng',
          },
        ];

        for (const { renderTree, closeAriaLabel } of cases) {
          const onClose = vi.fn();
          const tree = renderTree(onClose);

          const overlay = findElement(tree, (el) => el.props.role === 'presentation');
          expect(overlay).not.toBeNull();
          const stopPropagation = vi.fn();
          (overlay!.props.onClick as (e: { stopPropagation: () => void }) => void)({
            stopPropagation,
          });
          expect(stopPropagation).toHaveBeenCalledTimes(1);
          expect(onClose).not.toHaveBeenCalled();

          const closeBtn = findElement(tree, (el) => el.props['aria-label'] === closeAriaLabel);
          expect(closeBtn).not.toBeNull();
          (closeBtn!.props.onClick as () => void)();
          expect(onClose).toHaveBeenCalledTimes(1);
        }
      } finally {
        hookState.stubHooks = false;
      }
    });
  });
});
