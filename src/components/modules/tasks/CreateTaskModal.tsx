'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckSquare } from 'lucide-react';
import { TaskItem } from './TaskDeadlineGroups';

const h = React.createElement;

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: TaskItem) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = React.useState('');
  const [deadlineMode, setDeadlineMode] = React.useState<'relative' | 'fixed' | 'none'>('relative');
  const [fixedDate, setFixedDate] = React.useState<string | null>(null);
  const [relativeDays, setRelativeDays] = React.useState<number>(14);
  const [relativeDirection, setRelativeDirection] = React.useState<'before' | 'after'>('before');
  const [targetEvent, setTargetEvent] = React.useState<'tiec_chinh_unconfirmed' | 'vu_quy_confirmed'>('tiec_chinh_unconfirmed');
  const [isShared, setIsShared] = React.useState(false);
  const [sharedTitle, setSharedTitle] = React.useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let bucket: TaskItem['bucket'] = 'unset';
    let deadlineLabel = 'Chưa có hạn';

    if (deadlineMode === 'relative') {
      if (targetEvent === 'tiec_chinh_unconfirmed') {
        // Unconfirmed event date -> safe unset deadline (UXT10)
        bucket = 'unset';
        deadlineLabel = 'Hạn sẽ được tính khi chốt ngày';
      } else {
        bucket = 'next_7_days';
        deadlineLabel = `${relativeDays} ngày trước Lễ Vu Quy`;
      }
    } else if (deadlineMode === 'fixed') {
      bucket = fixedDate ? 'next_7_days' : 'unset';
      deadlineLabel = fixedDate || 'Chưa chọn ngày';
    }

    const newTask: TaskItem = {
      id: `task_${Date.now()}`,
      title,
      sharedPublicTitle: isShared ? (sharedTitle || title) : undefined,
      bucket,
      deadlineLabel,
      isRelativeDeadline: deadlineMode === 'relative',
      isSharedWithFamily: isShared,
      isCompleted: false,
    };

    onSubmit(newTask);
    onClose();
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'create-task-title',
    },
    h(
      'div',
      {
        className:
          'bg-surface w-full max-w-md rounded-card border border-border-control shadow-2xl p-6 text-text-main',
      },
      h(
        'div',
        { className: 'flex items-center justify-between border-b border-border-subtle pb-3 mb-4' },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(CheckSquare, { className: 'w-5 h-5 text-primary' }),
          h('h2', { id: 'create-task-title', className: 'text-base font-bold' }, 'Thêm công việc mới')
        ),
        h(
          'button',
          {
            onClick: onClose,
            className: 'text-text-muted hover:text-text-main p-1 rounded',
            'aria-label': 'Đóng',
          },
          '✕'
        )
      ),

      h(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-4' },
        h(TextInput, {
          label: 'Tên công việc',
          value: title,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value),
          placeholder: 'Ví dụ: Đặt cọc hoa tươi xe rước dâu',
          required: true,
        }),

        // Deadline mode radio
        h(
          'div',
          null,
          h('label', { className: 'block text-xs font-medium text-text-muted mb-1.5' }, 'Cách tính hạn chót:'),
          h(
            'div',
            { className: 'grid grid-cols-3 gap-2 text-xs' },
            h(
              'button',
              {
                type: 'button',
                onClick: () => setDeadlineMode('relative'),
                className: `h-8 rounded border font-medium transition-colors ${
                  deadlineMode === 'relative'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-text-main border-[#7A8881]'
                }`,
              },
              'Hạn tương đối'
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setDeadlineMode('fixed'),
                className: `h-8 rounded border font-medium transition-colors ${
                  deadlineMode === 'fixed'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-text-main border-[#7A8881]'
                }`,
              },
              'Ngày cố định'
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setDeadlineMode('none'),
                className: `h-8 rounded border font-medium transition-colors ${
                  deadlineMode === 'none'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-text-main border-[#7A8881]'
                }`,
              },
              'Không đặt hạn'
            )
          )
        ),

        // Relative deadline form (UXT10)
        deadlineMode === 'relative' &&
          h(
            'div',
            { className: 'p-3 bg-[#FAF9F5] border border-border-subtle rounded-control space-y-2.5 text-xs' },
            h(
              'div',
              { className: 'flex items-center gap-2' },
              h('input', {
                type: 'number',
                min: 1,
                max: 365,
                value: relativeDays,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  setRelativeDays(Number(e.target.value)),
                className: 'w-16 h-8 px-2 text-center border border-[#7A8881] rounded bg-white',
              }),
              h('span', null, 'ngày'),
              h(
                'select',
                {
                  value: relativeDirection,
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                    setRelativeDirection(e.target.value as any),
                  className: 'h-8 px-2 border border-[#7A8881] rounded bg-white',
                },
                h('option', { value: 'before' }, 'Trước'),
                h('option', { value: 'after' }, 'Sau')
              )
            ),

            h(
              'div',
              null,
              h('span', { className: 'text-text-muted block mb-1' }, 'Sự kiện mốc:'),
              h(
                'select',
                {
                  value: targetEvent,
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                    setTargetEvent(e.target.value as any),
                  className: 'w-full h-8 px-2 border border-[#7A8881] rounded bg-white',
                },
                h('option', { value: 'tiec_chinh_unconfirmed' }, 'Tiệc Cưới Chính (Chưa chốt ngày chính thức)'),
                h('option', { value: 'vu_quy_confirmed' }, 'Lễ Vu Quy (Đã chốt ngày 15/12/2026)')
              )
            ),

            targetEvent === 'tiec_chinh_unconfirmed' &&
              h(
                'div',
                { className: 'p-2 bg-[#FFF8E1] border border-[#F59E0B] rounded text-[11px] text-[#B45309]' },
                'Sự kiện này chưa chốt ngày chính thức. Hạn chót hiển thị là "Hạn sẽ được tính khi chốt ngày" (không báo quá hạn giả).'
              )
          ),

        // Fixed date input
        deadlineMode === 'fixed' &&
          h(DatePicker, {
            label: 'Chọn ngày hạn chót',
            value: fixedDate,
            onChange: setFixedDate,
            required: true,
          }),

        // Family sharing
        h(
          'div',
          { className: 'p-3 bg-surface border border-border-subtle rounded-control space-y-2' },
          h(Checkbox, {
            checked: isShared,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setIsShared(e.target.checked),
            label: 'Chia sẻ công việc này với người nhà (Family View)',
          }),
          isShared &&
            h(TextInput, {
              label: 'Tiêu đề hiển thị cho người nhà (đã lọc riêng tư)',
              value: sharedTitle,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSharedTitle(e.target.value),
              placeholder: 'Ví dụ: Đón khách họ hàng lúc 8h sáng',
            })
        ),

        // Buttons
        h(
          'div',
          { className: 'flex items-center justify-end gap-3 pt-3 border-t border-border-subtle' },
          h(
            Button,
            {
              type: 'button',
              variant: 'secondary',
              onClick: onClose,
            },
            'Hủy'
          ),
          h(
            Button,
            {
              type: 'submit',
              variant: 'primary',
            },
            'Lưu công việc'
          )
        )
      )
    )
  );
};
