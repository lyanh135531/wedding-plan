import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { TaskDeadlineGroups, TaskItem } from '@/components/modules/tasks/TaskDeadlineGroups';
import { CreateTaskModal } from '@/components/modules/tasks/CreateTaskModal';
import { RescheduleDateModal } from '@/components/modules/tasks/RescheduleDateModal';
import { TasksManager, INITIAL_TASKS } from '@/components/modules/tasks/TasksManager';

const h = React.createElement;

describe('S12: Tasks Management & Relative Deadlines Prototype', () => {
  it('TaskDeadlineGroups correctly partitions tasks into 5 chronological buckets (UXT10)', () => {
    const html = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'owner' },
        h(TaskDeadlineGroups, {
          tasks: INITIAL_TASKS,
          onToggleTask: () => {},
        })
      )
    );

    expect(html).toContain('Quá hạn');
    expect(html).toContain('Hôm nay');
    expect(html).toContain('Trong 7 ngày tới');
    expect(html).toContain('Chưa có hạn chót');
    expect(html).toContain('Đã hoàn tất');

    // Invariant: Relative task to unconfirmed event is in "Chưa có hạn chót" with specific label
    expect(html).toContain('Hạn sẽ được tính khi chốt ngày');
  });

  it('CreateTaskModal assigns safe unset deadline for relative tasks to unconfirmed events (UXT10)', () => {
    const html = renderToStaticMarkup(
      h(CreateTaskModal, {
        isOpen: true,
        onClose: () => {},
        onSubmit: () => {},
      })
    );

    expect(html).toContain('Thêm công việc mới');
    expect(html).toContain('Hạn tương đối');
    expect(html).toContain('Sự kiện này chưa chốt ngày chính thức');
    expect(html).toContain('Hạn sẽ được tính khi chốt ngày');
    // Must NOT show fake overdue alert
    expect(html).not.toContain('Quá hạn');
  });

  it('RescheduleDateModal displays 3-category impact preview before commit (UXT11)', () => {
    const html = renderToStaticMarkup(
      h(RescheduleDateModal, {
        isOpen: true,
        onClose: () => {},
        currentDate: '15/12/2026',
        onConfirmReschedule: () => {},
      })
    );

    expect(html).toContain('Dời ngày cưới &amp; Xem trước tác động');
    expect(html).toContain('Nhóm 1: Tự động tính lại theo ngày mới');
    expect(html).toContain('Nhóm 2: Giữ nguyên ngày cố định');
    expect(html).toContain('Nhóm 3: Cần kiểm tra lại thủ công');
    expect(html).toContain('Xác nhận đổi ngày');
  });

  it('TasksManager masks private titles and hides unshared tasks in Family View', () => {
    const familyHtml = renderToStaticMarkup(
      h(
        RoleProvider,
        { initialRole: 'family_view' },
        h(TasksManager, { initialState: 'populated' })
      )
    );

    // Private task with financial text must NOT appear
    expect(familyHtml).not.toContain('Đặt cọc 40.000.000 ₫');

    // Shared task public title should appear
    expect(familyHtml).toContain('Thống nhất danh sách khách mời họ hàng');
    expect(familyHtml).toContain('Chuẩn bị lễ vật mâm quả nhà trai');
  });

  it('TasksManager renders all 6 mandatory states', () => {
    const renderState = (st: any) =>
      renderToStaticMarkup(
        h(RoleProvider, { initialRole: 'owner' }, h(TasksManager, { initialState: st }))
      );

    expect(renderState('loading')).toContain('animate-pulse');
    expect(renderState('empty')).toContain('Chưa có công việc nào cần xử lý');
    expect(renderState('populated')).toContain('Danh Sách Công Việc');
    expect(renderState('error')).toContain('REQ-20261106-TASKS-ERR');
    expect(renderState('filtered')).toContain('Không tìm thấy công việc nào');
  });
});
