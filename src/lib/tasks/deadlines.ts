import { TaskModel, ComputedTaskMetrics, RelativeDirection } from './types';

export interface EventDateInfo {
  id: string;
  solarDate?: string | null; // YYYY-MM-DD
  isDateConfirmed?: boolean;
}

/**
 * Computes the effective due date for a task across fixed and relative deadlines.
 *
 * Invariants:
 * - AT18, UXT01: If deadline is relative_to_event and the event date is tentative / unconfirmed,
 *   effectiveDueDate is NULL and isWaitingOfficialDate is TRUE. No fake dates or countdowns are generated.
 * - AT20: Completed or cancelled tasks are NEVER overdue.
 */
export function computeEffectiveDueDate(
  task: {
    deadlineType: 'fixed_date' | 'fixed_datetime' | 'relative_to_event';
    fixedDate?: string | null;
    fixedDatetime?: Date | string | null;
    relativeEventId?: string | null;
    relativeOffsetDays?: number | null;
    relativeDirection?: RelativeDirection | null;
    status: string;
  },
  eventsMap: Map<string, EventDateInfo>,
  currentDate = new Date()
): ComputedTaskMetrics {
  const isTerminalStatus = task.status === 'completed' || task.status === 'cancelled';

  if (task.deadlineType === 'fixed_date') {
    if (!task.fixedDate) {
      return {
        effectiveDueDate: null,
        effectiveDueDateString: null,
        isWaitingOfficialDate: false,
        isOverdue: false,
        isPastDrift: false,
      };
    }
    const dueDate = new Date(`${task.fixedDate}T23:59:59.999Z`);
    const isOverdue = !isTerminalStatus && currentDate.getTime() > dueDate.getTime();
    return {
      effectiveDueDate: dueDate,
      effectiveDueDateString: dueDate.toISOString(),
      isWaitingOfficialDate: false,
      isOverdue,
      isPastDrift: dueDate.getTime() < currentDate.getTime(),
    };
  }

  if (task.deadlineType === 'fixed_datetime') {
    if (!task.fixedDatetime) {
      return {
        effectiveDueDate: null,
        effectiveDueDateString: null,
        isWaitingOfficialDate: false,
        isOverdue: false,
        isPastDrift: false,
      };
    }
    const dueDate = new Date(task.fixedDatetime);
    const isOverdue = !isTerminalStatus && currentDate.getTime() > dueDate.getTime();
    return {
      effectiveDueDate: dueDate,
      effectiveDueDateString: dueDate.toISOString(),
      isWaitingOfficialDate: false,
      isOverdue,
      isPastDrift: dueDate.getTime() < currentDate.getTime(),
    };
  }

  if (task.deadlineType === 'relative_to_event') {
    if (!task.relativeEventId) {
      return {
        effectiveDueDate: null,
        effectiveDueDateString: null,
        isWaitingOfficialDate: true,
        isOverdue: false,
        isPastDrift: false,
      };
    }

    const event = eventsMap.get(task.relativeEventId);
    // If event date is not confirmed or missing, do NOT generate fake dates (AT18, UXT01)
    if (!event || !event.solarDate || event.isDateConfirmed === false) {
      return {
        effectiveDueDate: null,
        effectiveDueDateString: null,
        isWaitingOfficialDate: true,
        isOverdue: false,
        isPastDrift: false,
      };
    }

    const eventDate = new Date(`${event.solarDate}T23:59:59.999Z`);
    const offsetDays = task.relativeOffsetDays || 0;
    const offsetMs = offsetDays * 24 * 60 * 60 * 1000;

    let computedEpoch: number;
    if (task.relativeDirection === 'after') {
      computedEpoch = eventDate.getTime() + offsetMs;
    } else {
      // Default: 'before'
      computedEpoch = eventDate.getTime() - offsetMs;
    }

    const dueDate = new Date(computedEpoch);
    const isPastDrift = dueDate.getTime() < currentDate.getTime();
    const isOverdue = !isTerminalStatus && isPastDrift;

    return {
      effectiveDueDate: dueDate,
      effectiveDueDateString: dueDate.toISOString(),
      isWaitingOfficialDate: false,
      isOverdue,
      isPastDrift,
    };
  }

  return {
    effectiveDueDate: null,
    effectiveDueDateString: null,
    isWaitingOfficialDate: false,
    isOverdue: false,
    isPastDrift: false,
  };
}
