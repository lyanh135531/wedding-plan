'use client';

import * as React from 'react';
import { useRole } from '@/context/RoleContext';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';
import { StateWrapper } from '@/components/testing/StateWrapper';
import { Button } from '@/components/ui/button';
import { TaskDeadlineGroups, TaskItem } from './TaskDeadlineGroups';
import { CreateTaskModal } from './CreateTaskModal';
import { RescheduleDateModal } from './RescheduleDateModal';
import { Plus, Calendar, Filter } from 'lucide-react';

const h = React.createElement;

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 't-1',
    title: 'Chốt danh sách khách mời Nhà Gái đợt 1',
    sharedPublicTitle: 'Thống nhất danh sách khách mời họ hàng',
    bucket: 'overdue',
    deadlineLabel: 'Quá hạn 2 ngày',
    assigneeName: 'Cô dâu',
    isSharedWithFamily: true,
    isCompleted: false,
  },
  {
    id: 't-2',
    title: 'Đặt cọc 40.000.000 ₫ đợt 2 cho Trung tâm tiệc cưới White Palace',
    bucket: 'today',
    deadlineLabel: 'Hôm nay',
    assigneeName: 'Chú rể',
    isSharedWithFamily: false, // Private financial task!
    isCompleted: false,
  },
  {
    id: 't-3',
    title: 'Duyệt bản in mẫu thiệp cưới tại xưởng in',
    sharedPublicTitle: 'Duyệt mẫu thiệp in',
    bucket: 'next_7_days',
    deadlineLabel: 'Trong 3 ngày tới',
    assigneeName: 'Chú rể',
    isSharedWithFamily: true,
    isCompleted: false,
  },
  {
    id: 't-4',
    title: 'Chuẩn bị mâm quả Lễ Ăn Hỏi (tính theo ngày lễ chính thức)',
    sharedPublicTitle: 'Chuẩn bị lễ vật mâm quả nhà trai',
    bucket: 'unset',
    deadlineLabel: 'Hạn sẽ được tính khi chốt ngày',
    assigneeName: 'Gia đình chú rể',
    isRelativeDeadline: true,
    isSharedWithFamily: true,
    isCompleted: false,
  },
  {
    id: 't-5',
    title: 'Họp gia đình hai bên bàn bạc kế hoạch cưới',
    sharedPublicTitle: 'Họp mặt hai bên gia đình',
    bucket: 'done',
    deadlineLabel: 'Đã xong',
    assigneeName: 'Hai nhà',
    isSharedWithFamily: true,
    isCompleted: true,
  },
];

export interface TasksManagerProps {
  initialState?: PrototypeState;
}

