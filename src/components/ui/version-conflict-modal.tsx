import * as React from 'react';
import { AlertTriangle, Server, Smartphone } from 'lucide-react';
import { ModalDialog } from './dialog';
import { Button } from './button';

const h = React.createElement;

export interface VersionDiffItem {
  field: string;
  serverValue: string;
  localValue: string;
}

export interface VersionConflictModalProps {
  isOpen: boolean;
  onUseServer: () => void;
  onKeepLocal: () => void;
  diffs: VersionDiffItem[];
  serverUpdatedBy?: string;
  serverUpdatedAt?: string;
  className?: string;
}

export const VersionConflictModal: React.FC<VersionConflictModalProps> = ({
  isOpen,
  onUseServer,
  onKeepLocal,
  diffs,
  serverUpdatedBy = 'Thiết bị khác',
  serverUpdatedAt,
  className,
}) => {
  return h(
    ModalDialog,
    {
      isOpen,
      onClose: () => {},
      title: 'Xung đột phiên bản dữ liệu',
      description:
        'Dữ liệu trên máy chủ đã được thay đổi trong khi bạn đang thao tác. Vui lòng chọn bản cần giữ.',
      maxWidth: 'lg',
      showCloseButton: false,
      className,
      footer: h(
        'div',
        {
          className:
            'flex flex-col sm:flex-row items-center justify-end gap-3 w-full',
        },
        h(
          Button,
          { variant: 'secondary', onClick: onUseServer, className: 'w-full sm:w-auto' },
          'Tải bản mới của máy chủ'
        ),
        h(
          Button,
          { variant: 'primary', onClick: onKeepLocal, className: 'w-full sm:w-auto' },
          'Chép lại nội dung đang nhập'
        )
      ),
    },
    h(
      'div',
      { className: 'flex flex-col gap-6' },
      h(
        'div',
        {
          className:
            'flex items-center gap-3 p-3 bg-warning-bg border border-warning/30 rounded-control text-sm text-warning',
        },
        h(AlertTriangle, { className: 'w-5 h-5 shrink-0' }),
        h(
          'span',
          null,
          'Bản mới nhất được cập nhật bởi ',
          h('strong', null, serverUpdatedBy),
          serverUpdatedAt ? ` vào lúc ${serverUpdatedAt}` : ''
        )
      ),
      h(
        'div',
        { className: 'border border-border-subtle rounded-control overflow-hidden' },
        h(
          'div',
          {
            className:
              'grid grid-cols-2 bg-page border-b border-border-subtle text-xs font-semibold text-text-muted',
          },
          h(
            'div',
            { className: 'p-3 border-r border-border-subtle flex items-center gap-1.5' },
            h(Server, { className: 'w-4 h-4 text-text-muted' }),
            h('span', null, 'Bản trên máy chủ (Server)')
          ),
          h(
            'div',
            { className: 'p-3 flex items-center gap-1.5' },
            h(Smartphone, { className: 'w-4 h-4 text-text-muted' }),
            h('span', null, 'Bản bạn đang nhập (Local Draft)')
          )
        ),
        h(
          'div',
          { className: 'divide-y divide-border-subtle text-sm' },
          diffs.map((diff, index) =>
            h(
              'div',
              { key: index, className: 'grid grid-cols-2' },
              h(
                'div',
                { className: 'p-3 border-r border-border-subtle bg-surface' },
                h('span', { className: 'text-xs text-text-muted block mb-0.5' }, diff.field),
                h('span', { className: 'text-text-main font-medium' }, diff.serverValue || '—')
              ),
              h(
                'div',
                { className: 'p-3 bg-primary/5' },
                h('span', { className: 'text-xs text-text-muted block mb-0.5' }, diff.field),
                h('span', { className: 'text-text-main font-medium' }, diff.localValue || '—')
              )
            )
          )
        )
      )
    )
  );
};
