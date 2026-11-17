'use client';

import * as React from 'react';
import { IdeaItem } from './types';
import { X, ShieldAlert, CheckCircle2, DollarSign, CheckSquare, Link2 } from 'lucide-react';

const h = React.createElement;

export interface TaskOrCostPreviewResult {
  ideaId: string;
  createType: 'task' | 'cost' | 'both';
  taskTitle: string;
  costTitle: string;
  costAmount: number;
  vendorName: string;
  sourceNote: string;
}

export interface CreateTaskOrCostPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  idea: IdeaItem | null;
  onConfirm: (result: TaskOrCostPreviewResult) => void;
}

export const CreateTaskOrCostPreviewModal: React.FC<CreateTaskOrCostPreviewModalProps> = ({
  isOpen,
  onClose,
  idea,
  onConfirm,
}) => {
  const [createType, setCreateType] = React.useState<'task' | 'cost' | 'both'>('cost');
  const [taskTitle, setTaskTitle] = React.useState('');
  const [costTitle, setCostTitle] = React.useState('');
  const [costAmount, setCostAmount] = React.useState<number>(0);
  const [vendorName, setVendorName] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);

  React.useEffect(() => {
    if (idea) {
      setTaskTitle(`Chuẩn bị & triển khai: ${idea.title}`);
      setCostTitle(`Chi phí ý tưởng: ${idea.title}`);
      setCostAmount(idea.estimatedCost || 0);
      setVendorName(idea.linkedVendorName || '');
      setConfirmed(false);
    }
  }, [idea, isOpen]);

  if (!isOpen || !idea) return null;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      ideaId: idea.id,
      createType,
      taskTitle,
      costTitle,
      costAmount,
      vendorName,
      sourceNote: `Tạo từ ý tưởng: "${idea.title}" (ID: ${idea.id})`,
    });
    setConfirmed(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150',
      'data-testid': 'create-task-or-cost-modal',
    },
    h(
      'div',
      {
        className:
          'bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden flex flex-col',
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
          { className: 'flex items-center gap-2 text-emerald-800' },
          h(CheckCircle2, { className: 'w-5 h-5 text-emerald-600' }),
          h(
            'h2',
            { className: 'text-base font-semibold' },
            'Xem trước tạo Công việc / Khoản chi'
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
      // Anti-duplication safeguard banner (PLAN §15 invariant)
      h(
        'div',
        {
          className:
            'px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2.5 text-xs text-amber-800',
        },
        h(ShieldAlert, { className: 'w-4 h-4 text-amber-600 shrink-0 mt-0.5' }),
        h(
          'div',
          {},
          h('p', { className: 'font-semibold' }, 'Quy tắc chống trùng lặp (PLAN §15):'),
          h(
            'p',
            { className: 'mt-0.5 text-amber-700 leading-normal' },
            'Ý tưởng đã chốt không tự sinh công việc hay khoản chi tự động. Bản xem trước này cho phép bạn xác nhận chính xác các trường dữ liệu và liên kết nguồn trước khi tạo.'
          )
        )
      ),
      // Body
      h(
        'form',
        { onSubmit: handleConfirm, className: 'p-6 space-y-4 text-sm' },
        // Source Idea info
        h(
          'div',
          { className: 'p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1' },
          h(
            'div',
            { className: 'flex items-center gap-1.5 text-xs text-gray-500 font-medium' },
            h(Link2, { className: 'w-3.5 h-3.5 text-gray-400' }),
            'Nguồn ý tưởng gốc:'
          ),
          h('div', { className: 'font-semibold text-gray-900' }, idea.title),
          idea.notes &&
            h('div', { className: 'text-xs text-gray-600 line-clamp-2' }, idea.notes)
        ),
        // Selection: Task vs Cost vs Both
        h(
          'div',
          { className: 'space-y-1.5' },
          h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Bạn muốn tạo gì từ ý tưởng này?'),
          h(
            'div',
            { className: 'grid grid-cols-3 gap-2' },
            h(
              'button',
              {
                type: 'button',
                onClick: () => setCreateType('cost'),
                className: `flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition ${
                  createType === 'cost'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`,
              },
              h(DollarSign, { className: 'w-3.5 h-3.5' }),
              'Khoản chi'
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setCreateType('task'),
                className: `flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition ${
                  createType === 'task'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`,
              },
              h(CheckSquare, { className: 'w-3.5 h-3.5' }),
              'Công việc'
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setCreateType('both'),
                className: `flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition ${
                  createType === 'both'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`,
              },
              'Cả hai'
            )
          )
        ),
        // Task Preview fields
        (createType === 'task' || createType === 'both') &&
          h(
            'div',
            { className: 'space-y-1' },
            h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Tên công việc sẽ tạo:'),
            h('input', {
              type: 'text',
              value: taskTitle,
              onChange: (e) => setTaskTitle(e.target.value),
              className:
                'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
            })
          ),
        // Cost Preview fields
        (createType === 'cost' || createType === 'both') &&
          h(
            'div',
            { className: 'grid grid-cols-2 gap-3' },
            h(
              'div',
              { className: 'space-y-1' },
              h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Tên khoản chi:'),
              h('input', {
                type: 'text',
                value: costTitle,
                onChange: (e) => setCostTitle(e.target.value),
                className:
                  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
              })
            ),
            h(
              'div',
              { className: 'space-y-1' },
              h('label', { className: 'block text-xs font-semibold text-gray-700' }, 'Số tiền dự toán (VNĐ):'),
              h('input', {
                type: 'number',
                value: costAmount,
                onChange: (e) => setCostAmount(Number(e.target.value)),
                className:
                  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary',
              })
            )
          ),
        // Footer buttons
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
              disabled: confirmed,
              className:
                'px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs flex items-center gap-1.5',
            },
            confirmed
              ? h('span', {}, 'Đã xác nhận tạo...')
              : h(
                  React.Fragment,
                  null,
                  h(CheckCircle2, { className: 'w-4 h-4' }),
                  'Xác nhận tạo & Liên kết'
                )
          )
        )
      )
    )
  );
};
