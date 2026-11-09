export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type DeadlineType = 'fixed_date' | 'fixed_datetime' | 'relative_to_event';
export type RelativeDirection = 'before' | 'after';

export interface TaskModel {
  id: string;
  title: string;
  category?: string | null;
  eventId?: string | null;
  inChargeUserId?: string | null;
  supportContacts: string[];
  priority: TaskPriority;
  status: TaskStatus;
  deadlineType: DeadlineType;
  fixedDate?: string | null; // YYYY-MM-DD
  fixedDatetime?: Date | null;
  relativeEventId?: string | null;
  relativeOffsetDays?: number | null;
  relativeDirection: RelativeDirection;
  pinnedManual: boolean;
  privateNotes?: string | null;
  sharedWithFamily: boolean;
  sharedPublicTitle?: string | null;
  sharedPublicNotes?: string | null;
  reopenedAt?: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskChecklistItemModel {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskDependencyModel {
  id: string;
  dependentTaskId: string;
  prerequisiteTaskId: string;
  createdAt: Date;
}

export interface AppointmentModel {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  eventId?: string | null;
  location?: string | null;
  attendees?: string | null;
  inChargeUserId?: string | null;
  notes?: string | null;
  sharedWithFamily: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Computed task metrics including effective deadline & overdue status (AT18, AT20)
 */
export interface ComputedTaskMetrics {
  effectiveDueDate: Date | null;
  effectiveDueDateString: string | null; // ISO string
  isWaitingOfficialDate: boolean;
  isOverdue: boolean;
  isPastDrift: boolean; // true if new relative due date shifted into the past relative to today
}

/**
 * Reschedule impact diff item (AT18, AT62)
 */
export interface AffectedRelativeTask {
  taskId: string;
  title: string;
  oldDueDate: string | null;
  newDueDate: string;
  offsetDays: number;
  direction: RelativeDirection;
  isDriftedPast: boolean; // Warning: date falls before today!
}

export interface PinnedTaskSkipped {
  taskId: string;
  title: string;
  reason: string;
}

export interface FixedPaymentScheduleReview {
  scheduleId: string;
  costItemName: string;
  title: string;
  amountDue: bigint;
  dueDate: string;
}

export interface RescheduleImpactPreview {
  eventId: string;
  oldDate: string | null;
  newDate: string;
  affectedRelativeTasks: AffectedRelativeTask[];
  pinnedTasksSkipped: PinnedTaskSkipped[];
  fixedPaymentSchedulesRequiringManualReview: FixedPaymentScheduleReview[];
  hasPastDriftWarnings: boolean;
}

/**
 * Unified Calendar item for multi-source calendar feed (AT62)
 */
export interface UnifiedCalendarItem {
  id: string;
  itemType: 'task' | 'payment_schedule' | 'appointment' | 'event_ceremony';
  title: string;
  dateTime: Date;
  dateString: string; // YYYY-MM-DD
  status: string;
  priority?: TaskPriority;
  inChargeName?: string | null;
  amountDue?: bigint | null;
  location?: string | null;
  sourceId: string;
  sharedWithFamily: boolean;
}
