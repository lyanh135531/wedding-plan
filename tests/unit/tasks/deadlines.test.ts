import { describe, it, expect } from 'vitest';
import { computeEffectiveDueDate } from '../../../src/lib/tasks/deadlines';

describe('Task Deadlines & Effective Due Date Computation (AT18, AT20, UXT01)', () => {
  const currentDate = new Date('2026-11-10T12:00:00.000Z');

  describe('1. Fixed Date & Datetime Deadlines', () => {
    it('computes effective due date for fixed_date at end of day', () => {
      const task = {
        deadlineType: 'fixed_date' as const,
        fixedDate: '2026-11-15',
        status: 'not_started',
      };

      const metrics = computeEffectiveDueDate(task, new Map(), currentDate);

      expect(metrics.effectiveDueDateString).toBe('2026-11-15T16:59:59.999Z');
      expect(metrics.isWaitingOfficialDate).toBe(false);
      expect(metrics.isOverdue).toBe(false);
    });

    it('marks task as overdue if fixed_date has passed', () => {
      const task = {
        deadlineType: 'fixed_date' as const,
        fixedDate: '2026-11-05', // 5 days prior to currentDate
        status: 'in_progress',
      };

      const metrics = computeEffectiveDueDate(task, new Map(), currentDate);

      expect(metrics.isOverdue).toBe(true);
      expect(metrics.isPastDrift).toBe(true);
    });

    it('AT20: completed task is NEVER overdue even if date has passed', () => {
      const task = {
        deadlineType: 'fixed_date' as const,
        fixedDate: '2026-11-05',
        status: 'completed',
      };

      const metrics = computeEffectiveDueDate(task, new Map(), currentDate);

      expect(metrics.isOverdue).toBe(false);
    });
  });

  describe('2. Relative to Event Deadlines (AT18, UXT01)', () => {
    it('UXT01 & AT18: returns null due date and isWaitingOfficialDate = true when event date is tentative / unconfirmed', () => {
      const eventsMap = new Map([
        [
          'event-1',
          {
            id: 'event-1',
            solarDate: null,
            isDateConfirmed: false, // Tentative: "Dự kiến sau Tết âm lịch 2028"
          },
        ],
      ]);

      const task = {
        deadlineType: 'relative_to_event' as const,
        relativeEventId: 'event-1',
        relativeOffsetDays: 30,
        relativeDirection: 'before' as const,
        status: 'not_started',
      };

      const metrics = computeEffectiveDueDate(task, eventsMap, currentDate);

      expect(metrics.effectiveDueDate).toBeNull();
      expect(metrics.effectiveDueDateString).toBeNull();
      // Crucial: No fake date or fake countdown!
      expect(metrics.isWaitingOfficialDate).toBe(true);
      expect(metrics.isOverdue).toBe(false);
    });

    it('AT18: calculates relative due date correctly (30 days before official wedding event)', () => {
      const eventsMap = new Map([
        [
          'event-wedding',
          {
            id: 'event-wedding',
            solarDate: '2028-03-15',
            isDateConfirmed: true,
          },
        ],
      ]);

      const task = {
        deadlineType: 'relative_to_event' as const,
        relativeEventId: 'event-wedding',
        relativeOffsetDays: 30,
        relativeDirection: 'before' as const,
        status: 'not_started',
      };

      const metrics = computeEffectiveDueDate(task, eventsMap, currentDate);

      expect(metrics.isWaitingOfficialDate).toBe(false);
      // 2028-03-15 minus 30 days = 2028-02-14 (2028 is a leap year!)
      expect(metrics.effectiveDueDateString).toBe('2028-02-14T16:59:59.999Z');
      expect(metrics.isOverdue).toBe(false);
    });

    it('AT18: detects past drift when relative deadline falls in the past relative to currentDate', () => {
      const eventsMap = new Map([
        [
          'event-near',
          {
            id: 'event-near',
            solarDate: '2026-11-12',
            isDateConfirmed: true,
          },
        ],
      ]);

      // 5 days before Nov 12 = Nov 7 (which is in the past relative to Nov 10)
      const task = {
        deadlineType: 'relative_to_event' as const,
        relativeEventId: 'event-near',
        relativeOffsetDays: 5,
        relativeDirection: 'before' as const,
        status: 'in_progress',
      };

      const metrics = computeEffectiveDueDate(task, eventsMap, currentDate);

      expect(metrics.isPastDrift).toBe(true);
      expect(metrics.isOverdue).toBe(true);
    });
  });
});
