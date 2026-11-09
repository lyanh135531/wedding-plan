import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateRescheduleImpactPreview,
  applyReschedule,
} from '@/lib/tasks/reschedule.service';
import {
  validateNoDependencyCycle,
  TaskDependencyCycleError,
} from '@/lib/tasks/dag';
import { computeEffectiveDueDate } from '@/lib/tasks/deadlines';
import { getUnifiedCalendarFeed } from '@/lib/tasks/calendar.repository';
import { getDashboardOverview } from '@/lib/tasks/dashboard.repository';

describe('Adversarial Challenger Suite: Gate G5 Tasks, Calendar & Live Dashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // AT18: WEDDING RESCHEDULING & IMPACT DIFF PREVIEW
  // =========================================================================
  describe('AT18: Wedding date rescheduling preview & drift analysis', () => {
    it('previews date reschedule impact diff across 3 categories with past-drift warnings', async () => {
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation((table: any) => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'e0000000-0000-4000-8000-000000000001',
                  title: 'Tiệc cưới chính',
                  startTime: new Date('2028-03-01T08:00:00.000Z'),
                  status: 'confirmed',
                },
              ]),
            })),
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  scheduleId: 's0000000-0000-4000-8000-000000000001',
                  costItemName: 'Sảnh tiệc cưới',
                  title: 'Đợt 3: Thanh toán sau tiệc',
                  amountDue: 50000000n,
                  dueDate: '2028-03-05',
                },
              ]),
            }),
          })),
        })),
      };

      // Mock relative tasks for the event
      (mockTx.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'e0000000-0000-4000-8000-000000000001',
                title: 'Tiệc cưới chính',
                startTime: new Date('2028-03-01T08:00:00.000Z'),
                status: 'confirmed',
              },
            ]),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            // Task 1: Relative offset 10 days before event (affected)
            {
              id: 'task-rel-1',
              title: 'Gửi thiệp cưới',
              deadlineType: 'relative_to_event',
              relativeEventId: 'e0000000-0000-4000-8000-000000000001',
              relativeOffsetDays: 10,
              relativeDirection: 'before',
              pinnedManual: false,
              status: 'not_started',
            },
            // Task 2: Pinned manual (must be skipped)
            {
              id: 'task-pinned-2',
              title: 'Thử váy cưới đợt cuối (Đã chốt ngày)',
              deadlineType: 'relative_to_event',
              relativeEventId: 'e0000000-0000-4000-8000-000000000001',
              pinnedManual: true,
              status: 'in_progress',
            },
            // Task 3: Completed task (must be skipped)
            {
              id: 'task-completed-3',
              title: 'Đặt cọc nhà hàng',
              deadlineType: 'relative_to_event',
              relativeEventId: 'e0000000-0000-4000-8000-000000000001',
              pinnedManual: false,
              status: 'completed',
            },
            // Task 4: Relative task drifting before today (past drift warning)
            {
              id: 'task-drift-4',
              title: 'Gặp MC trao đổi kịch bản',
              deadlineType: 'relative_to_event',
              relativeEventId: 'e0000000-0000-4000-8000-000000000001',
              relativeOffsetDays: 15,
              relativeDirection: 'before',
              pinnedManual: false,
              status: 'in_progress',
            },
          ]),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                scheduleId: 's0000000-0000-4000-8000-000000000001',
                costItemName: 'Sảnh tiệc cưới',
                title: 'Đợt 3: Quyết toán',
                amountDue: 50000000n,
                dueDate: '2028-03-05',
              },
            ]),
          }),
        }),
      });

      // Simulated currentDate: Nov 10, 2026. Target new date: Nov 20, 2026 (Task 4 offset 15 days = Nov 5 -> past drift!)
      const preview = await generateRescheduleImpactPreview(
        mockTx as any,
        'e0000000-0000-4000-8000-000000000001',
        '2026-11-20',
        new Date('2026-11-10T12:00:00.000Z')
      );

      // Verify affected relative tasks
      expect(preview.affectedRelativeTasks).toHaveLength(2); // Task 1 and Task 4
      expect(preview.affectedRelativeTasks[0].taskId).toBe('task-rel-1');
      expect(preview.affectedRelativeTasks[0].newDueDate).toContain('2026-11-10'); // Nov 20 - 10 days = Nov 10

      // Verify past drift warning on Task 4 (Nov 20 - 15 days = Nov 5 < Nov 10)
      expect(preview.hasPastDriftWarnings).toBe(true);
      expect(preview.affectedRelativeTasks[1].isDriftedPast).toBe(true);

      // Verify pinned tasks and completed tasks were skipped
      expect(preview.pinnedTasksSkipped).toHaveLength(2);
      expect(preview.pinnedTasksSkipped[0].taskId).toBe('task-pinned-2');
      expect(preview.pinnedTasksSkipped[0].reason).toContain('Đã ghim thủ công');
      expect(preview.pinnedTasksSkipped[1].taskId).toBe('task-completed-3');
      expect(preview.pinnedTasksSkipped[1].reason).toContain('Đã hoàn thành');

      // Verify fixed payment schedule listed for manual review
      expect(preview.fixedPaymentSchedulesRequiringManualReview).toHaveLength(1);
      expect(preview.fixedPaymentSchedulesRequiringManualReview[0].scheduleId).toBe(
        's0000000-0000-4000-8000-000000000001'
      );
    });
  });

  // =========================================================================
  // AT19: DAG CYCLE DETECTION (A -> B -> A)
  // =========================================================================
  describe('AT19: Task dependency cycle prevention', () => {
    it('strictly aborts attempts to create cycles and self-dependencies', () => {
      // 1. Self dependency
      expect(() =>
        validateNoDependencyCycle([], {
          dependentTaskId: 'task-1',
          prerequisiteTaskId: 'task-1',
        })
      ).toThrow(TaskDependencyCycleError);

      // 2. Direct cycle A -> B -> A
      expect(() =>
        validateNoDependencyCycle(
          [{ dependentTaskId: 'task-b', prerequisiteTaskId: 'task-a' }],
          { dependentTaskId: 'task-a', prerequisiteTaskId: 'task-b' }
        )
      ).toThrow(TaskDependencyCycleError);

      // 3. Transitive cycle A -> B -> C -> A
      expect(() =>
        validateNoDependencyCycle(
          [
            { dependentTaskId: 'task-b', prerequisiteTaskId: 'task-a' },
            { dependentTaskId: 'task-c', prerequisiteTaskId: 'task-b' },
          ],
          { dependentTaskId: 'task-a', prerequisiteTaskId: 'task-c' }
        )
      ).toThrow(TaskDependencyCycleError);
    });
  });

  // =========================================================================
  // AT20: OVERDUE METRICS SYNCHRONIZATION ON LIVE DASHBOARD
  // =========================================================================
  describe('AT20: Live overdue counts on task completion and schedule changes', () => {
    it('immediately decrements overdue counter when an overdue task is marked completed', () => {
      const currentDate = new Date('2026-11-10T12:00:00.000Z');

      // Task before completion (overdue)
      const taskOverdue = {
        deadlineType: 'fixed_date' as const,
        fixedDate: '2026-11-05',
        status: 'in_progress',
      };
      const metricsBefore = computeEffectiveDueDate(taskOverdue, new Map(), currentDate);
      expect(metricsBefore.isOverdue).toBe(true);

      // Task marked completed
      const taskCompleted = {
        ...taskOverdue,
        status: 'completed',
      };
      const metricsAfter = computeEffectiveDueDate(taskCompleted, new Map(), currentDate);
      // Invariant AT20: Completed task is NOT overdue!
      expect(metricsAfter.isOverdue).toBe(false);
    });
  });

  // =========================================================================
  // AT62: UNIFIED CALENDAR FEED & PRIVACY ISOLATION
  // =========================================================================
  describe('AT62: Unified calendar synchronization and role isolation', () => {
    it('synchronizes tasks, payment installments, and ceremonies in a single chronological feed', async () => {
      const createDynamicQueryMock = (data: any[]) => {
        const p = Promise.resolve(data) as any;
        p.$dynamic = vi.fn().mockReturnValue(p);
        p.where = vi.fn().mockReturnValue(p);
        return p;
      };

      const mockTx = {
        select: vi.fn(),
      };

      (mockTx.select as any)
        .mockReturnValueOnce({
          // 1. events
          from: vi.fn().mockResolvedValue([
            {
              id: 'e1',
              title: 'Lễ gia tiên',
              startTime: new Date('2026-11-15T09:00:00.000Z'),
              status: 'confirmed',
              locationName: 'Nhà gái',
            },
          ]),
        })
        .mockReturnValueOnce({
          // 2. tasks
          from: vi.fn().mockReturnValue(createDynamicQueryMock([])),
        })
        .mockReturnValueOnce({
          // 3. appointments
          from: vi.fn().mockReturnValue(createDynamicQueryMock([])),
        })
        .mockReturnValueOnce({
          // 4. payment schedules
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: 'sched-1',
                  title: 'Đợt 1',
                  amountDue: 20000000n,
                  dueDate: '2026-11-20',
                  status: 'agreed',
                  costItemName: 'Chụp ảnh',
                },
              ]),
            }),
          }),
        });

      const feed = await getUnifiedCalendarFeed(mockTx as any, {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        role: 'owner',
      });

      expect(feed).toHaveLength(2);
      expect(feed[0].itemType).toBe('event_ceremony');
      expect(feed[0].dateString).toBe('2026-11-15');
      expect(feed[1].itemType).toBe('payment_schedule');
      expect(feed[1].dateString).toBe('2026-11-20');
      expect(feed[1].amountDue).toBe(20000000n);
    });

    it('AT03, UXT16: Family View role receives ZERO payment installments in calendar feed', async () => {
      const createDynamicQueryMock = (data: any[]) => {
        const p = Promise.resolve(data) as any;
        p.$dynamic = vi.fn().mockReturnValue(p);
        p.where = vi.fn().mockReturnValue(p);
        return p;
      };

      const mockTx = {
        select: vi.fn(),
      };

      (mockTx.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue([]), // events
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue(createDynamicQueryMock([])), // tasks
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue(createDynamicQueryMock([])), // appointments
        });

      const feed = await getUnifiedCalendarFeed(mockTx as any, {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        role: 'family_view',
      });

      // Critical invariant: ZERO payment schedules for Family View
      const paymentItems = feed.filter((item) => item.itemType === 'payment_schedule');
      expect(paymentItems).toHaveLength(0);
    });
  });
});
