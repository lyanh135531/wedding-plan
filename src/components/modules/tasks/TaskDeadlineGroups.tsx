'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { StatusBadge } from '@/components/ui/status-badge';
import { CheckCircle2, Clock, AlertCircle, HelpCircle, Check, Users } from 'lucide-react';

const h = React.createElement;

export interface TaskItem {
  id: string;
  title: string;
  sharedPublicTitle?: string;
  bucket: 'overdue' | 'today' | 'next_7_days' | 'unset' | 'done';
  deadlineLabel: string; // e.g. "Hôm nay", "Quá hạn 2 ngày", "Hạn sẽ được tính khi chốt ngày"
  assigneeName?: string;
  isRelativeDeadline?: boolean;
  isSharedWithFamily?: boolean;
  privateNotes?: string;
  isCompleted: boolean;
}

export interface TaskDeadlineGroupsProps {
  tasks: TaskItem[];
  onToggleTask: (id: string) => void;
  onClickTask?: (task: TaskItem) => void;
}

export const TaskDeadlineGroups: React.FC<TaskDeadlineGroupsProps> = ({
  tasks,
  onToggleTask,
  onClickTask,
}) => {
  const { isFamily } = useRole();

  const buckets = [
    { key: 'overdue', title: 'Quá hạn', badge: 'danger', icon: AlertCircle },
    { key: 'today', title: 'Hôm nay', badge: 'warning', icon: Clock },
    { key: 'next_7_days', title: 'Trong 7 ngày tới', badge: 'info', icon: Clock },
    { key: 'unset', title: 'Chưa có hạn chót', badge: 'neutral', icon: HelpCircle },
    { key: 'done', title: 'Đã hoàn tất', badge: 'success', icon: CheckCircle2 },
  ] as const;

  return h(
    'div',
    { className: 'space-y-6' },
    buckets.map((b) => {
      const bucketTasks = tasks.filter((t) => t.bucket === b.key);
      if (bucketTasks.length === 0 && b.key !== 'overdue' && b.key !== 'today') {
        return null;
      }

      return h(
        'div',
        {
          key: b.key,
          className: 'bg-surface border border-border-subtle rounded-card shadow-sm p-4 sm:p-5',
        },
        // Bucket Header
        h(
          'div',
          { className: 'flex items-center justify-between border-b border-border-subtle pb-3 mb-3 select-none' },
          h(
            'div',
            { className: 'flex items-center gap-2' },
            h(b.icon, {
              className: `w-4 h-4 ${
                b.key === 'overdue'
                  ? 'text-danger'
                  : b.key === 'today'
                  ? 'text-[#D97706]'
                  : b.key === 'done'
                  ? 'text-[#2E7D32]'
                  : 'text-text-muted'
              }`,
            }),
            h('h2', { className: 'text-sm font-bold text-text-main' }, b.title),
            h(
              'span',
              {
                className: `text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                  b.key === 'overdue' && bucketTasks.length > 0
                    ? 'bg-danger-bg text-danger'
                    : 'bg-page text-text-muted'
                }`,
              },
              bucketTasks.length
            )
          )
        ),

        // Tasks in bucket
        bucketTasks.length === 0
          ? h(
              'p',
              { className: 'text-xs text-text-muted py-2 italic' },
              b.key === 'overdue' ? 'Không có việc nào quá hạn.' : 'Không có việc nào trong mục này.'
            )
          : h(
              'div',
              { className: 'space-y-2' },
              bucketTasks.map((task) => {
                const displayTitle =
                  isFamily && task.sharedPublicTitle
                    ? task.sharedPublicTitle
                    : task.title;

                return h(
                  'div',
                  {
                    key: task.id,
                    className:
                      'p-3 rounded-control border border-border-subtle hover:border-border-control transition-colors flex items-center justify-between gap-3 bg-surface',
                  },
                  // Left: Checkbox + Title
                  h(
                    'div',
                    { className: 'flex items-center gap-3 min-w-0 flex-1' },
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => onToggleTask(task.id),
                        className: `w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          task.isCompleted
                            ? 'bg-primary border-primary text-white'
                            : 'border-border-control bg-surface hover:border-primary'
                        }`,
                        'aria-label': `Đánh dấu hoàn tất ${displayTitle}`,
                      },
                      task.isCompleted && h(Check, { className: 'w-3.5 h-3.5 stroke-[3]' })
                    ),
                    h(
                      'div',
                      { className: 'min-w-0 flex-1' },
                      h(
                        'button',
                        {
                          type: 'button',
                          onClick: () => onClickTask?.(task),
                          className: `text-left text-sm font-medium text-text-main hover:text-primary hover:underline truncate block w-full ${
                            task.isCompleted ? 'line-through text-text-muted' : ''
                          }`,
                        },
                        displayTitle
                      ),
                      h(
                        'div',
                        { className: 'flex items-center gap-2 text-xs text-text-muted mt-0.5' },
                        task.assigneeName && h('span', null, `Phụ trách: ${task.assigneeName}`),
                        task.isSharedWithFamily &&
                          h(
                            'span',
                            { className: 'flex items-center gap-0.5 text-primary text-[11px]' },
                            h(Users, { className: 'w-3 h-3' }),
                            'Chia sẻ người nhà'
                          )
                      )
                    )
                  ),

                  // Right: Deadline badge
                  h(
                    'div',
                    { className: 'shrink-0 text-right' },
                    h(
                      'span',
                      {
                        className: `text-xs px-2 py-0.5 rounded font-medium ${
                          task.bucket === 'overdue'
                            ? 'bg-danger-bg text-danger'
                            : task.bucket === 'today'
                            ? 'bg-[#FFF8E1] text-[#D97706]'
                            : task.bucket === 'unset'
                            ? 'bg-page text-text-muted border border-border-subtle'
                            : 'bg-primary/10 text-primary'
                        }`,
                      },
                      task.deadlineLabel
                    )
                  )
                );
              })
            )
      );
    })
  );
};
