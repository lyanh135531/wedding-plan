'use client';

import * as React from 'react';
import { CreateSnapshotFormData } from './types';
import { X, ShieldCheck, Camera, AlertCircle, FileCheck, Lock } from 'lucide-react';

const h = React.createElement;

export interface CreateSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSnapshotFormData) => void;
  nextVersionSuggestion?: string;
  guestCount?: number;
  seatingCount?: number;
  mealCount?: number;
}

export const CreateSnapshotModal: React.FC<CreateSnapshotModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  nextVersionSuggestion = 'R2-v1.1',
  guestCount = 180,
  seatingCount = 180,
  mealCount = 180,
}) => {
  const [version, setVersion] = React.useState(nextVersionSuggestion);
  const [notes, setNotes] = React.useState('');
  const [handedOverTo, setHandedOverTo] = React.useState('');
  const [handoverChannel, setHandoverChannel] = React.useState('Ghi nhận thủ công tại sảnh');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setVersion(nextVersionSuggestion);
    setNotes('');
    setHandedOverTo('');
    setError('');
  }, [nextVersionSuggestion, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!version.trim()) {
      setError('Vui lòng nhập tên phiên bản snapshot');
      return;
    }

    onSubmit({
      version: version.trim(),
      notes: notes.trim() || undefined,
      handedOverTo: handedOverTo.trim() || undefined,
      handoverChannel: handoverChannel.trim() || undefined,
    });
    onClose();
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150',
      'data-testid': 'create-snapshot-modal',
    },
    h(
      'div',
      {
        className:
          'bg-surface rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]',
      },
      // Header
      h(
        'div',
        {
          className:
            'flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-emerald-50/50',
        },
        h(
          'div',
          { className: 'flex items-center gap-2 text-emerald-900' },
          h(Camera, { className: 'w-5 h-5 text-emerald-600' }),
          h(
            'h2',
            { className: 'text-base font-semibold' },
            'Tạo Bản Chốt Cột Mốc R2 (Snapshot)'
          )
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: onClose,
            className: 'p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition',
          },
          h(X, { className: 'w-4 h-4' })
        )
      ),
      // Invariant Banner: Immutable snapshot
      h(
        'div',
        {
          className:
            'px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2.5 text-xs text-amber-900',
        },
        h(Lock, { className: 'w-4 h-4 text-amber-700 shrink-0 mt-0.5' }),
        h(
          'div',
          {},
          h('p', { className: 'font-semibold' }, 'Quy tắc tính bất biến của Snapshot (PLAN §24.1):'),
          h(
            'p',
            { className: 'mt-0.5 text-amber-800 leading-normal' },
            'Bản chốt R2 sau khi tạo là bất biến (immutable), dùng làm bằng chứng đối chiếu chênh lệch (delta) cho nhà hàng và ban tổ chức. Các thay đổi sau thời điểm này sẽ được tính là phát sinh.'
          )
        )
      ),
      // Form Body
      h(
        'form',
        { onSubmit: handleSubmit, className: 'p-6 overflow-y-auto space-y-4 flex-1 text-sm' },
        error &&
          h(
            'div',
            {
              className:
                'p-3 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200',
            },
            h(AlertCircle, { className: 'w-4 h-4 shrink-0' }),
            error
          ),
        // Balance Metrics summary box
        h(
          'div',
          { className: 'p-3 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-3 gap-2 text-center' },
          h(
            'div',
            {},
            h('div', { className: 'text-xs text-gray-500' }, 'Khách xác nhận'),
            h('div', { className: 'font-bold text-gray-900 text-sm' }, `${guestCount} khách`)
          ),
          h(
            'div',
            {},
            h('div', { className: 'text-xs text-gray-500' }, 'Chỗ ngồi xếp bàn'),
            h('div', { className: 'font-bold text-gray-900 text-sm' }, `${seatingCount} chỗ`)
          ),
          h(
            'div',
            {},
            h('div', { className: 'text-xs text-gray-500' }, 'Suất ăn đặt'),
            h('div', { className: 'font-bold text-gray-900 text-sm' }, `${mealCount} suất`)
          )
        ),
        // Version name
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Tên mã phiên bản *'),
          h('input', {
            type: 'text',
            required: true,
            value: version,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setVersion(e.target.value),
            placeholder: 'Ví dụ: R2-v1.0, R2-Final...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono',
          })
        ),
        // Notes
        h(
          'div',
          { className: 'space-y-1' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Ghi chú bản chốt'),
          h('textarea', {
            rows: 2,
            value: notes,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value),
            placeholder: 'Lý do chốt, thỏa thuận đặc biệt với quản lý sảnh...',
            className:
              'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
          })
        ),
        // Optional Handover metadata
        h(
          'div',
          { className: 'p-3 bg-gray-50/70 border border-gray-200 rounded-lg space-y-3' },
          h('div', { className: 'font-semibold text-xs text-gray-800' }, 'Ghi nhận bàn giao ban đầu (Tùy chọn)'),
          h(
            'div',
            { className: 'grid grid-cols-2 gap-3' },
            h(
              'div',
              { className: 'space-y-1' },
              h('label', { className: 'block text-[11px] text-gray-600' }, 'Đại diện bên nhận'),
              h('input', {
                type: 'text',
                value: handedOverTo,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setHandedOverTo(e.target.value),
                placeholder: 'Anh Hùng (Quản lý sảnh)',
                className:
                  'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-surface',
              })
            ),
            h(
              'div',
              { className: 'space-y-1' },
              h('label', { className: 'block text-[11px] text-gray-600' }, 'Kênh ghi nhận'),
              h('input', {
                type: 'text',
                value: handoverChannel,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setHandoverChannel(e.target.value),
                placeholder: 'Biên bản giấy, Zalo...',
                className:
                  'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-surface',
              })
            )
          )
        ),
        // Footer actions
        h(
          'div',
          { className: 'pt-4 border-t border-gray-100 flex items-center justify-end gap-3' },
          h(
            'button',
            {
              type: 'button',
              onClick: onClose,
              className:
                'px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition',
            },
            'Hủy'
          ),
          h(
            'button',
            {
              type: 'submit',
              className:
                'px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs flex items-center gap-1.5',
            },
            h(FileCheck, { className: 'w-4 h-4' }),
            'Tạo Bản Chốt Bất Biến'
          )
        )
      )
    )
  );
};