export const TasksManager: React.FC<TasksManagerProps> = ({
  initialState = 'populated',
}) => {
  const { isOwner, isFamily } = useRole();
  const [state, setState] = React.useState<PrototypeState>(initialState);
  const [tasks, setTasks] = React.useState<TaskItem[]>(INITIAL_TASKS);
  const [filterMode, setFilterMode] = React.useState<'all' | 'mine' | 'family'>('all');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = React.useState(false);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  // If in Family View, only show shared tasks!
  const visibleTasks = React.useMemo(() => {
    if (state === 'empty') return [];
    if (state === 'filtered') return [];

    let result = tasks;
    if (isFamily) {
      result = result.filter((t) => t.isSharedWithFamily);
    } else if (filterMode === 'family') {
      result = result.filter((t) => t.isSharedWithFamily);
    }
    return result;
  }, [tasks, isFamily, filterMode, state]);

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const isCompleted = !t.isCompleted;
          return {
            ...t,
            isCompleted,
            bucket: isCompleted ? 'done' : 'next_7_days',
            deadlineLabel: isCompleted ? 'Đã xong' : 'Đang xử lý',
          };
        }
        return t;
      })
    );
  };

  const handleAddTask = (newTask: TaskItem) => {
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleReschedule = (newDate: string) => {
    // Recalculate relative tasks
    setTasks((prev) =>
      prev.map((t) =>
        t.isRelativeDeadline
          ? { ...t, deadlineLabel: `Tính theo ngày mới: ${newDate}` }
          : t
      )
    );
  };

  const loadingSkeleton = h(
    'div',
    { className: 'space-y-4 animate-pulse', role: 'status', 'aria-label': 'Đang tải danh sách việc' },
    h('div', { className: 'h-12 bg-border-subtle rounded-control' }),
    h('div', { className: 'space-y-3' },
      [1, 2, 3, 4].map((i) => h('div', { key: i, className: 'h-24 bg-border-subtle rounded-card' }))
    )
  );

  return h(
    StateWrapper,
    {
      state,
      loadingSkeleton,
      emptyTitle: 'Chưa có công việc nào cần xử lý',
      emptyDescription: 'Tạo công việc đầu tiên hoặc tải gói danh mục mẫu để bắt đầu chuẩn bị.',
      emptyActionLabel: '+ Thêm công việc đầu tiên',
      onEmptyAction: () => {
        setTasks(INITIAL_TASKS);
        setState('populated');
      },
      errorTitle: 'Không thể tải danh sách công việc',
      errorMessage: 'Mất kết nối máy chủ hoặc quá thời gian chờ mạng. Vui lòng thử lại.',
      errorRequestId: 'REQ-20261106-TASKS-ERR',
      onRetry: () => setState('populated'),
      filteredTitle: 'Không tìm thấy công việc nào trong bộ lọc này',
      filteredDescription: 'Hãy thử chọn xem tất cả công việc.',
      onClearFilter: () => {
        setFilterMode('all');
        setState('populated');
      },
      permissionDeniedMessage:
        'Bạn chỉ có thể xem các công việc đã được Chủ sở hữu chia sẻ với người nhà.',
    },
    h(
      'div',
      { className: 'space-y-6 max-w-7xl mx-auto' },
      // Header
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' },
        h(
          'div',
          null,
          h('h1', { className: 'text-2xl font-bold text-text-main tracking-tight' }, 'Danh Sách Công Việc'),
          h('p', { className: 'text-sm text-text-muted mt-0.5' }, 'Theo dõi tiến độ, phân công và kiểm soát hạn chót')
        ),

        // Owner action buttons
        isOwner &&
          h(
            'div',
            { className: 'flex items-center gap-2 flex-wrap' },
            h(
              Button,
              {
                variant: 'secondary',
                leftIcon: h(Calendar, { className: 'w-4 h-4' }),
                onClick: () => setIsRescheduleOpen(true),
              },
              'Dời ngày cưới'
            ),
            h(
              Button,
              {
                variant: 'primary',
                leftIcon: h(Plus, { className: 'w-4 h-4' }),
                onClick: () => setIsCreateOpen(true),
              },
              '+ Thêm công việc'
            )
          )
      ),

      // Filter tabs (Owner only)
      isOwner &&
        h(
          'div',
          { className: 'flex items-center gap-2 border-b border-border-subtle pb-2 text-xs font-medium' },
          h(
            'button',
            {
              onClick: () => setFilterMode('all'),
              className: `px-3 py-1.5 rounded-full transition-colors ${
                filterMode === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-[#FAF9F5] text-text-muted hover:text-text-main'
              }`,
            },
            `Tất cả (${tasks.length})`
          ),
          h(
            'button',
            {
              onClick: () => setFilterMode('family'),
              className: `px-3 py-1.5 rounded-full transition-colors ${
                filterMode === 'family'
                  ? 'bg-primary text-white'
                  : 'bg-[#FAF9F5] text-text-muted hover:text-text-main'
              }`,
            },
            `Chia sẻ người nhà (${tasks.filter((t) => t.isSharedWithFamily).length})`
          )
        ),

      // Grouped tasks list
      h(TaskDeadlineGroups, {
        tasks: visibleTasks,
        onToggleTask: handleToggleTask,
      }),

      // Modals
      h(CreateTaskModal, {
        isOpen: isCreateOpen,
        onClose: () => setIsCreateOpen(false),
        onSubmit: handleAddTask,
      }),

      h(RescheduleDateModal, {
        isOpen: isRescheduleOpen,
        onClose: () => setIsRescheduleOpen(false),
        onConfirmReschedule: handleReschedule,
      })
    )
  );
};
